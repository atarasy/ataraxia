import { describe, expect, test } from "bun:test";
import {
  call,
  conformingOffer,
  createConformingOffer,
  decide,
  DISCLOSURE,
  PRODUCT_UNDISCLOSED,
} from "../lib/probe.js";

/**
 * §10a, conformance condition 15.
 *
 * **The seller composes what the seller must say, and the person's agent
 * renders it.** Every jurisdiction makes a seller tell a buyer certain things
 * before the buyer commits; none of them makes the seller's software house
 * tell them. So nothing here reads an item, and no probe asserts that any
 * statute is satisfied: what is checkable is who composed the block, that it
 * comes back as composed, and that a decision without one is refused.
 *
 * **What no probe here reaches** is whether a disclosure is complete, true, or
 * in the right language. An implementation carrying an empty signed block
 * passes every probe in this file and satisfies no statute anywhere, and that
 * is written here rather than left to be discovered.
 */
const keepEverything = (offer: { candidates: { id: string }[] }) =>
  offer.candidates.map((c) => ({ candidate: c.id, valence: "kept" as const, kept_as: "self" as const }));

describe("disclosure: the block is the merchant's (§10a)", () => {
  test("an offer carries it, as the merchant composed it", async () => {
    // NOTE (mutation check, 2026-09-12): disclosure_not_carried leaves the
    // array empty on a new offer. This assertion failed.
    const offer = await createConformingOffer();
    const read = await call("GET", `/offers/${offer.id}`);
    expect(read.status).toBe(200);
    const blocks = (read.body as { disclosures?: unknown }).disclosures as
      | { merchant: string; version: string; items: { label: string; value: string }[]; signature: string }[]
      | undefined;
    expect(Array.isArray(blocks)).toBe(true);
    const mine = blocks!.find((b) => b.merchant === DISCLOSURE.merchant);
    expect(mine).toBeDefined();
    // NOTE (mutation check, 2026-09-12): disclosure_items_reordered sorts the
    // items by label. This assertion failed. **Order is composition**: a hub
    // that decides which of a seller's statements a person reads first has
    // composed the notice it was rendering.
    expect(mine!.items).toEqual(DISCLOSURE.items);
    expect(mine!.version).toBe(DISCLOSURE.version);
    expect(mine!.signature).toBe(DISCLOSURE.signature);
  });

  test("no request field writes one", async () => {
    // A field through which a caller can write a seller's legal text is the
    // same defect as a field through which a caller can write a price (§3.1).
    const body = conformingOffer() as Record<string, unknown>;
    body.disclosures = [
      { merchant: DISCLOSURE.merchant, version: "forged", items: [], signature: "x" },
    ];
    const created = await call("POST", "/offers", body);
    expect(created.status).toBe(400);
  });

  test("a decision naming a merchant with no disclosure is refused", async () => {
    // NOTE (mutation check, 2026-09-12): decide_without_disclosure drops the
    // check. This assertion failed with 200. The refusal names itself, the way
    // §16.6's do, because a `422` with no name is one no person and no probe
    // can tell from another.
    const body = conformingOffer() as Record<string, unknown>;
    (body.candidates as Record<string, unknown>[])[0]!.product = PRODUCT_UNDISCLOSED;
    const created = await call("POST", "/offers", body);
    expect(created.status).toBe(201);
    const offer = created.body as { id: string; candidates: { id: string }[] };
    await call("POST", `/offers/${offer.id}/present`, {});
    const refused = await decide(offer.id, { decisions: keepEverything(offer) });
    expect(refused.status).toBe(422);
    expect((refused.body as { error: string }).error).toBe("disclosure_missing");
  });
});
