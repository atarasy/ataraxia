import { beforeEach, describe, expect, test } from "bun:test";
import { sign } from "node:crypto";
import {
  BASE,
  RP_ID,
  keyForHousehold,
  HAS_PHYSICAL,
  LINEAGE_EDGE,
  PRODUCTS,
  SECOND_HOST,
  SECOND_RP_ID,
  call,
  callSecond,
  offerBody,
  ensureRegistered,
  ownMandate,
  signMandate,
  conformingOffer,
  createConformingOffer,
  decide,
  freshHousehold,
  mandateOf,
  presenter,
  signDecisions,
  soon,
} from "../lib/probe.js";

/**
 * Clauses 43, 52 and 53.
 *
 * A household exports what it holds, moves its node to another host intact,
 * and recovery is a power separate from reading.
 *
 * The suite runs against two hosts of the same implementation. With one, the
 * strongest question available is whether a file was produced, and clause 43
 * asks for something else: that the data be held in a form the customer can
 * export **in full**. Fullness is not a field list, because a surface added
 * later can be missing from the export while the export still matches its own
 * schema. So the question here is whether the second host answers as the first
 * did.
 */

// Each test moves a household of its own. Since exploration became what a
// household has never been offered (clause 26), a second offer to the same
// household marking every product as exploration is refused, so the fixed
// household cannot be seeded twice.
let current = freshHousehold();
beforeEach(() => {
  current = freshHousehold();
});
const household = () => current;

async function seedSomethingToMove() {
  const offer = await createConformingOffer({ household: household() });
  await call("POST", `/offers/${offer.id}/present`, {});
  await call("POST", `/candidates/${offer.candidates[0]!.id}/note`, {
    author: household(),
    text: "kept for the smell",
    shared_with: [],
  });
  await decide(offer.id, {
    decisions: offer.candidates.map((c, i) => ({
      candidate: c.id,
      valence: i === 0 ? "kept" : "returned",
      ...(i === 0 ? { kept_as: "self" } : {}),
    })),
  });
  await call("POST", `/offers/${offer.id}/settle`, {});
  return offer;
}

describe("exit: the export (clause 43)", () => {
  test("the export names its format and its version", async () => {
    // NOTE (mutation check, 2026-09-09): export_no_format blanked the
    // format string. Clause 50 permits forks, and a fork has to know what
    // it is holding. This assertion failed.
    // A format only the implementation that wrote it can read is not a format.
    // Clause 50 permits forks, and a fork has to know what it is holding.
    const exported = await call(
      "GET",
      `/households/${encodeURIComponent(household())}/export`
    );
    expect(exported.status).toBe(200);
    const node = exported.body as { format: string };
    expect(typeof node.format).toBe("string");
    expect(node.format).toMatch(/\/\d+$/);
  });

  test("the export carries what the surfaces withhold", async () => {
    // NOTE (mutation check, 2026-09-09): export_only_what_surfaces_show built
    // the export from the giver's surface instead of from the record. This
    // assertion failed on the lineage. The giver's screen deliberately holds
    // no list of gifts sent, and a member who moves hosts must not lose their
    // own record of what they gave because of it.
    await call("POST", "/lineage", LINEAGE_EDGE);
    const exported = await call(
      "GET",
      `/households/${encodeURIComponent(LINEAGE_EDGE.from as string)}/export`
    );
    expect(exported.status).toBe(200);
    const node = exported.body as { lineage: { from: string }[] };
    const outgoing = node.lineage.filter(
      (e) => e.from === (LINEAGE_EDGE.from as string)
    );
    expect(outgoing.length).toBeGreaterThan(0);
  });

  test("the export carries offers, settlements, notes and receipts", async () => {
    // NOTE (mutation check, 2026-09-09): export_drops_settlements left the
    // settlements out. The file was still produced and still matched its
    // own schema. This assertion failed.
    await seedSomethingToMove();
    const exported = await call(
      "GET",
      `/households/${encodeURIComponent(household())}/export`
    );
    const node = exported.body as {
      offers: unknown[];
      settlements: unknown[];
      notes: unknown[];
      receipts: unknown[];
    };
    expect(node.offers.length).toBeGreaterThan(0);
    expect(node.settlements.length).toBeGreaterThan(0);
    expect(node.notes.length).toBeGreaterThan(0);
    expect(Array.isArray(node.receipts)).toBe(true);
  });
});

describe("exit: the move (clause 52)", () => {

  test("what has already confirmed an offer moves with the node (§10.5)", async () => {
    // NOTE (mutation check, 2026-09-11): export_drops_confirmations leaves the
    // register out. This assertion failed: the export carried the offer and
    // no record of what had confirmed it.
    //
    // §10.5 says a confirmation is used once, and that rule lives in what a
    // host remembers rather than in what a signature says. So a move that
    // carried the offers and not the memory would reset it: an adversarial
    // pass measured a set withdrawn on one host and put back on a second with
    // the confirmation captured on the first, and the person who changed hosts
    // left the protection behind.
    //
    // **What this probe does not do** is replay it. Reaching that state needs
    // the set taken back, which needs a cooling window (§16.5) that this
    // suite's mandate does not carry; `permissions/` holds the replay probe
    // against one host. Here the question is whether the register crosses,
    // which is the half the move is about.
    const house = encodeURIComponent(household());
    const offer = await createConformingOffer({ household: household() });
    await call("POST", `/offers/${offer.id}/present`, {});
    // One line kept, so that the set owes a settlement and stays `decided`:
    // since question 62 a set with every line returned settles at once.
    const decisions = offer.candidates.map((c, i) => (i === 0
      ? { candidate: c.id, valence: "kept" as const, kept_as: "self" as const }
      : { candidate: c.id, valence: "returned" as const }));
    const signature = signDecisions(offer.id, decisions);
    expect((await call("POST", `/offers/${offer.id}/decisions`, { decisions, signature })).status).toBe(200);

    const exported = await call("GET", `/households/${house}/export`);
    expect(exported.status).toBe(200);
    const carried = (exported.body as { confirmations?: Record<string, string[]> }).confirmations;
    expect(Object.keys(carried ?? {})).toContain(offer.id);
    expect((carried ?? {})[offer.id]?.length).toBeGreaterThan(0);
    // §14.2 and §6.4, question 57, rebuilt 2026-09-19. A decided set whose
    // settlement has not happened still has money to move, and its reserve is
    // on this host, so the move leaves it here and says so. The register goes on
    // being exported, which is what the mutation above breaks; it is the
    // receiving host that no longer takes an offer the register would guard.
    const moved = await callSecond("POST", `/households/${house}/import`, exported.body);
    expect(moved.status).toBe(201);
    expect((moved.body as { left_behind: string[] }).left_behind).toContain(offer.id);
    expect((await callSecond("GET", `/offers/${offer.id}`)).status).toBe(404);
  });

  test("an offer that owes nothing is settled before it moves, and one that arrives unsettled settles only where its reserve is (§14.2, §6.4)", async () => {
    // NOTE (mutation check, 2026-09-19): settle_without_a_reservation drops the
    // refusal at the receiving host. The 409 assertion failed with 200: the
    // second host wrote a settlement of 0 with a receipt of its own.
    //
    // Question 57. An expired offer with every line returned owes nothing, so
    // it travels. A fifth refutation pass then settled it at 0 on both hosts:
    // one offer, two settlements, two receipts. Question 62 now settles such
    // an offer at nothing before the export carries it, and the receiving
    // host refuses to settle an offer it holds no reserve for, which is the
    // guard for a body from a host that did not.
    const house = encodeURIComponent(household());
    const offer = await createConformingOffer({ household: household(), expires_at: soon(1_500) });
    expect((await call("POST", `/offers/${offer.id}/present`, {})).status).toBe(200);
    await new Promise((resolve) => setTimeout(resolve, 2_000));
    expect(((await call("GET", `/offers/${offer.id}`)).body as { state: string }).state).toBe("expired");

    const exported = await call("GET", `/households/${house}/export`);
    // NOTE (mutation check, 2026-09-19): export_leaves_what_owes_nothing
    // stops the export settling first. This assertion failed with "expired".
    expect(((await call("GET", `/offers/${offer.id}`)).body as { state: string }).state).toBe("settled");
    const body = exported.body as { offers: { id: string; state: string }[]; settlements: { offer: string }[] };
    expect(body.offers.find((o) => o.id === offer.id)?.state).toBe("settled");

    // The body a host from before question 62 would send: the offer expired
    // and unsettled.
    const older = {
      ...body,
      offers: body.offers.map((o) => (o.id === offer.id ? { ...o, state: "expired" } : o)),
      settlements: body.settlements.filter((st) => st.offer !== offer.id),
    };
    const moved = await callSecond("POST", `/households/${house}/import`, older);
    expect(moved.status).toBe(201);
    expect((moved.body as { left_behind: string[] }).left_behind).not.toContain(offer.id);
    const there = await callSecond("POST", `/offers/${offer.id}/settle`, {});
    expect(there.status).toBe(409);
    expect((there.body as { error: string }).error).toBe("no_reservation");
    expect((await callSecond("GET", `/offers/${offer.id}/settlement`)).status).toBe(404);
  });

  test("a giver's move names the gift it pays for that is still in flight, and carries what it paid without the lines (§12, §14.2)", async () => {
    // NOTE (mutation check, 2026-09-19): gifts_in_flight_unnamed and
    // export_drops_payments. The first failed with a left_behind of [] and
    // the second with payments of [].
    //
    // Question 61. A settlement lives with the recipient's offer, so a giver
    // that moved took no record of what it paid, and its move named nothing
    // left behind while its reserve was held at the old host. Measured by the
    // fifth refutation pass over question 57.
    const giver = freshHousehold();
    const giverPath = encodeURIComponent(giver);
    const offer = await createConformingOffer({ household: household(), purpose: "ceremonial", giver });
    expect((await call("POST", `/offers/${offer.id}/present`, {})).status).toBe(200);

    const inFlight = await call("GET", `/households/${giverPath}/export`);
    const moved = await callSecond("POST", `/households/${giverPath}/import`, inFlight.body);
    expect(moved.status).toBe(201);
    expect((moved.body as { left_behind: string[] }).left_behind).toContain(offer.id);

    const decisions = offer.candidates.map((c, i) => (i === 0
      ? { candidate: c.id, valence: "kept" as const, kept_as: "self" as const }
      : { candidate: c.id, valence: "returned" as const }));
    const signature = signDecisions(offer.id, decisions);
    expect((await call("POST", `/offers/${offer.id}/decisions`, { decisions, signature })).status).toBe(200);
    const settled = await call("POST", `/offers/${offer.id}/settle`, {});
    expect(settled.status).toBe(200);
    const settlement = settled.body as { charged: number; receipt: string; payer: string };
    expect(settlement.payer).toBe(giver);

    const afterBody = (await call("GET", `/households/${giverPath}/export`)).body;
    const after = afterBody as { payments: Record<string, unknown>[] };
    const paid = after.payments.find((p) => p.offer === offer.id);
    expect(paid).toBeDefined();
    expect(paid!.charged).toBe(settlement.charged);
    expect(paid!.receipt).toBe(settlement.receipt);
    // Clause 24: what the recipient chose stays with the recipient.
    expect(Object.keys(paid!).sort()).toEqual(["charged", "offer", "presenter", "receipt", "settled_at"]);

    // NOTE (mutation check, 2026-09-19): import_drops_payments. The payment
    // arrives with the giver, which a second refutation pass noted only the
    // engine's own unit test had asked.
    expect((await callSecond("POST", `/households/${giverPath}/import`, afterBody)).status).toBe(201);
    const there = (await callSecond("GET", `/households/${giverPath}/export`)).body as { payments: Record<string, unknown>[] };
    expect(there.payments.find((p) => p.offer === offer.id)?.receipt).toBe(settlement.receipt);
  });

  test("a second move brings what the first left behind, and writes nothing the first already carried (§14.2)", async () => {
    // Question 59, decided 2026-09-19. A move leaves behind what has not
    // finished moving money (question 57). Once that settles, moving again
    // from the same host carries every offer the first move already brought,
    // and the receiving host refused those `409`, so the record of what was
    // left behind never arrived. An offer held exactly as it arrives has been
    // carried already, as an edge and a mandate have.
    const house = encodeURIComponent(household());
    // Two offers to one household need products it has not been offered
    // (clause 26), so the finished one takes the first two and the pending
    // one the rest.
    const make = async (products: string[]) => {
      const created = await call("POST", "/offers", offerBody(
        products.map((product) => ({ product, predicted_conversion: 0.05, is_exploration: true })),
        { household: household() }));
      expect(created.status).toBe(201);
      const offer = created.body as { id: string; candidates: { id: string }[] };
      expect((await call("POST", `/offers/${offer.id}/present`, {})).status).toBe(200);
      return offer;
    };
    const finished = await make(PRODUCTS.slice(0, 2));
    await call("POST", `/candidates/${finished.candidates[0]!.id}/note`, { author: household(), text: "kept for the smell", shared_with: [] });
    await decide(finished.id, { decisions: [
      { candidate: finished.candidates[0]!.id, valence: "kept", kept_as: "self" },
      { candidate: finished.candidates[1]!.id, valence: "returned" },
    ] });
    expect((await call("POST", `/offers/${finished.id}/settle`, {})).status).toBe(200);
    const pending = await make(PRODUCTS.slice(2));
    const decisions = pending.candidates.map((c, i) => (i === 0
      ? { candidate: c.id, valence: "kept" as const, kept_as: "self" as const }
      : { candidate: c.id, valence: "returned" as const }));
    const signature = signDecisions(pending.id, decisions);
    expect((await call("POST", `/offers/${pending.id}/decisions`, { decisions, signature })).status).toBe(200);

    const first = await callSecond("POST", `/households/${house}/import`, (await call("GET", `/households/${house}/export`)).body);
    expect(first.status).toBe(201);
    expect((first.body as { left_behind: string[] }).left_behind).toContain(pending.id);

    const settled = await call("POST", `/offers/${pending.id}/settle`, {});
    expect(settled.status).toBe(200);
    const second = await callSecond("POST", `/households/${house}/import`, (await call("GET", `/households/${house}/export`)).body);
    expect(second.status).toBe(201);
    expect((second.body as { left_behind: string[] }).left_behind).not.toContain(pending.id);
    expect(((await callSecond("GET", `/offers/${pending.id}`)).body as { state: string }).state).toBe("settled");
    const there = await callSecond("GET", `/offers/${pending.id}/settlement`);
    expect(there.status).toBe(200);
    expect((there.body as { receipt: string }).receipt).toBe((settled.body as { receipt: string }).receipt);

    // The note on the offer the first move carried arrives once, not twice.
    const node = (await callSecond("GET", `/households/${house}/export`)).body as { notes: { candidate: string }[] };
    expect(node.notes.filter((n) => n.candidate === finished.candidates[0]!.id)).toHaveLength(1);
  });

  test("a second move that differs from what the first carried is refused, and writes nothing (§14.2)", async () => {
    // Question 59. Treating a held offer as carried reaches its rows too: an
    // import is a claim nobody authenticates, so a body repeating an offer
    // must not be a way to change what the receiving host holds of it.
    const house = encodeURIComponent(household());
    const finished = await seedSomethingToMove();
    const exported = (await call("GET", `/households/${house}/export`)).body as {
      settlements: { offer: string; charged: number }[];
      notes: { candidate: string; text: string }[];
    };
    expect((await callSecond("POST", `/households/${house}/import`, exported)).status).toBe(201);
    const before = (await callSecond("GET", `/households/${house}/export`)).body as Record<string, unknown>;

    const recharged = {
      ...exported,
      settlements: exported.settlements.map((st) => (st.offer === finished.id ? { ...st, charged: st.charged + 1_000 } : st)),
    };
    const refused = await callSecond("POST", `/households/${house}/import`, recharged);
    expect(refused.status).toBe(409);
    expect((refused.body as { error: string }).error).toBe("bad_state");

    const planted = {
      ...exported,
      notes: [...exported.notes, { ...exported.notes[0]!, text: "written by whoever posted the body" }],
    };
    expect((await callSecond("POST", `/households/${house}/import`, planted)).status).toBe(409);

    const after = (await callSecond("GET", `/households/${house}/export`)).body as Record<string, unknown>;
    expect(after.settlements).toEqual(before.settlements);
    expect(after.notes).toEqual(before.notes);
  });

  test("a mandate version signed for one host does not record at another, and the household signs it again there (§16.1)", async () => {
    // Question 58, decided 2026-09-19. The canonical form named no host, so a
    // raw signature made for one host verified at every host, and whoever had
    // relayed a submission once could record any version the household ever
    // signed at a host holding none of its history. A fourth refutation pass
    // measured three routes to it that no version rule closes. The form now
    // names itself and the host, which is the relying party the host asserts
    // for; the second host here asserts for a relying party of its own.
    const { household: house, mandate } = await ownMandate();
    await ensureRegistered(SECOND_HOST, house);
    const signedHere = signMandate(mandate, true);
    const replayed = await callSecond("POST", "/_node/mandates", { ...mandate, signatures: signedHere });
    expect(replayed.status).toBe(422);
    expect((replayed.body as { error: string }).error).toBe("bad_signature");
    expect((await callSecond("GET", `/_node/mandates/${encodeURIComponent(mandate.id)}`)).status).toBe(404);

    // The same terms signed for the second host record there.
    const signedThere = signMandate(mandate, true, SECOND_RP_ID);
    expect((await callSecond("POST", "/_node/mandates", { ...mandate, signatures: signedThere })).status).toBe(201);
  });

  test("an import refused at any row writes none of it, and the same move can be retried (§14.2)", async () => {
    // NOTE (mutation check, 2026-09-15): import_writes_before_verifying drops
    // the check of the whole body. The 404 assertion failed with 200: the offer
    // stood on the second host after the import was refused.
    //
    // Question 51. The route wrote a body row by row and stopped at the first
    // refusal, so a move refused at an edge kept the offers written before it,
    // lost the collections and mandates after it, and could not be retried,
    // because the retry met those offers as already held. An edge whose
    // giver's key the receiving host has not attested is enough to refuse, so
    // that happened with nobody at fault. §14.2 says the whole import is
    // refused; this probe holds the reference to that sentence.
    const house = encodeURIComponent(household());
    const offer = await createConformingOffer({ household: household() });
    await call("POST", `/offers/${offer.id}/present`, {});
    const decisions = offer.candidates.map((c) => ({ candidate: c.id, valence: "returned" as const }));
    const signature = signDecisions(offer.id, decisions);
    expect((await call("POST", `/offers/${offer.id}/decisions`, { decisions, signature })).status).toBe(200);
    // Settled, so it has finished moving money and travels (§14.2, question 57).
    expect((await call("POST", `/offers/${offer.id}/settle`, {})).status).toBe(200);

    const exported = await call("GET", `/households/${house}/export`);
    const node = exported.body as { lineage: unknown[]; confirmations: Record<string, string[]> };
    const refused = await callSecond("POST", `/households/${house}/import`, {
      ...node,
      lineage: [{ ...LINEAGE_EDGE, id: `edge-refused-${offer.id}`, from: household(), signature: "not-a-signature" }],
    });
    expect(refused.status).toBe(422);
    expect((refused.body as { error: string }).error).toBe("bad_signature");

    expect((await callSecond("GET", `/offers/${offer.id}`)).status).toBe(404);
    const nothing = (await callSecond("GET", `/households/${house}/export`)).body as Record<string, unknown>;
    for (const field of ["offers", "settlements", "lineage", "collections", "mandates", "deliveries"]) {
      expect(((nothing[field] as unknown[] | undefined) ?? []).length).toBe(0);
    }

    const retried = await callSecond("POST", `/households/${house}/import`, node);
    expect(retried.status).toBe(201);
    expect(((await callSecond("GET", `/offers/${offer.id}`)).body as { state: string }).state).toBe("settled");
  });

  test("a set not yet settled does not arrive, and a register cannot be planted for it (§16.5, §14.2)", async () => {
    // NOTE (mutation check, 2026-09-19): this probe no longer catches
    // withdraw_a_set_nobody_signed. It built a decided set that arrived by a
    // move without its register, and question 57 rebuilt made that state
    // unreachable: a decided set does not move. A fourth refutation pass
    // measured the mutation caught by nothing afterwards, and the engine's
    // `names` unit test now reaches the guard by planting the row an older
    // host would hold.
    //
    // §14 and §16.5, question 50, decided 2026-09-15. The export carries the
    // register of what has confirmed each offer, and an offer it does not name
    // arrives with no confirmation recorded. Withdrawing that set would let
    // it be decided again with the confirmation it arrived without (§10.5),
    // so the route refuses it and the household loses the window on it.
    // Until question 50 §14 did not name the field, and this probe was held
    // back rather than bind other implementations to it. §16.5 now decides
    // `not_withdrawable` before the mandate, so the suite's mandate having no
    // window does not change which refusal is owed.
    const house = encodeURIComponent(household());
    const offer = await createConformingOffer({ household: household() });
    await call("POST", `/offers/${offer.id}/present`, {});
    // One line kept, so that the set owes a settlement and stays `decided`
    // (question 62 settles a set with every line returned at once).
    const decisions = offer.candidates.map((c, i) => (i === 0
      ? { candidate: c.id, valence: "kept" as const, kept_as: "self" as const }
      : { candidate: c.id, valence: "returned" as const }));
    const signature = signDecisions(offer.id, decisions);
    expect((await call("POST", `/offers/${offer.id}/decisions`, { decisions, signature })).status).toBe(200);

    const exported = await call("GET", `/households/${house}/export`);
    expect(exported.status).toBe(200);
    // A /5 export, which §14 lets carry no register: the shape a host built
    // from the text before question 50 would have sent.
    const node = exported.body as { format: string; confirmations?: Record<string, string[]> };
    node.format = "valence-node/5";
    delete node.confirmations;
    // §14.2 and §6.4, question 57, rebuilt 2026-09-19. **A decided set whose
    // settlement has not happened does not arrive at all**, so the state this
    // probe was written for, a set here with no confirmation behind it, is no
    // longer reachable through a move: the set stays where its reserve is.
    const arriving = await callSecond("POST", `/households/${house}/import`, node);
    expect(arriving.status).toBe(201);
    expect((arriving.body as { left_behind: string[] }).left_behind).toContain(offer.id);
    expect((await callSecond("GET", `/offers/${offer.id}`)).status).toBe(404);

    // NOTE (mutation check, 2026-09-15): import_confirmations_unscoped accepts
    // the register below. This assertion failed with 201.
    //
    // §14.2. A second import carrying nothing but a register entry for the
    // offer this host already holds. A refutation pass measured it unlocking
    // the withdrawal above, after which the signature captured on the first
    // host decided the set again.
    const planted = await callSecond("POST", `/households/${house}/import`, {
      format: "valence-node/6",
      confirmations: { [offer.id]: ["planted"] },
    });
    expect(planted.status).toBe(422);
    // NOTE (mutation check, 2026-09-15): import_register_shape_unchecked lets a
    // register whose value is not a list through. This assertion failed with
    // 422: the entry reached the scoping check instead of being refused as
    // malformed, and an offer carried with it would have arrived unregistered.
    const misshaped = await callSecond("POST", `/households/${house}/import`, {
      format: "valence-node/6",
      confirmations: { [offer.id]: "planted" },
    });
    expect(misshaped.status).toBe(400);
  });


  test("an import adds what this host does not hold, and changes nothing it does (§14.2)", async () => {
    // NOTE (mutation check, 2026-09-11): import_overwrites_an_offer lets it
    // through. This assertion failed with 201: the offer this host held at
    // `presented` read `decided` afterwards, with every candidate kept.
    //
    // Found by measuring rather than by reading: a node handed to a host said
    // an offer was decided and every candidate kept, with no signature
    // anywhere, and settling it charged for goods nobody agreed to. Clause 35
    // makes a confirmation the person's signature and §10.5 refuses a decided
    // set without one; this route walked past both.
    //
    // Verifying the decision instead was ruled out the same day: an assertion
    // names the host it was made for, so no host can verify a confirmation
    // made at another. A move lands on a host holding none of these offers,
    // so it is untouched by this; what is refused is the other thing the
    // route could do.
    const house = encodeURIComponent(household());
    const offer = await createConformingOffer({ household: household() });
    await call("POST", `/offers/${offer.id}/present`, {});
    const exported = await call("GET", `/households/${house}/export`);
    expect(exported.status).toBe(200);
    const node = exported.body as {
      offers: { id: string; state: string; candidates: { valence: string; kept_as: string | null; decided_at: number | null }[] }[];
    };
    for (const o of node.offers) {
      if (o.id !== offer.id) continue;
      // Settled, so it is one a move carries and reaches the rule below
      // (§14.2, question 57); a forged decided set would be left behind.
      o.state = "settled";
      for (const c of o.candidates) {
        c.valence = "kept";
        c.kept_as = "self";
        c.decided_at = Date.now();
      }
    }
    // The same host it came from, which is not a move.
    const back = await call("POST", `/households/${house}/import`, node);
    expect(back.status).toBe(409);
    expect((back.body as { error: string }).error).toBe("bad_state");
    const read = await call("GET", `/offers/${offer.id}`);
    expect((read.body as { state: string }).state).toBe("presented");
  });

  test("the second host answers as the first did", async () => {
    // NOTE (mutation check, 2026-09-09): export_drops_settlements left the
    // settlements out of the export. The schema was still valid and the file
    // was still produced; this assertion failed because the second host
    // answered a question differently. That is the whole reason the probe
    // compares answers rather than field names.
    // Read the presenter before anything is exported: the helper creates an
    // offer to read it from, and an offer created after the export is a
    // difference between the hosts that the move did not make.
    const who = await presenter();
    const offer = await seedSomethingToMove();

    // A ledger with no rows moves correctly by doing nothing, so grant one.
    const opened = await call(
      "POST",
      `/households/${encodeURIComponent(household())}/actions`,
      { describes: "drafting next week's order", expires_at: Date.now() + 60_000 }
    );
    expect(opened.status).toBe(201);
    const granted = await call(
      "POST",
      `/households/${encodeURIComponent(household())}/permissions`,
      {
        kind: "party",
        grantee: "carrier-a",
        scope: ["delivery_window"],
        purpose: "to leave the box when someone is home",
        expires_at: Date.now() + 60_000,
        asked_from: (opened.body as { id: string }).id,
      }
    );
    expect(granted.status).toBe(201);

    const exported = await call(
      "GET",
      `/households/${encodeURIComponent(household())}/export`
    );
    expect(exported.status).toBe(200);

    const imported = await callSecond(
      "POST",
      `/households/${encodeURIComponent(household())}/import`,
      exported.body
    );
    expect(imported.status).toBe(201);

    // The same questions, asked of both hosts. The settlement is on the list
    // because leaving it off is what let a mutation drop settlements from the
    // export while both hosts still answered alike: nothing asked.
    //
    // The permission ledger joined this list on 2026-09-09, and the reason is
    // the one at the head of this file. The ledger, the queries and the
    // mandates were all built that day, after this probe was written, and none
    // of them reached the export or this list. A member who moved kept their
    // offers and lost every permission they had granted, and the suite stayed
    // green because the four paths below were all anyone asked. A list is the
    // thing this probe exists to avoid depending on, and it is still a list;
    // what can be done is to add to it whenever a surface is added.
    for (const path of [
      `/offers/${offer.id}`,
      `/offers/${offer.id}/settlement`,
      `/offers?household=${encodeURIComponent(household())}&presenter=${encodeURIComponent(who)}`,
      `/households/${encodeURIComponent(household())}/receipts`,
      `/households/${encodeURIComponent(household())}/permissions`,
    ]) {
      const first = await call("GET", path);
      const second = await callSecond("GET", path);
      expect(second.status).toBe(first.status);
      expect(second.body).toEqual(first.body);
    }
  });

  test("a lineage edge still resolves after the move", async () => {
    // NOTE (mutation check, 2026-09-09): export_only_what_surfaces_show
    // built the export from the giver's surface, which holds no outgoing
    // edges. The circle was empty on the second host. This assertion
    // failed.
    // Edges name keys, not hosts. An edge that stopped resolving because its
    // subject moved would make the network a function of who is hosting whom.
    await call("POST", "/lineage", LINEAGE_EDGE);
    const giver = LINEAGE_EDGE.from as string;

    const exported = await call(
      "GET",
      `/households/${encodeURIComponent(giver)}/export`
    );
    await callSecond(
      "POST",
      `/households/${encodeURIComponent(giver)}/import`,
      exported.body
    );

    const before = await call(
      "GET",
      `/lineage/circle?viewer=${encodeURIComponent(giver)}`
    );
    const after = await callSecond(
      "GET",
      `/lineage/circle?viewer=${encodeURIComponent(giver)}`
    );
    expect(after.status).toBe(200);
    // Every edge the first host served is served by the second. Not the same
    // count: other probes in this suite post edges of their own, and a count
    // comparison made this probe fail for a reason that has nothing to do with
    // the move. What clause 52 asks is that nothing stops resolving.
    const key = (e: { from: string; to: string; merchant: string }) =>
      `${e.from}|${e.to}|${e.merchant}`;
    const beforeEdges = (before.body as {
      edges: { from: string; to: string; merchant: string }[];
    }).edges;
    const afterEdges = new Set(
      (after.body as {
        edges: { from: string; to: string; merchant: string }[];
      }).edges.map(key)
    );
    expect(beforeEdges.length).toBeGreaterThan(0);
    for (const edge of beforeEdges) {
      expect(afterEdges.has(key(edge))).toBe(true);
    }
  });

  test("a mandate that arrives by a move is not a mandate this host holds (§14.2, question 56)", async () => {
    // NOTE (mutation check, 2026-09-18): import_mandate_is_a_mandate and
    // claim_is_held_for_the_household. The first writes the arriving row as a
    // mandate, so `GET /_node/mandates/{id}` answers it; the second counts it
    // among what the household holds, so every offer naming any other label is
    // refused and one unsigned POST freezes a household that has never moved.
    //
    // §14.2, question 56, decided 2026-09-18. This route authenticates nobody,
    // so what it carries is a claim: measured on the reference the day it was
    // decided, an unsigned import placed a second mandate under a household's
    // own identifier with a ceiling of 9,999,999 beside its real one at 0.
    const house = freshHousehold();
    const id = mandateOf(house);
    const arriving = await callSecond("POST", `/households/${encodeURIComponent(house)}/import`, {
      format: "valence-node/6",
      mandates: [{ id, household: house, ceiling_out_of_network: 9_999_999, co_signers: [], ceiling_daily: null, cooling_seconds: null, lapses_at: soon(600_000), version: 1 }],
    });
    expect(arriving.status).toBe(201);
    // It is not a mandate this host holds, so the hub does not answer for it.
    const read = await callSecond("GET", `/_node/mandates/${encodeURIComponent(id)}`);
    expect(read.status).toBe(404);
    // And it does not make this household one that has set a protection here,
    // which is what would let a stranger refuse every offer it is ever made.
    const has = await callSecond("GET", `/_node/mandates?household=${encodeURIComponent(house)}`);
    expect(has.status).toBe(200);
    expect((has.body as { has: boolean }).has).toBe(false);
  });

  test("an import names a household that is a key, and carries mandates of that household's (§13.2)", async () => {
    // NOTE (mutation check, 2026-09-16): import_household_shape_unchecked and
    // import_offer_mandate_unscoped. Each case below answered 201 under its
    // own mutation.
    //
    // §13.2, question 55, decided 2026-09-16. An import does not pass through
    // the route that creates an offer, so without this the shape holds for an
    // offer made here and not for one that arrived, and a decided set that
    // arrived would go on being verified against whatever key its mandate's
    // name resolved to.
    const plain = await callSecond(
      "POST",
      `/households/${encodeURIComponent("household-not-a-key")}/import`,
      { format: "valence-node/6", offers: [] }
    );
    expect(plain.status).toBe(422);
    expect((plain.body as { error: string }).error).toBe("name_is_not_the_key");

    const house = freshHousehold();
    const other = freshHousehold();
    const foreign = await callSecond("POST", `/households/${encodeURIComponent(house)}/import`, {
      format: "valence-node/6",
      offers: [{ id: `o-q55-${Math.random().toString(36).slice(2)}`, household: house, mandate: mandateOf(other), candidates: [{ id: "c-q55" }] }],
    });
    expect(foreign.status).toBe(422);
    expect((foreign.body as { error: string }).error).toBe("name_is_not_the_key");

    const mandates = await callSecond("POST", `/households/${encodeURIComponent(house)}/import`, {
      format: "valence-node/6",
      mandates: [{ id: mandateOf(other), household: house, ceiling_out_of_network: 1, co_signers: [], ceiling_daily: null, cooling_seconds: null, lapses_at: soon(600_000), version: 1 }],
    });
    expect(mandates.status).toBe(422);
    expect((mandates.body as { error: string }).error).toBe("name_is_not_the_key");

    // NOTE (mutation check, 2026-09-16): import_cosigner_name_unchecked.
    // §16.1. A co-signer is named by the key it signs with, here as where one
    // is recorded: a loosening of an arriving mandate is checked against
    // whatever key is registered under the name it carries.
    const cosigner = await callSecond("POST", `/households/${encodeURIComponent(house)}/import`, {
      format: "valence-node/6",
      mandates: [{ id: mandateOf(house), household: house, ceiling_out_of_network: 1, co_signers: ["mum"], ceiling_daily: null, cooling_seconds: null, lapses_at: soon(600_000), version: 1 }],
    });
    expect(cosigner.status).toBe(422);
    expect((cosigner.body as { error: string }).error).toBe("name_is_not_the_key");
  });

  test("an import verifies the edges it is handed and refuses another household's offers", async () => {
    // NOTE (mutation check, 2026-09-09): import_trusts_everything wrote
    // whatever the export said. Both assertions failed with 201: an edge
    // with a broken signature entered the second host's lineage, and an
    // offer belonging to one household was written under another's path.
    // The refutation pass measured a bogus edge blocking a product as
    // exploration for the household it named.
    await call("POST", "/lineage", LINEAGE_EDGE);
    const giver = LINEAGE_EDGE.from as string;
    const exported = await call("GET", `/households/${encodeURIComponent(giver)}/export`);
    const node = exported.body as { lineage: { signature: string }[] };
    expect(node.lineage.length).toBeGreaterThan(0);
    const tampered = {
      ...node,
      lineage: node.lineage.map((e) => ({ ...e, signature: "not-a-signature" })),
    };
    const badEdge = await callSecond("POST", `/households/${encodeURIComponent(giver)}/import`, tampered);
    expect(badEdge.status).toBe(422);

    const offer = await seedSomethingToMove();
    void offer;
    const mine = await call("GET", `/households/${encodeURIComponent(household())}/export`);
    const elsewhere = await callSecond("POST", `/households/${encodeURIComponent(freshHousehold())}/import`, mine.body);
    expect(elsewhere.status).toBe(422);
  });

  test("an export in an unknown format is refused rather than half read", async () => {
    // NOTE (mutation check, 2026-09-09): import_accepts_anything accepted
    // any document. An import that reads what it does not understand loses
    // the half it could not parse, silently. This assertion failed.
    const refused = await callSecond(
      "POST",
      `/households/${encodeURIComponent(household())}/import`,
      { format: "something-else/9", offers: [] }
    );
    expect([400, 422]).toContain(refused.status);
  });
});

describe("exit: recovery is not reading (clause 53)", () => {
  const HOUSE = "household-recovery-probe";

  test("a recoverer cannot be named without a channel it does not control", async () => {
    // NOTE (mutation check, 2026-09-09): recoverer_owns_every_channel dropped
    // the requirement. This assertion failed with 201. A recoverer holding the
    // only channel can recover in silence, and clause 53's notice becomes
    // decorative.
    const refused = await call("POST", "/_node/channels", {
      household: HOUSE,
      channels: [{ channel: "recoverer-sms", controlled_by_recoverer: true }],
    });
    expect([400, 422]).toContain(refused.status);

    const accepted = await call("POST", "/_node/channels", {
      household: HOUSE,
      channels: [
        { channel: "recoverer-sms", controlled_by_recoverer: true },
        { channel: "own-email", controlled_by_recoverer: false },
      ],
    });
    expect(accepted.status).toBe(201);
  });

  test("recovery is logged, and the log names who did it", async () => {
    // NOTE (mutation check, 2026-09-09): recovery_not_logged stopped
    // writing the log. Clause 53 asks for a record the person can read
    // afterwards. This assertion failed.
    await call("POST", "/_node/channels", {
      household: HOUSE,
      channels: [{ channel: "own-email", controlled_by_recoverer: false }],
    });
    await call("POST", "/_node/recoverers", {
      household: HOUSE,
      keys: ["key-recoverer-1"],
    });

    const recovered = await call(`POST`, `/households/${HOUSE}/recoveries`, {
      by: "key-recoverer-1",
    });
    expect(recovered.status).toBe(201);

    const log = await call("GET", `/households/${HOUSE}/recoveries`);
    expect(log.status).toBe(200);
    const rows = (log.body as { recoveries: { initiated_by: string }[] })
      .recoveries;
    expect(rows.some((r) => r.initiated_by === "key-recoverer-1")).toBe(true);
  });

  test("the recovery log survives a move to another host", async () => {
    // NOTE (mutation check, 2026-09-09): import_drops_recoveries removes the
    // one line on the receiving host that restores the log. This assertion
    // failed, because the second host answered with an empty list.
    // Clause 53 says the log leaves with the node, and until 2026-09-09 it did
    // exactly that and no more: the export carried it and the import dropped
    // it. Restoring the data without adding this probe left the mutation
    // surviving, which is the same failure one layer up.
    const house = freshHousehold();
    await call("POST", "/_node/channels", {
      household: house,
      channels: [{ channel: "own-email", controlled_by_recoverer: false }],
    });
    await call("POST", "/_node/recoverers", { household: house, keys: ["key-recoverer-move"] });
    const recovered = await call("POST", `/households/${house}/recoveries`, {
      by: "key-recoverer-move",
    });
    expect(recovered.status).toBe(201);

    const exported = await call("GET", `/households/${house}/export`);
    expect(exported.status).toBe(200);
    const imported = await callSecond("POST", `/households/${house}/import`, exported.body);
    expect(imported.status).toBe(201);

    const first = await call("GET", `/households/${house}/recoveries`);
    const second = await callSecond("GET", `/households/${house}/recoveries`);
    expect(second.status).toBe(first.status);
    expect(second.body).toEqual(first.body);
    expect(
      (second.body as { recoveries: { initiated_by: string }[] }).recoveries.some(
        (r) => r.initiated_by === "key-recoverer-move"
      )
    ).toBe(true);
  });

  test("someone who is not a recoverer cannot recover", async () => {
    // NOTE (mutation check, 2026-09-09): anyone_can_recover removed the check
    // that the caller is a named recoverer. This assertion failed with 201.
    const refused = await call(`POST`, `/households/${HOUSE}/recoveries`, {
      by: "key-a-stranger",
    });
    expect(refused.status).toBe(409);
  });

  test("recovering does not make the recoverer able to read", async () => {
    // NOTE (no mutation, 2026-09-09): this probe has never been shown to fail.
    // The reference engine authenticates nothing, so a recoverer's view and a
    // stranger's are identical for a reason that has nothing to do with
    // clause 53, and no mutation of it can separate them. The probe bites only
    // against an implementation that authenticates reads. It is counted as
    // unproven and left in place, because the clause is worth asserting and
    // the alternative is asserting nothing.
    // The separation clause 53 asks for. Being named a recoverer, and using
    // it, must not put anyone on the reading side of the household's data.
    await call("POST", "/_node/recoverers", {
      household: HOUSE,
      keys: ["key-recoverer-1"],
    });
    await call(`POST`, `/households/${HOUSE}/recoveries`, { by: "key-recoverer-1" });

    // The recoverer's own view of the household is what any stranger's is.
    const asRecoverer = await call(
      "GET",
      `/households/${encodeURIComponent(HOUSE)}/receipts`,
      undefined,
      { "x-key": "key-recoverer-1" }
    );
    const asStranger = await call(
      "GET",
      `/households/${encodeURIComponent(HOUSE)}/receipts`,
      undefined,
      { "x-key": "key-a-stranger" }
    );
    expect(asRecoverer.status).toBe(asStranger.status);
    expect(asRecoverer.body).toEqual(asStranger.body);
  });

  test("the recovery log leaves with the node", async () => {
    // NOTE (mutation check, 2026-09-09): recovery_not_logged as above. A
    // log that does not survive a move cannot be read by someone who left
    // because of what it records. This assertion failed.
    const exported = await call(
      "GET",
      `/households/${encodeURIComponent(HOUSE)}/export`
    );
    const node = exported.body as { recoveries: unknown[] };
    expect(node.recoveries.length).toBeGreaterThan(0);
  });
});

describe.if(HAS_PHYSICAL)("exit: a move carries what the route found in a box (§6.5, §14.2)", () => {
  test("the export carries a missing item with its note (question 46)", async () => {
    // NOTE (mutation check, 2026-09-14): export_strips_missing_notes empties
    // the notes on the way out. The note assertion failed. The note is how the
    // stock holder learns why it bears a loss, and a move that dropped it
    // would arrive with the loss and without the reason.
    const house = encodeURIComponent(household());
    const created = await call("POST", "/offers", conformingOffer({ binding: "physical", household: household() }));
    expect(created.status).toBe(201);
    const offer = created.body as { id: string; candidates: { id: string }[] };
    await call("POST", `/offers/${offer.id}/present`, {});
    const [gone, ...others] = offer.candidates;
    expect((await call("POST", `/offers/${offer.id}/recovery`, {
      returned: others.map((c) => c.id),
      consumed: [],
      missing: [gone!.id],
      missing_notes: { [gone!.id]: "not in the box at collection" },
    })).status).toBe(200);
    const exported = await call("GET", `/households/${house}/export`);
    expect(exported.status).toBe(200);
    expect((exported.body as { format: string }).format).toBe("valence-node/12");
    const node = exported.body as { collections?: { offer: string; missing?: string[]; missing_notes?: Record<string, string> }[] };
    const row = (node.collections ?? []).find((c) => c.offer === offer.id);
    expect(row?.missing).toEqual([gone!.id]);
    expect(row?.missing_notes).toEqual({ [gone!.id]: "not in the box at collection" });
  });

  test("the export carries the collection, and the box it belongs to stays at its host", async () => {
    // NOTE (mutation check, 2026-09-12): export_drops_collections leaves the
    // rows out. The first assertion failed, and the last one failed too: the
    // receiving host presented the next box freely.
    //
    // **The export carried clause 53's account-recovery log and not this.**
    // A refutation pass asked what a move does to §6.5's block and the answer
    // was that it lifted: the offers arrived with their `consumed` valences
    // and no record that any collection had happened, so the new host
    // delivered again while the old one held a block over a household that
    // had left. The merchant's export carried the rows all along, so the shop
    // kept what the person lost.
    const house = encodeURIComponent(household());
    const held = PRODUCTS[PRODUCTS.length - 1]!;
    const shown = PRODUCTS.slice(0, -1);
    const created = await call("POST", "/offers", conformingOffer({
      binding: "physical",
      household: household(),
      candidates: shown.map((product, i) => ({ product, quantity: 1, predicted_conversion: 0.5, is_exploration: i === 0 })),
    }));
    expect(created.status).toBe(201);
    const offer = created.body as { id: string; candidates: { id: string }[] };
    await call("POST", `/offers/${offer.id}/present`, {});
    const [used, ...others] = offer.candidates;
    expect((await call("POST", `/offers/${offer.id}/recovery`, {
      returned: others.map((c) => c.id),
      consumed: [used!.id],
    })).status).toBe(200);

    const exported = await call("GET", `/households/${house}/export`);
    expect(exported.status).toBe(200);
    const node = exported.body as { collections?: { offer: string; consumed: string[] }[] };
    const row = (node.collections ?? []).find((c) => c.offer === offer.id);
    expect(row).toBeDefined();
    expect(row!.consumed).toContain(used!.id);

    // §14.2 and §6.4, question 57, rebuilt 2026-09-19. The box awaits its
    // statement, so its money has not finished moving and it stays where its
    // reserve is. This probe used to require the block to travel with it, and
    // a third refutation pass measured what that cost: the statement was
    // refused `no_reservation` at the new host and this presenter's next box
    // was refused there for good. **The block is per host now**, which is the
    // cost of this shape and is stated rather than discovered.
    const moved = await callSecond("POST", `/households/${house}/import`, exported.body);
    expect(moved.status).toBe(201);
    expect((moved.body as { left_behind: string[] }).left_behind).toContain(offer.id);

    // So this presenter's next box presents at the new host.
    const next = await callSecond("POST", "/offers", conformingOffer({
      binding: "physical",
      household: household(),
      candidates: [held, ...shown].map((product, i) => ({ product, quantity: 1, predicted_conversion: 0.5, is_exploration: i === 0 })),
    }));
    expect(next.status).toBe(201);
    const second = next.body as { id: string };
    expect((await callSecond("POST", `/offers/${second.id}/present`, {})).status).toBe(200);
  });
});

describe("exit: a household leaves the host (§14.3)", () => {
  test("the blockers are named, a refusal writes nothing, and a clean household leaves", async () => {
    const leaving = freshHousehold();
    await ensureRegistered(BASE, leaving);
    const created = await call("POST", "/offers", conformingOffer({ household: leaving }));
    expect(created.status).toBe(201);
    const offer = created.body as { id: string };
    expect((await call("POST", `/offers/${offer.id}/present`, {})).status).toBe(200);
    const house = encodeURIComponent(leaving);

    const listed = await call("GET", `/households/${house}/leave`);
    expect(listed.status).toBe(200);
    const blockers = (listed.body as { household: string; blockers: { kind: string; id: string }[] });
    expect(blockers.household).toBe(leaving);
    expect(blockers.blockers).toContainEqual({ kind: "offer_in_progress", id: offer.id });

    const signed = (h: string, at = Date.now()) => ({ at, signature: sign(null, Buffer.from(JSON.stringify(["valence.leave.1", h, RP_ID, at])), keyForHousehold(h)).toString("base64") });
    // Unsigned, and signed for another household: neither deletes anything.
    // Unsigned, signed for another household, and signed too long ago: none deletes anything.
    for (const body of [{}, signed(freshHousehold()), signed(leaving, Date.now() - 10 * 60_000)]) {
      const unsigned = await call("POST", `/households/${house}/leave`, body);
      expect(unsigned.status).toBe(422);
      expect(["unsigned", "bad_signature", "stale_request"]).toContain((unsigned.body as { error: string }).error);
    }

    const refused = await call("POST", `/households/${house}/leave`, signed(leaving));
    expect(refused.status).toBe(409);
    expect((refused.body as { error: string }).error).toBe("leave_blocked");
    // Nothing was written: the offer is still the household's.
    expect((await call("GET", `/offers/${offer.id}`)).status).toBe(200);

    // A household with nothing of its own leaves, and its export is empty afterwards.
    const clean = freshHousehold(), cleanHouse = encodeURIComponent(clean);
    await ensureRegistered(BASE, clean);
    expect(((await call("GET", `/households/${cleanHouse}/leave`)).body as { blockers: unknown[] }).blockers).toEqual([]);
    const left = await call("POST", `/households/${cleanHouse}/leave`, signed(clean));
    expect(left.status).toBe(200);
    expect((left.body as { deleted: Record<string, number> }).deleted).toBeDefined();
    const exported = await call("GET", `/households/${cleanHouse}/export`);
    expect(exported.status).toBe(200);
    expect((exported.body as { offers: unknown[] }).offers).toEqual([]);
  });
});

describe("exit: an export carries the keys its edges verify with (§14.2, valence-node/11)", () => {
  test("the recipient's export names the giver's key, and an import refuses a key that is not its name", async () => {
    await call("POST", "/lineage", LINEAGE_EDGE);
    const recipient = LINEAGE_EDGE.to as string, giver = LINEAGE_EDGE.from as string;
    // The fixture's giver is the name of its key, which is what makes the key worth carrying.
    expect(giver).toMatch(/^key:[A-Za-z0-9_-]{43}$/);
    const exported = await call("GET", `/households/${encodeURIComponent(recipient)}/export`);
    expect(exported.status).toBe(200);
    const node = exported.body as { format: string; keys: Record<string, string> };
    expect(node.format).toBe("valence-node/12");
    expect(typeof node.keys[giver]).toBe("string");
    for (const name of Object.keys(node.keys)) expect(name).toMatch(/^key:[A-Za-z0-9_-]{43}$/);

    // The same export with the giver's key swapped for another is refused whole.
    const another = "-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=\n-----END PUBLIC KEY-----\n";
    const refused = await callSecond("POST", `/households/${encodeURIComponent(recipient)}/import`, { ...node, keys: { ...node.keys, [giver]: another } });
    expect(refused.status).toBe(422);
    expect((refused.body as { error: string }).error).toBe("name_is_not_the_key");
  });
});

describe("exit: a household reads its own export through a signed request (clause 43)", () => {
  test("the node is handed over on the household's own recent signature and on nothing else", async () => {
    const own = freshHousehold();
    await ensureRegistered(BASE, own);
    const house = encodeURIComponent(own);
    const signed = (h: string, at = Date.now()) => ({ at, signature: sign(null, Buffer.from(JSON.stringify(["valence.export.1", h, RP_ID, at])), keyForHousehold(h)).toString("base64") });
    for (const body of [{}, signed(freshHousehold()), signed(own, Date.now() - 10 * 60_000)]) {
      const refused = await call("POST", `/households/${house}/export`, body);
      expect(refused.status).toBe(422);
    }
    const ok = await call("POST", `/households/${house}/export`, signed(own));
    expect(ok.status).toBe(200);
    expect((ok.body as { household: string; format: string }).household).toBe(own);
  });
});

