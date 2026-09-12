import { describe, expect, test } from "bun:test";
import {
  call,
  conformingOffer,
  createConformingOffer,
  decide,
  DISCLOSURE,
  PRICES,
  PRODUCT_UNDISCLOSED,
  CONFIG_VERSION_UNDISCLOSED,
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

  test("the screen a person signs from carries it too", async () => {
    // NOTE (mutation check, 2026-09-12): disclosure_not_on_the_approval_screen
    // leaves it off the approval render. This assertion failed.
    //
    // **The requirement was satisfied on a surface nobody signs from** until
    // the day it was written: the block reached `GET /offers/{id}` and stopped
    // there, while a member's hub reads `GET /offers/{id}/approval`. §10a.4
    // asks that the person see it before they sign, and the screen they sign
    // on is this one.
    const offer = await createConformingOffer();
    const perCandidate: Record<string, unknown> = {};
    for (const c of offer.candidates) {
      perCandidate[c.id] = {
        alternatives: ["the same tea in a smaller tin"],
        argument_against: "you have two of these already",
      };
    }
    await call("POST", `/offers/${offer.id}/deliberation`, {
      per_candidate: perCandidate,
      excluded: [],
      mandate: { kind: "individual", scope: "this offer", lapses_at: null },
    });
    const approval = await call("GET", `/offers/${offer.id}/approval`);
    expect(approval.status).toBe(200);
    const blocks = (approval.body as { disclosures?: unknown }).disclosures as
      | { merchant: string; items: { label: string; value: string }[] }[]
      | undefined;
    expect(Array.isArray(blocks)).toBe(true);
    const mine = blocks!.find((b) => b.merchant === DISCLOSURE.merchant);
    expect(mine).toBeDefined();
    expect(mine!.items).toEqual(DISCLOSURE.items);
  });

  test("the screen carries the sale beside the block, not the block alone (§10a.5)", async () => {
    // A block is keyed on the merchant and registered before any offer
    // exists, so it carries only what the merchant knows in advance. The
    // quantity, the unit price and the expiry come from the offer, and the
    // carriage from the delivery the hub recorded; the screen shows them
    // beside the block, and a screen showing the block alone has shown the
    // merchant's terms and not this sale. The quantity is two on purpose: on
    // an offer of ones, a screen that shows every line at one is not a break.
    const body = conformingOffer() as Record<string, unknown>;
    (body.candidates as { quantity: number }[])[0].quantity = 2;
    const created = await call("POST", "/offers", body);
    expect(created.status).toBe(201);
    const offer = created.body as {
      id: string;
      expires_at: number;
      candidates: { id: string; product: string; quantity: number; unit_price: number }[];
    };
    await call("POST", `/offers/${offer.id}/delivery`, {
      carriage: 550,
      code: "dc-probe-10a",
      status: "placed",
    });
    const perCandidate: Record<string, unknown> = {};
    for (const c of offer.candidates) {
      perCandidate[c.id] = {
        alternatives: ["the same tea in a smaller tin"],
        argument_against: "you have two of these already",
      };
    }
    await call("POST", `/offers/${offer.id}/deliberation`, {
      per_candidate: perCandidate,
      excluded: [],
      mandate: { kind: "individual", scope: "this offer", lapses_at: null },
    });
    const approval = await call("GET", `/offers/${offer.id}/approval`);
    expect(approval.status).toBe(200);
    const screen = approval.body as {
      expires_at: number;
      carriage: number | null;
      candidates: { id: string; quantity: number; unit_price: number }[];
    };
    expect(screen.expires_at).toBe(offer.expires_at);
    expect(screen.carriage).toBe(550);
    for (const c of offer.candidates) {
      const shown = screen.candidates.find((s) => s.id === c.id);
      expect(shown).toBeDefined();
      expect(shown!.quantity).toBe(c.quantity);
      expect(shown!.unit_price).toBe(PRICES[c.product]);
    }
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

  test("an offer naming a merchant with no disclosure is not presented", async () => {
    // NOTE (mutation check, 2026-09-12): disclosure_unchecked_at_presentation
    // drops the check. This assertion failed with 200.
    //
    // **Presentation is where refusing costs least.** §10a refused at the
    // decision when it was written, on the reasoning that refusing earlier
    // would let one merchant's omission stop a presenter offering anything;
    // that is backwards. Refusing at creation costs one candidate. Refusing at
    // the decision costs the household the whole signed set, because a decided
    // set is all-or-nothing, and the person has already read it and signed.
    const body = conformingOffer() as Record<string, unknown>;
    body.config_version = CONFIG_VERSION_UNDISCLOSED;
    body.presenter = undefined;
    body.candidates = [{ product: PRODUCT_UNDISCLOSED, quantity: 1, is_exploration: true }];
    const created = await call("POST", "/offers", body);
    expect(created.status).toBe(201);
    const offer = created.body as { id: string };
    const presented = await call("POST", `/offers/${offer.id}/present`, {});
    expect(presented.status).toBe(422);
    expect((presented.body as { error: string }).error).toBe("disclosure_missing");
  });

  test("a decision naming a merchant with no disclosure is refused", async () => {
    // NOTE (mutation check, 2026-09-12): decide_without_disclosure drops the
    // check. This assertion failed with 200. The refusal names itself, the way
    // §16.6's do, because a `422` with no name is one no person and no probe
    // can tell from another.
    const body = conformingOffer() as Record<string, unknown>;
    body.config_version = CONFIG_VERSION_UNDISCLOSED;
    body.presenter = undefined;
    body.candidates = [{ product: PRODUCT_UNDISCLOSED, quantity: 1, is_exploration: true }];
    const created = await call("POST", "/offers", body);
    expect(created.status).toBe(201);
    const offer = created.body as { id: string; candidates: { id: string }[] };
    // It cannot be presented at all, which is the probe above. The decision is
    // refused on an offer that never reached `presented`, and the refusal a
    // caller sees is the state one: **what this probe proves is that the set
    // never settles**, not which of the two refusals arrives first.
    const refused = await decide(offer.id, { decisions: keepEverything(offer) });
    expect(refused.status).toBeGreaterThanOrEqual(400);
  });
});
