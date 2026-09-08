import { describe, expect, test } from "bun:test";
import {
  call,
  conformingOffer,
  createConformingOffer,
  findKey,
  HOUSEHOLD,
  meansAnyOf,
  PRICES,
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

/**
 * Clause 1. The infrastructure has no discovery, no search and no ranking.
 *
 * Added 2026-09-09, during the clause review, when clause 1 turned out to be
 * the first clause in the constitution and checked by nothing. The five routes
 * above are §9.1's; these four are the shapes discovery takes when it arrives
 * under the name of a feature.
 */
const INTENT_LAYER_ROUTES = [
  "/search",
  "/discovery",
  "/discover",
  "/ranking",
  "/recommendations",
  "/trending",
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
  // §6.1. A balance redeemable against goods is a prepaid payment instrument.
  // Two probes below check that no route returns one; these check that none
  // arrives as a field on something else, which is where it would go if the
  // route were refused and the idea kept.
  "balance",
  "credit",
  "credits",
  "wallet",
  "stored_value",
  "points",
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

/**
 * Matches a forbidden name in any spelling. `trackingId` and `tracking_id` are
 * one capability, and comparing exact strings catches one of them: an
 * adversarial pass reintroduced four of these in camelCase and every probe in
 * this file stayed green.
 */
const looksLike = (needles: string[]) => meansAnyOf(needles);

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

describe("absence: the infrastructure is not the intent layer (clause 1)", () => {
  for (const route of INTENT_LAYER_ROUTES) {
    test(`${route} is not a route, by any method`, async () => {
      // NOTE (mutation check, 2026-09-09): search_route registered
      // GET /search returning a ranked list. This assertion failed with 200.
      // Clause 1 is what stops the infrastructure becoming the next layer that
      // levies a rent on discovery, and a search endpoint is that layer
      // arriving as a convenience.
      for (const method of ["GET", "POST"]) {
        const probe = await call(method, `${route}?q=tea`, method === "POST" ? { q: "tea" } : undefined);
        expect(probe.status).toBe(404);
      }
    });
  }
});

describe("absence: nothing here issues an identity (clause 2)", () => {
  /**
   * Clause 2, as narrowed on 2026-09-09. Identity has one root outside the
   * system, and nothing in it mints one: not the hub, not a node, not a host.
   *
   * The routes that exist take a public key the caller already holds and
   * record it. That is attestation. What must not exist is a route that
   * hands the caller a key or an identifier they did not bring, because
   * whoever issues identity can revoke it, and revocation is the lever every
   * other clause assumes nobody in this system holds.
   */
  test("no route hands out an identity", async () => {
    // NOTE (mutation check, 2026-09-09): signup_route registered
    // POST /signup returning a freshly generated key pair. This assertion
    // failed with 201. A system that issues identities is one that can take
    // them back.
    for (const path of ["/signup", "/identities", "/households", "/keys", "/register", "/accounts"]) {
      const minted = await call("POST", path, {});
      expect(minted.status).toBe(404);
    }
  });

  test("attesting a key never returns one", async () => {
    // The attestation routes are out of the specification and exist so the
    // probes have fixtures. Even so, their responses carry no key material:
    // a route that attests and also returns a private key has become an
    // issuer by another name.
    const attested = await call("POST", "/registry/attest", {
      merchant: "probe-merchant",
      public_key: "not-a-real-pem",
    });
    expect(findKey(attested.body, meansAnyOf(["private_key", "secret", "seed", "mnemonic"]))).toEqual([]);
  });
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

describe("absence: capabilities under another name", () => {
  test("no forbidden field appears under a different spelling", async () => {
    // NOTE (mutation check, 2026-09-08): camel_tracking added `trackingId`,
    // `stockRemaining`, `expiresInSeconds` and `starRating` to the candidate
    // serialisation. Every probe in this file passed, because the key list
    // was compared as exact lower-case strings. The comparison now collapses
    // punctuation and case, and this assertion catches all four.
    const offer = await createConformingOffer();
    const read = await call("GET", `/offers/${offer.id}`);
    expect(read.status).toBe(200);
    expect(findKey(read.body, looksLike(FORBIDDEN_KEYS))).toEqual([]);
  });

  test("a household is never charged above the merchant's own price", async () => {
    // NOTE (mutation check, 2026-09-08): coupon_and_surcharge accepted a
    // `surcharge` on a candidate and added it to the price. The first version
    // of this probe read the price of an ordinary offer and passed, because
    // an offer that sends no surcharge gets no surcharge.
    //
    // So the probe pushes rather than reads. Whether a field is refused or
    // accepted and ignored does not matter; what clause 10 forbids is the
    // price moving, and that is what is asserted. The field names are a
    // bounded search, and a capability under a name not listed here is out of
    // reach from outside.
    for (const field of [
      "surcharge",
      "markup",
      "uplift",
      "premium",
      "fee",
      "adjustment",
      "price_override",
      "unit_price",
      "coupon",
    ]) {
      const body = conformingOffer();
      (body.candidates as Record<string, unknown>[])[0]![field] = 500;
      const created = await call("POST", "/offers", body);
      if (created.status !== 201) continue;

      const offer = created.body as { id: string };
      const read = await call("GET", `/offers/${offer.id}`);
      const served = read.body as {
        candidates: { product: string; unit_price: number }[];
      };
      for (const candidate of served.candidates) {
        const merchantPrice = PRICES[candidate.product];
        expect(merchantPrice).toBeDefined();
        // Lower is the merchant's own business. Higher cannot exist.
        expect(candidate.unit_price).toBeLessThanOrEqual(merchantPrice!);
      }
    }
  });

  test("no store of per-person events answers on a plausible route", async () => {
    // NOTE (mutation check, 2026-09-08): per_person_events registered
    // POST and GET /analytics and a /px pixel socket. §9.1 names five routes
    // and none of them was it, so the suite passed. This probe widens the
    // search; it cannot close it. Enumerating the routes an implementation
    // does not have is not possible from outside, and clause 33 forbids the
    // capability rather than the path. The gap is named in MUTATIONS.md.
    for (const path of [
      "/analytics",
      "/events",
      "/event",
      "/track",
      "/tracking",
      "/px",
      "/pixel",
      "/telemetry",
      "/activity",
      "/profiles",
    ]) {
      const posted = await call("POST", path, { household: HOUSEHOLD });
      expect(posted.status).toBe(404);
      const got = await call("GET", `${path}?household=${encodeURIComponent(HOUSEHOLD)}`);
      expect(got.status).toBe(404);
    }
  });
});

describe("presence: what must not be hidden (clause 12)", () => {
  test("an offer names the merchant", async () => {
    // NOTE (mutation check, 2026-09-08): hide_presenter dropped `presenter`
    // from the offer serialisation. This assertion failed. Every other probe
    // in this file looks for something that must be absent; clause 12 is the
    // one thing in reach here that must be present, and a suite made only of
    // absences would let an implementation pass by returning nothing at all.
    const offer = await createConformingOffer();
    const read = await call("GET", `/offers/${offer.id}`);
    expect(read.status).toBe(200);
    const body = read.body as { presenter?: unknown };
    expect(typeof body.presenter).toBe("string");
    expect(body.presenter).not.toBe("");
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
