import { describe, expect, test } from "bun:test";
import {
  call,
  conformingOffer,
  createConformingOffer,
  findKey,
  HOUSEHOLD,
  PRODUCTS,
} from "../lib/probe.js";

/**
 * Clauses 31, 32, 33, 34 and specification §3.3, §7.5, §9.1.
 *
 * Capabilities that must not exist. A clause that says a field does not exist
 * is checkable by looking for the field; a clause that says a route does not
 * exist is checkable by asking for it.
 *
 * The harder half is inference, and it is why these probes walk the whole
 * response document rather than the fields the author happened to think of.
 */

const FORBIDDEN_ROUTES = [
  "/segments",
  "/broadcast",
  "/discounts",
  "/ratings",
  "/events/track",
];

/** Named as they would be if someone reintroduced them. */
const FORBIDDEN_KEYS = [
  "discount",
  "discount_code",
  "coupon",
  "promo",
  "rating",
  "stars",
  "score",
  "segment",
  "urgency",
  "countdown",
  "expires_in_seconds",
  "stock_remaining",
  "scarcity",
  "pixel",
  "tracking_id",
  "visitor_id",
  "anonymous_id",
];

/** §7.5: totals, network size and popularity are not displayed. */
const FORBIDDEN_AGGREGATES = [
  "total",
  "total_count",
  "count",
  "network_size",
  "rank",
  "ranking",
  "popularity",
  "trending",
];

const looksLike = (needles: string[]) => (key: string) =>
  needles.includes(key.toLowerCase());

describe("absence: routes that must not exist (§9.1)", () => {
  for (const route of FORBIDDEN_ROUTES) {
    test(`POST ${route} is not a route`, async () => {
      // NOTE (mutation check): a route file registering POST /discounts was
      // added to the reference implementation and this assertion failed with
      // 201 instead of 404. Removed again.
      const posted = await call("POST", route, {});
      expect(posted.status).toBe(404);
    });

    test(`GET ${route} is not a route`, async () => {
    // NOTE (mutation check, 2026-09-08): route_get_segments registered
      // GET /segments in the reference implementation. This assertion failed
      // with 200 instead of 404.
      const got = await call("GET", route);
      expect(got.status).toBe(404);
    });
  }
});

describe("absence: fields that must not exist (§3.3)", () => {
  test("a discount on a candidate is refused, not ignored", async () => {
    // NOTE (mutation check): the reference implementation's strict body check
    // was changed to drop unknown fields instead of refusing them. The offer
    // was then created with 201 and this assertion failed. A caller that
    // believes it sent a discount and receives a 201 has been told the field
    // exists.
    const body = conformingOffer();
    (body.candidates as Record<string, unknown>[])[0]!.discount = 500;
    const created = await call("POST", "/offers", body);
    expect(created.status).toBe(400);
  });

  test("a request cannot raise the price a household pays (§3.1)", async () => {
    // NOTE (mutation check): `unit_price` was added to the accepted candidate
    // fields and passed through to the stored candidate. The probe then saw
    // 201 and a unit_price of 99999, and failed.
    const body = conformingOffer();
    (body.candidates as Record<string, unknown>[])[0]!.unit_price = 99999;
    const created = await call("POST", "/offers", body);
    expect(created.status).toBe(400);
  });

  test("a rating cannot be attached to a note", async () => {
    // NOTE (mutation check, 2026-09-08): strict-drops-unknown, the same
    // mutation as above. The note was created with 201 and the rating was
    // silently discarded, which this assertion caught.
    const offer = await createConformingOffer();
    const candidate = offer.candidates[0]!.id;
    const noted = await call("POST", `/candidates/${candidate}/note`, {
      author: HOUSEHOLD,
      text: "kept for the smell",
      visibility: "self",
      rating: 5,
    });
    expect(noted.status).toBe(400);
  });

  test("no forbidden field appears anywhere in an offer", async () => {
    // NOTE (mutation check, 2026-09-08): leak_field_offer_view added a
    // `rating: 4` to the candidate serialisation. This assertion failed,
    // naming candidates[0].rating.
    const offer = await createConformingOffer();
    const read = await call("GET", `/offers/${offer.id}`);
    expect(read.status).toBe(200);
    expect(findKey(read.body, looksLike(FORBIDDEN_KEYS))).toEqual([]);
  });

  test("no forbidden field appears anywhere in a settled offer", async () => {
    // NOTE (mutation check, 2026-09-08): leak_field_settlement added a
    // `tracking_id` to the settlement record. This assertion failed. The two
    // probes are separate because the settlement is built in the engine and
    // the offer view in the HTTP layer, and a leak in one does not show in
    // the other.
    const offer = await createConformingOffer();
    await call("POST", `/offers/${offer.id}/present`, {});
    await call("POST", `/offers/${offer.id}/decisions`, {
      decisions: offer.candidates.map((c, i) => ({
        candidate: c.id,
        valence: i === 0 ? "kept" : "returned",
        ...(i === 0 ? { kept_as: "self" } : {}),
      })),
    });
    const settled = await call("POST", `/offers/${offer.id}/settle`, {});
    expect(settled.status).toBe(200);
    expect(findKey(settled.body, looksLike(FORBIDDEN_KEYS))).toEqual([]);
  });
});

describe("absence: aggregates that must not be displayed (§7.5)", () => {
  test("the household's offer list carries no total and no ranking", async () => {
    // NOTE (mutation check): a `total` field was added alongside `offers` in
    // the list response. This assertion failed, naming `total`. Removed.
    const list = await call(
      "GET",
      `/offers?household=${encodeURIComponent(HOUSEHOLD)}`
    );
    expect(list.status).toBe(200);
    expect(findKey(list.body, looksLike(FORBIDDEN_AGGREGATES))).toEqual([]);
  });

  test("the giver's lineage surface carries no total and no ranking", async () => {
    // NOTE (mutation check, 2026-09-08): lineage_acts_total added
    // `network_size` beside `acts`. This assertion failed, naming it.
    const acts = await call(
      "GET",
      `/lineage/acts?giver=${encodeURIComponent(HOUSEHOLD)}`
    );
    expect([200, 404]).toContain(acts.status);
    if (acts.status === 200) {
      expect(findKey(acts.body, looksLike(FORBIDDEN_AGGREGATES))).toEqual([]);
    }
  });
});

describe("absence: the store itself", () => {
  test("there is no household balance to read (§6.1)", async () => {
    // NOTE (mutation check, 2026-09-08): balance_route registered
    // GET /households/{id}/balance returning a balance of 0. This assertion
    // failed with 200 instead of 404. A balance of zero is still a balance.
    // A balance redeemable against goods is a prepaid payment instrument.
    // The specification settles by deduction, so no route returns one.
    for (const path of [
      `/households/${encodeURIComponent(HOUSEHOLD)}/balance`,
      `/balances?household=${encodeURIComponent(HOUSEHOLD)}`,
    ]) {
      const read = await call("GET", path);
      expect(read.status).toBe(404);
    }
  });

  test("products come from the presenter's catalogue, not the request", async () => {
    // NOTE (mutation check, 2026-09-08): invent_product made a missing
    // catalogue entry fall back to a price of 1000. This assertion failed
    // with 201 instead of 404: an unknown product acquired a price nobody set.
    const body = conformingOffer();
    (body.candidates as Record<string, unknown>[])[0]!.product =
      `${PRODUCTS[0]}-not-in-catalogue`;
    const created = await call("POST", "/offers", body);
    expect(created.status).toBe(404);
  });
});
