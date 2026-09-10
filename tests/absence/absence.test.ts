import { describe, expect, test } from "bun:test";
import {
  call,
  conformingOffer,
  createConformingOffer,
  decide,
  findKey,
  freshHousehold,
  HOUSEHOLD,
  meansAnyOf,
  offerBody,
  presenter,
  PRICES,
  PRODUCTS,
} from "../lib/probe.js";

/**
 * Clauses 27, 28, 29, 30 and specification §3.3, §7.7, §9.1.
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

/** §7.7: totals, network size and popularity are not displayed. */
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
   * Clause 2, as narrowed on 2026-09-09. Identity has a root outside the
   * system, one per person, and nothing in it mints one: not the hub, not a
   * node, not a host. Which root, per jurisdiction, is the architecture's
   * question (vault 02 §3), not the constitution's. Uniqueness is the root's
   * property and is not probed here; what is probed is that nothing issues.
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
    // NOTE (mutation check, 2026-09-09): attest_returns_private_key made the
    // attestation route generate a key pair and return the private half.
    // This assertion failed, naming private_key.
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

describe("absence: nothing names a part a member could replace (clause 3)", () => {
  /**
   * Clause 3, as rewritten on 2026-09-09. Everything a member touches can be
   * replaced by the member: the password manager, the model, the host, the
   * merchant. A document that names one of them has bound itself to it, and
   * a part that must be present by name is no longer replaceable. Host
   * replacement is exercised end to end in exit/; this walk checks the
   * documents the member carries between parts.
   */
  const REPLACEABLE_PARTS = [
    "model",
    "llm",
    "provider",
    "password_manager",
    "manager",
    "vendor",
  ];

  test("an offer names no model, manager or provider", async () => {
    // NOTE (mutation check, 2026-09-09): name_the_model added
    // `model: "gpt-5"` to the offer serialisation. This assertion failed,
    // naming `model`.
    const offer = await createConformingOffer();
    const read = await call("GET", `/offers/${offer.id}`);
    expect(read.status).toBe(200);
    expect(findKey(read.body, looksLike(REPLACEABLE_PARTS))).toEqual([]);
  });

  test("a settlement names no model, manager or provider", async () => {
    const offer = await createConformingOffer();
    await call("POST", `/offers/${offer.id}/present`, {});
    await decide(offer.id, {
      decisions: offer.candidates.map((c, i) => ({
        candidate: c.id,
        valence: i === 0 ? "kept" : "returned",
        ...(i === 0 ? { kept_as: "self" } : {}),
      })),
    });
    const settled = await call("POST", `/offers/${offer.id}/settle`, {});
    expect(settled.status).toBe(200);
    expect(findKey(settled.body, looksLike(REPLACEABLE_PARTS))).toEqual([]);
  });
});

describe("absence: a presenter's view is vertical (clause 8)", () => {
  /**
   * Clause 8, as rewritten on 2026-09-09. A merchant holds what was declined
   * to it and nothing declined elsewhere, and no party but the person holds
   * the union. The engine's household list filtered by household alone
   * until that day, so a deployment serving two presenters showed each the
   * other's declines under the name of a vertical view.
   */
  test("another presenter's view holds nothing this presenter was declined", async () => {
    // NOTE (mutation check, 2026-09-09): vertical_view_not_vertical dropped
    // the presenter filter from the list. This assertion failed: the offer
    // declined here appeared in the view asked for under another name.
    const household = freshHousehold();
    const offer = await createConformingOffer({ household });
    await call("POST", `/offers/${offer.id}/present`, {});
    await decide(offer.id, {
      decisions: offer.candidates.map((c) => ({ candidate: c.id, valence: "returned" })),
    });
    const other = await call(
      "GET",
      `/offers?household=${encodeURIComponent(household)}&presenter=${encodeURIComponent("someone-else")}`
    );
    expect(other.status).toBe(200);
    const ids = ((other.body as { offers: { id: string }[] }).offers ?? []).map((o) => o.id);
    expect(ids).not.toContain(offer.id);
  });

  test("the list is one presenter's view, never the household's union", async () => {
    // A list that can be asked for without naming a presenter is the union
    // by omission.
    const union = await call("GET", `/offers?household=${encodeURIComponent(HOUSEHOLD)}`);
    expect(union.status).toBe(400);
  });
});

describe("absence: the platform infers nothing across nodes (clause 9)", () => {
  /**
   * Clause 9, as rewritten on 2026-09-09. What the platform returns is what
   * the merchant or the node sent. A prediction that comes back changed is a
   * model the platform ran, and the only data it could have run it on is
   * other households' verdicts.
   */
  test("the prediction that comes back is the prediction that was sent", async () => {
    // NOTE (mutation check, 2026-09-09): platform_reinfers scaled each
    // candidate's predicted_conversion by the return rate of the same
    // product across every household the engine had seen. This assertion
    // failed once a returned verdict existed for the product, which the
    // suite's earlier probes guarantee.
    // Distinct values, one per declared product, the low ones marked as
    // exploration so the floor is met at any rate up to 0.6 and the floor's
    // qualification check is not what a failure here would be about.
    const pattern = [0.83, 0.41, 0.07, 0.11, 0.13, 0.09, 0.17];
    const sent = PRODUCTS.map((_, i) => pattern[i % pattern.length]!);
    const body = offerBody(
      PRODUCTS.map((product, i) => ({
        product,
        predicted_conversion: sent[i]!,
        is_exploration: sent[i]! <= 0.2,
      }))
    );
    const created = await call("POST", "/offers", body);
    expect(created.status).toBe(201);
    const read = await call("GET", `/offers/${(created.body as { id: string }).id}`);
    const got = (read.body as { candidates: { predicted_conversion: number }[] }).candidates.map(
      (c) => c.predicted_conversion
    );
    expect(got).toEqual(sent);
  });
});

describe("absence: a line is shown to whom the writer says, and never becomes a number (clause 27)", () => {
  /**
   * Clause 27, as rewritten on 2026-09-09. A line may reach the recipient
   * and the merchant, each only when the writer said so, and nothing turns
   * lines into a number.
   */
  test("the merchant reads a line only when the writer shared it", async () => {
    // NOTE (mutation check, 2026-09-09): merchant_sees_every_note returned
    // every note to whoever asked as the merchant. The first assertion
    // failed with 200. A line the writer kept to themselves had reached
    // the maker.
    // Two candidates, because a writer has one line per candidate (the
    // second line by the same author is refused, probed below).
    const offer = await createConformingOffer();
    const candidate = offer.candidates[0]!.id;
    const other = offer.candidates[1]!.id;
    const kept = await call("POST", `/candidates/${candidate}/note`, {
      author: HOUSEHOLD,
      text: "kept for the smell",
      shared_with: [],
    });
    expect(kept.status).toBe(201);
    const unshared = await call("GET", `/candidates/${candidate}/note?as=merchant`);
    expect(unshared.status).toBe(404);

    const shared = await call("POST", `/candidates/${other}/note`, {
      author: HOUSEHOLD,
      text: "the tin is hard to open",
      shared_with: ["merchant"],
    });
    expect(shared.status).toBe(201);
    const read = await call("GET", `/candidates/${other}/note?as=merchant`);
    expect(read.status).toBe(200);
    const notes = (read.body as { notes: { text: string }[] }).notes;
    expect(notes.map((n) => n.text)).toEqual(["the tin is hard to open"]);
    expect(findKey(read.body, meansAnyOf(["rating", "score", "stars", "sentiment", "count", "total"]))).toEqual([]);
  });

  test("a writer has one line per candidate", async () => {
    // NOTE (mutation check, 2026-09-09): notes_append let the same author
    // add a second line to a candidate. This assertion failed with 201. A
    // list of lines per candidate is a count, and a count is an aggregate.
    const offer = await createConformingOffer();
    const candidate = offer.candidates[0]!.id;
    const first = await call("POST", `/candidates/${candidate}/note`, {
      author: HOUSEHOLD, text: "kept for the smell", shared_with: [],
    });
    expect(first.status).toBe(201);
    const second = await call("POST", `/candidates/${candidate}/note`, {
      author: HOUSEHOLD, text: "and the colour", shared_with: [],
    });
    expect(second.status).toBe(409);
  });

  test("a line reaches the recipient unless the writer says otherwise (clause 27)", async () => {
    // NOTE (mutation check, 2026-09-09): note_default_nobody defaulted
    // shared_with to nobody, so a line written before giving reached no one.
    // The first assertion failed with 404. A default of nobody makes a
    // writer opt in to the thing the field exists for.
    const offer = await createConformingOffer();
    const [a, b] = offer.candidates;
    const written = await call("POST", `/candidates/${a!.id}/note`, {
      author: HOUSEHOLD,
      text: "this one made me think of you",
    });
    expect(written.status).toBe(201);
    const toRecipient = await call("GET", `/candidates/${a!.id}/note?as=recipient`);
    expect(toRecipient.status).toBe(200);
    // The merchant is never a default: it is a party to the trade, not the gift.
    const toMerchant = await call("GET", `/candidates/${a!.id}/note?as=merchant`);
    expect(toMerchant.status).toBe(404);

    // A writer who wants it kept to themselves says so.
    const private_ = await call("POST", `/candidates/${b!.id}/note`, {
      author: HOUSEHOLD,
      text: "kept for the smell",
      shared_with: [],
    });
    expect(private_.status).toBe(201);
    const nobody = await call("GET", `/candidates/${b!.id}/note?as=recipient`);
    expect(nobody.status).toBe(404);
  });

  test("no route turns lines into a number", async () => {
    // NOTE (mutation check, 2026-09-09): notes_summary_route registered
    // GET /notes/summary?product= returning a count and a sentiment. This
    // assertion failed with 200.
    for (const path of ["/notes/summary?product=tea-a", "/notes?product=tea-a", "/products/tea-a/notes", "/reviews?product=tea-a"]) {
      const read = await call("GET", path);
      expect(read.status).toBe(404);
    }
  });

  test("a line cannot be shared with anyone but the recipient and the merchant", async () => {
    // NOTE (mutation check, 2026-09-09): any_party_note accepted any party
    // name in shared_with. This assertion failed with 201.
    const offer = await createConformingOffer();
    const posted = await call("POST", `/candidates/${offer.candidates[0]!.id}/note`, {
      author: HOUSEHOLD,
      text: "kept for the smell",
      shared_with: ["public"],
    });
    expect(posted.status).toBe(400);
  });
});

describe("absence: no identity and no credential reaches the merchant (clause 49)", () => {
  /**
   * Clause 49, as rewritten on 2026-09-09. An offer, a receipt and a
   * delivery carry a key, a token and a delivery code, and no field for a
   * name, an address, a card or a contact. The walk covers the documents a
   * merchant-side implementation returns about a household.
   */
  const CREDENTIAL_KEYS = [
    "address",
    "postal_code",
    "postcode",
    "zip",
    "street",
    "name",
    "full_name",
    "given_name",
    "family_name",
    "phone",
    "telephone",
    "email",
    "card",
    "card_number",
    "pan",
    "cvv",
    "expiry_month",
    "iban",
    "account_number",
  ];

  test("an offer and its settlement carry no name, address, card or contact", async () => {
    // NOTE (mutation check, 2026-09-09): address_on_offer put a delivery
    // address on the offer serialisation. This assertion failed, naming
    // `address`. A delivery goes to a code, never to an address; an offer
    // is the merchant learning where the household lives.
    const offer = await createConformingOffer();
    const read = await call("GET", `/offers/${offer.id}`);
    expect(findKey(read.body, meansAnyOf(CREDENTIAL_KEYS))).toEqual([]);
    await call("POST", `/offers/${offer.id}/present`, {});
    await decide(offer.id, {
      decisions: offer.candidates.map((c, i) => ({
        candidate: c.id,
        valence: i === 0 ? "kept" : "returned",
        ...(i === 0 ? { kept_as: "self" } : {}),
      })),
    });
    const settled = await call("POST", `/offers/${offer.id}/settle`, {});
    expect(settled.status).toBe(200);
    expect(findKey(settled.body, meansAnyOf(CREDENTIAL_KEYS))).toEqual([]);
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
      shared_with: [],
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
    await decide(offer.id, {
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

describe("absence: aggregates that must not be displayed (§7.7)", () => {
  test("the household's offer list carries no total and no ranking", async () => {
    // NOTE (mutation check, re-anchored 2026-09-09): list_total adds a
    // `total` beside `offers` in the list response. This assertion fails,
    // naming `total`. The script's anchor had drifted when the list gained a
    // presenter, so it silently changed nothing for a while; mutate.sh now
    // refuses a mutation that changes nothing.
    const list = await call(
      "GET",
      `/offers?household=${encodeURIComponent(HOUSEHOLD)}&presenter=${encodeURIComponent(await presenter())}`
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

describe("absence: the delivery code stays on the person's side (clause 49, §7.5b)", () => {
  /**
   * Clause 49 keeps identity from the merchant, and a carrier's code is not an
   * address and resolves to one. A merchant holding it reads where the
   * household lives from the carrier, with no field for an address anywhere.
   * So the wall is not "no address field", it is "nothing that resolves to
   * one", and this is where that distinction is checked.
   */
  test("a delivery is readable on the household's surface", async () => {
    // NOTE (mutation check, 2026-09-10): delivery_on_the_offer moves carriage
    // and the code onto the offer, where a merchant reads them. This assertion
    // is the control for that one: the surface has to work before its absence
    // elsewhere means anything.
    const offer = await createConformingOffer();
    const put = await call("POST", `/offers/${offer.id}/delivery`, {
      carriage: 550,
      code: "dc-probe-1",
      status: "in_transit",
    });
    expect(put.status).toBe(201);
    const got = await call("GET", `/offers/${offer.id}/delivery`);
    expect(got.status).toBe(200);
    const d = got.body as { carriage: number; code: string; status: string };
    expect(d.carriage).toBe(550);
    expect(d.code).toBe("dc-probe-1");
    expect(d.status).toBe("in_transit");
  });

  test("the code and the carriage are on no merchant-facing surface", async () => {
    // NOTE (mutation check, 2026-09-10): delivery_on_the_offer serialises the
    // delivery onto the offer. This assertion failed, naming `code`.
    const offer = await createConformingOffer();
    await call("POST", `/offers/${offer.id}/delivery`, {
      carriage: 550,
      code: "dc-probe-2",
      status: "in_transit",
    });
    for (const path of [`/offers/${offer.id}`, `/offers/${offer.id}/settlement`]) {
      const seen = await call("GET", path);
      const text = JSON.stringify(seen.body ?? {});
      expect(text).not.toContain("dc-probe-2");
      expect(text.toLowerCase()).not.toContain("carriage");
    }
  });

  test("a merchant's export carries no delivery", async () => {
    // NOTE (mutation check, 2026-09-10): merchant_export_leaks_delivery adds
    // the deliveries to valence-merchant/1. This assertion failed.
    const offer = await createConformingOffer();
    await call("POST", `/offers/${offer.id}/delivery`, {
      carriage: 550,
      code: "dc-probe-3",
      status: "delivered",
    });
    const who = await presenter();
    const exported = await call("GET", `/presenters/${encodeURIComponent(who)}/export`);
    expect(exported.status).toBe(200);
    expect(JSON.stringify(exported.body)).not.toContain("dc-probe-3");
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
    // does not have is not possible from outside, and clause 29 forbids the
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

  test("every candidate names who made it and who ships it", async () => {
    // NOTE (mutation check, 2026-09-09): hide_merchant_on_candidate dropped
    // `merchant` and `ships` from the candidate serialisation. This assertion
    // failed. The probe above reads the presenter, which is the curator; the
    // maker was invisible on every candidate until this probe asked, and in
    // a gift flow the maker is the party clause 12 is about.
    const offer = await createConformingOffer();
    const read = await call("GET", `/offers/${offer.id}`);
    const candidates = (read.body as { candidates: { merchant?: unknown; ships?: unknown }[] }).candidates;
    expect(candidates.length).toBeGreaterThan(0);
    for (const c of candidates) {
      expect(typeof c.merchant).toBe("string");
      expect(c.merchant).not.toBe("");
      expect(typeof c.ships).toBe("string");
      expect(c.ships).not.toBe("");
    }
  });

  test("every line of a receipt names its merchant of record (clause 11)", async () => {
    // NOTE (mutation check, 2026-09-09): settlement_lines_without_merchant
    // kept the lines and blanked the merchant on each. This assertion
    // failed. A receipt that totals without saying who sold each item has
    // put the curator where the seller should be.
    const offer = await createConformingOffer();
    await call("POST", `/offers/${offer.id}/present`, {});
    await decide(offer.id, {
      decisions: offer.candidates.map((c, i) => ({
        candidate: c.id,
        valence: i === 0 ? "kept" : "returned",
        ...(i === 0 ? { kept_as: "self" } : {}),
      })),
    });
    const settled = await call("POST", `/offers/${offer.id}/settle`, {});
    expect(settled.status).toBe(200);
    const body = settled.body as {
      lines?: { merchant?: unknown }[];
      signed_by?: unknown;
      signed_as?: unknown;
    };
    expect(Array.isArray(body.lines)).toBe(true);
    expect(body.lines!.length).toBeGreaterThan(0);
    for (const line of body.lines!) {
      expect(typeof line.merchant).toBe("string");
      expect(line.merchant).not.toBe("");
    }
    expect(body.signed_as).toBe("agent");
    expect(typeof body.signed_by).toBe("string");
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
