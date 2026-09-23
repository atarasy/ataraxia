import { describe, expect, test } from "bun:test";
import { generateKeyPairSync } from "node:crypto";
import {
  call,
  callSecond,
  canonicalCorrection,
  canonicalCorrectionReturn,
  createConformingOffer,
  decide,
  freshHousehold,
  signByMerchant,
} from "../lib/probe.js";

/**
 * Specification §6.6a, decided 2026-09-23.
 *
 * A refund recorded as a correction can come back from the card issuer, and
 * the household is then owed the amount. The merchant appends a signed record
 * that it came back, and later one that it was repaid another way. Neither
 * moves money and neither changes the net; the receipt gains `returns` and
 * `owed` only while a record exists, because clients read its keys exactly and
 * a key that was always present would break every one built before §6.6a.
 */

type Settlement = { charged: number; settled_at: number; lines: { merchant: string }[] };
type Receipt = { net: number; returns?: Record<string, unknown>[]; owed?: number; [k: string]: unknown };

async function refunded(household = freshHousehold()) {
  const offer = await createConformingOffer({ household });
  await call("POST", `/offers/${offer.id}/present`, {});
  await decide(offer.id, {
    decisions: offer.candidates.map((c, i) => ({
      candidate: c.id,
      valence: i === 0 ? "kept" : "returned",
      ...(i === 0 ? { kept_as: "self" } : {}),
    })),
  });
  const settled = await call("POST", `/offers/${offer.id}/settle`, {});
  expect(settled.status).toBeLessThan(300);
  const settlement = settled.body as Settlement;
  const merchant = settlement.lines[0]!.merchant;
  const fields = { id: "refund-1", offer: offer.id, merchant, amount: 1, kind: "refund", note: "damaged", corrected_at: settlement.settled_at + 10 };
  const { offer: _, ...body } = fields;
  const made = await call("POST", `/offers/${offer.id}/corrections`, { ...body, signature: signByMerchant(canonicalCorrection(fields)) });
  expect(made.status).toBe(201);
  return { offer, settlement, merchant, correction: fields, household };
}

function record(fields: { correction: string; offer: string; merchant: string; state: string; note: string; at: number }, key?: Parameters<typeof signByMerchant>[1]) {
  const { offer: _, ...body } = fields;
  return { ...body, signature: signByMerchant(canonicalCorrectionReturn(fields), key) };
}

const post = (offer: string, body: unknown) => call("POST", `/offers/${offer}/returns`, body);
const receipt = async (offer: string, read = call) => (await read("GET", `/offers/${offer}/corrections`)).body as Receipt;
const errorOf = (r: { body: unknown }) => (r.body as { error?: string }).error;

describe("machine: a refund that came back is recorded beside its correction (§6.6a)", () => {
  test("the receipt carries no returns or owed until a record exists, then both, and the net does not move", async () => {
    // NOTE (2026-09-23): watched failing against origin/main's engine, which
    // has no `/returns` route; the 201 assertion failed with 404.
    const { offer, correction, merchant } = await refunded();
    const before = await receipt(offer.id);
    expect(Object.hasOwn(before, "returns")).toBe(false);
    expect(Object.hasOwn(before, "owed")).toBe(false);
    const returned = record({ correction: correction.id, offer: offer.id, merchant, state: "returned", note: "the issuer sent it back", at: correction.corrected_at + 1 });
    const r = await post(offer.id, returned);
    expect(r.status).toBe(201);
    const after = await receipt(offer.id);
    expect(after.returns).toEqual([{ ...returned, offer: offer.id }]);
    expect(after.owed).toBe(correction.amount);
    expect(after.net).toBe(before.net);
  });

  test("an identical retry is one record, answered 200, and any difference is return_conflict", async () => {
    const { offer, correction, merchant } = await refunded();
    const fields = { correction: correction.id, offer: offer.id, merchant, state: "returned", note: "", at: correction.corrected_at };
    expect((await post(offer.id, record(fields))).status).toBe(201);
    const again = await post(offer.id, record(fields));
    expect(again.status).toBe(200);
    expect(again.body).toEqual({ ...record(fields), offer: offer.id });
    const changed = await post(offer.id, record({ ...fields, note: "changed" }));
    expect(changed.status).toBe(409);
    expect(errorOf(changed)).toBe("return_conflict");
    expect((await receipt(offer.id)).returns?.length).toBe(1);
  });

  test("a repayment needs a return, may not predate it, and clears what is owed", async () => {
    const { offer, correction, merchant } = await refunded();
    const base = { correction: correction.id, offer: offer.id, merchant, note: "" };
    const orphan = await post(offer.id, record({ ...base, state: "repaid", at: correction.corrected_at + 5 }));
    expect(orphan.status).toBe(409);
    expect(errorOf(orphan)).toBe("not_returned");
    const early = await post(offer.id, record({ ...base, state: "returned", at: correction.corrected_at - 1 }));
    expect(early.status).toBe(422);
    expect(errorOf(early)).toBe("return_before_correction");
    expect((await post(offer.id, record({ ...base, state: "returned", at: correction.corrected_at + 10 }))).status).toBe(201);
    const backwards = await post(offer.id, record({ ...base, state: "repaid", at: correction.corrected_at + 5 }));
    expect(backwards.status).toBe(422);
    expect(errorOf(backwards)).toBe("return_before_correction");
    expect((await receipt(offer.id)).owed).toBe(correction.amount);
    expect((await post(offer.id, record({ ...base, state: "repaid", at: correction.corrected_at + 20 }))).status).toBe(201);
    const cleared = await receipt(offer.id);
    expect(cleared.owed).toBe(0);
    expect(cleared.returns?.map((x) => x.state)).toEqual(["returned", "repaid"]);
  });

  test("only a refund, only the correction's own merchant, only its signature", async () => {
    const { offer, settlement, correction, merchant } = await refunded();
    const fields = { id: "collection-1", offer: offer.id, merchant, amount: 1, kind: "collection", note: "", corrected_at: settlement.settled_at };
    const { offer: _, ...body } = fields;
    expect((await call("POST", `/offers/${offer.id}/corrections`, { ...body, signature: signByMerchant(canonicalCorrection(fields)) })).status).toBe(201);
    const onCollection = await post(offer.id, record({ correction: "collection-1", offer: offer.id, merchant, state: "returned", note: "", at: correction.corrected_at }));
    expect(onCollection.status).toBe(422);
    expect(errorOf(onCollection)).toBe("not_a_refund");

    const base = { correction: correction.id, offer: offer.id, state: "returned", note: "", at: correction.corrected_at };
    const other = await post(offer.id, record({ ...base, merchant: `${merchant}-other` }));
    expect(other.status).toBe(422);
    expect(errorOf(other)).toBe("not_merchant_of_record");

    const stranger = generateKeyPairSync("ed25519").privateKey;
    const forged = await post(offer.id, record({ ...base, merchant }, stranger));
    expect(forged.status).toBe(422);
    expect(errorOf(forged)).toBe("bad_signature");
    expect(Object.hasOwn(await receipt(offer.id), "returns")).toBe(false);
  });

  test("an unknown offer is not_found, an unknown correction is unknown_correction, and a bad shape is malformed", async () => {
    const { offer, correction, merchant } = await refunded();
    const good = record({ correction: correction.id, offer: offer.id, merchant, state: "returned", note: "", at: correction.corrected_at });
    const missing = await post("no-such-offer", good);
    expect(missing.status).toBe(404);
    expect(errorOf(missing)).toBe("not_found");
    const unknown = await post(offer.id, record({ correction: "refund-404", offer: offer.id, merchant, state: "returned", note: "", at: correction.corrected_at }));
    expect(unknown.status).toBe(404);
    expect(errorOf(unknown)).toBe("unknown_correction");
    for (const bad of [
      { ...good, state: "reversed" }, { ...good, note: "x".repeat(501) }, { ...good, at: -1 },
      { ...good, at: 1.5 }, { ...good, at: 2 ** 53 }, { ...good, discount: 1 },
    ]) {
      const r = await post(offer.id, bad);
      expect(r.status).toBe(400);
      expect(errorOf(r)).toBe("malformed");
    }
    expect(Object.hasOwn(await receipt(offer.id), "returns")).toBe(false);
  });
});

describe("exit: the records move with the household (§6.6a, §14)", () => {
  test("the export carries correction_returns, and the receiving host answers the same receipt", async () => {
    const household = freshHousehold();
    const { offer, correction, merchant } = await refunded(household);
    const returned = record({ correction: correction.id, offer: offer.id, merchant, state: "returned", note: "sent back", at: correction.corrected_at + 1 });
    expect((await post(offer.id, returned)).status).toBe(201);
    const path = `/households/${encodeURIComponent(household)}`;
    const exported = await call("GET", `${path}/export`);
    expect(exported.status).toBe(200);
    const node = exported.body as Record<string, any>;
    expect(node.format).toBe("valence-node/13");
    expect(node.correction_returns).toEqual({ [offer.id]: [{ ...returned, offer: offer.id }] });

    // Altered on the way, the whole move is refused and nothing arrives.
    const altered = structuredClone(node);
    altered.correction_returns[offer.id][0].note = "never returned";
    const refused = await callSecond("POST", `${path}/import`, altered);
    expect(refused.status).toBe(422);
    expect(errorOf(refused)).toBe("bad_signature");
    expect((await callSecond("GET", `/offers/${offer.id}`)).status).toBe(404);

    // Naming a correction the body does not carry is unscoped.
    const unscoped = await callSecond("POST", `${path}/import`, { ...node, corrections: {} });
    expect(unscoped.status).toBe(422);
    expect(errorOf(unscoped)).toBe("unscoped_return");

    // A current archive without the field is refused rather than read as none.
    const { correction_returns: _, ...without } = node;
    expect((await callSecond("POST", `${path}/import`, without)).status).toBe(400);

    const moved = await callSecond("POST", `${path}/import`, node);
    expect(moved.status).toBe(201);
    expect(await receipt(offer.id, callSecond)).toEqual(await receipt(offer.id));
  });
});
