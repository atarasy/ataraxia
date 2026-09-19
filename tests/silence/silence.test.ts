import { describe, expect, test } from "bun:test";
import { generateKeyPairSync, sign } from "node:crypto";
import {
  BASE,
  call,
  canonicalGift,
  CONFIG_VERSION_LATER,
  conformingOffer,
  createConformingOffer,
  createMixedOffer,
  decide,
  keyForHousehold,
  ownMandate,
  PRICES,
  PRICES_LATER,
  PRODUCTS,
  REPRICED,
  RP_ID,
  signGift,
  sleep,
  soon,
} from "../lib/probe.js";

/**
 * Clauses 32, 33 and specification §2.2.
 *
 * An undecided digital offer creates no order at expiry, no configuration
 * makes silence into consent, and at most one reminder is sent.
 *
 * The probes wait out a real expiry rather than asking the implementation to
 * pretend one happened. An implementation that only expires on a nudge from
 * the presenter has left the default in the presenter's hands, which is the
 * arrangement clause 32 exists to forbid.
 */

const EXPIRY_MS = 2_000;

describe("silence: expiry", () => {
  test("an undecided digital offer settles at zero", async () => {
    // NOTE (mutation check, 2026-09-08): silence_is_consent made an
    // undecided candidate `kept` with kept_as `order` at expiry. This
    // assertion failed with a kept_amount of 5400.
    // A mixed offer, not an all-exploration one. See the note below.
    const offer = await createMixedOffer({ expires_at: soon(EXPIRY_MS) });
    const presented = await call("POST", `/offers/${offer.id}/present`, {});
    expect(presented.status).toBe(200);

    await sleep(EXPIRY_MS + 500);

    const settled = await call("POST", `/offers/${offer.id}/settle`, {});
    expect(settled.status).toBe(200);
    const settlement = settled.body as {
      kept_amount: number;
      consumed_amount: number;
    };
    expect(settlement.kept_amount).toBe(0);
    expect(settlement.consumed_amount).toBe(0);
  });

  test("every undecided candidate becomes returned, none kept", async () => {
    // NOTE (mutation check, 2026-09-08): silence_consent_non_exploration kept
    // the ordinary candidates at expiry and returned only the exploration
    // ones. Every silence probe passed, because the offer they used was made
    // entirely of exploration candidates. The offers here are mixed now, and
    // this assertion catches it.
    // NOTE (mutation check, 2026-09-08): silence_is_consent, as above.
    // This assertion failed on the valence of every candidate.
    const offer = await createMixedOffer({ expires_at: soon(EXPIRY_MS) });
    expect(offer.candidates.some((c) => c.is_exploration)).toBe(true);
    expect(offer.candidates.some((c) => !c.is_exploration)).toBe(true);
    await call("POST", `/offers/${offer.id}/present`, {});
    await sleep(EXPIRY_MS + 500);

    const read = await call("GET", `/offers/${offer.id}`);
    expect(read.status).toBe(200);
    const body = read.body as {
      state: string;
      candidates: { valence: string }[];
    };
    expect(body.state).toBe("expired");
    expect(body.candidates.every((c) => c.valence === "returned")).toBe(true);
  });

  test("an expired offer cannot be decided", async () => {
    // NOTE (mutation check, 2026-09-08): decide_after_expiry allowed a
    // decision on an expired offer. This assertion failed with 200: an offer
    // that can still be decided after expiry has no expiry.
    const offer = await createConformingOffer({ expires_at: soon(EXPIRY_MS) });
    await call("POST", `/offers/${offer.id}/present`, {});
    await sleep(EXPIRY_MS + 500);

    const decided = await decide(offer.id, {
      decisions: [
        { candidate: offer.candidates[0]!.id, valence: "kept", kept_as: "self" },
      ],
    });
    expect(decided.status).toBe(409);
  });
});

describe("silence: no configuration makes it consent", () => {
  test("an offer cannot declare a default of kept", async () => {
    // NOTE (mutation check, 2026-09-08): strict-drops-unknown. All four
    // shapes returned 201 with the field discarded, and this assertion failed.
    for (const bypass of [
      { default_valence: "kept" },
      { on_expiry: "keep" },
      { auto_confirm: true },
      { silence_is_consent: true },
    ]) {
      const created = await call("POST", "/offers", conformingOffer(bypass));
      expect(created.status).toBe(400);
    }
  });

  test("a header does not turn silence into an order", async () => {
    // NOTE (mutation check, 2026-09-08): silence_is_consent, as above.
    // The headers are inert either way; what this probe catches is an expiry
    // default that was changed anywhere at all.
    const offer = await createMixedOffer({ expires_at: soon(EXPIRY_MS) });
    await call("POST", `/offers/${offer.id}/present`, {});
    await sleep(EXPIRY_MS + 500);

    const settled = await call(
      "POST",
      `/offers/${offer.id}/settle`,
      {},
      { "x-on-expiry": "keep", "x-auto-confirm": "true" }
    );
    expect(settled.status).toBe(200);
    expect((settled.body as { kept_amount: number }).kept_amount).toBe(0);
  });
});

describe("silence: reminders (clause 33)", () => {
  test("the second reminder is refused", async () => {
    // NOTE (mutation check, 2026-09-08): many_reminders raised the
    // limit to five. This assertion failed with 200 on the second call.
    const offer = await createConformingOffer();
    await call("POST", `/offers/${offer.id}/present`, {});
    const first = await call("POST", `/offers/${offer.id}/remind`, {});
    expect(first.status).toBe(200);
    const second = await call("POST", `/offers/${offer.id}/remind`, {});
    expect(second.status).toBe(409);
  });

  test("the refusal is not a rate limit a caller waits out", async () => {
    // NOTE (mutation check, 2026-09-08): many_reminders, as above, and
    // reminder_rate_limit, which turned the refusal into a five-second
    // backoff. The first version of this probe waited 1.1 seconds and passed
    // through the backoff without noticing. It waits longer than any
    // plausible short backoff now, and reads the refusal for the vocabulary
    // of one.
    //
    // This cannot be closed by waiting. An implementation that backs off for
    // an hour passes, and a probe cannot outlast an arbitrary delay. What is
    // checkable is that the refusal does not promise a later yes.
    const offer = await createConformingOffer();
    await call("POST", `/offers/${offer.id}/present`, {});
    await call("POST", `/offers/${offer.id}/remind`, {});
    await sleep(6_000);
    const again = await call("POST", `/offers/${offer.id}/remind`, {});
    expect(again.status).toBe(409);
    for (const promise of ["retry", "wait", "later", "again", "yet", "seconds"]) {
      expect(again.text.toLowerCase()).not.toContain(promise);
    }
    // The wait is longer than the runner's default per-test timeout, so the
    // timeout is raised rather than the wait shortened. A probe that waits
    // less than a backoff proves nothing about the backoff.
  }, 30_000);
});

describe("silence: the ceremonial default (clause 25, §2.2, §12)", () => {
  /**
   * The third row of the §2.2 table, and the only one where expiry ships
   * something. A recipient who chooses nothing still receives, because the
   * giver has already paid a price band and clause 25 forbids earning
   * anything from an offer nobody redeemed.
   *
   * This is also the row where an implementation can be quietly profitable by
   * doing nothing, which is why it is worth a probe of its own.
   */
  test("the offer carries the band the giver chose, and a candidate outside it is refused (clause 23)", async () => {
    // NOTE (mutation check, 2026-09-09): ignore_band kept the band on the
    // offer and stopped checking candidates against it. The second
    // assertion failed with 201: a candidate priced above the band was
    // offered under it.
    const prices = Object.values(PRICES);
    const band = { min: Math.min(...prices), max: Math.max(...prices) };
    const offer = await createConformingOffer({ purpose: "ceremonial", price_band: band });
    const read = await call("GET", `/offers/${offer.id}`);
    expect((read.body as { price_band?: unknown }).price_band).toEqual(band);

    const tooNarrow = { min: band.min, max: band.min };
    const created = await call("POST", "/offers", conformingOffer({ purpose: "ceremonial", price_band: tooNarrow }));
    expect(created.status).toBe(422);
    // §16.6, extended 2026-09-13 to every refusal the specification names:
    // a probe that checks only the status certifies that something was
    // refused and not that the person can tell which rule refused it.
    expect((created.body as { error: string }).error).toBe("outside_band");
  });

  test("the giver pays a ceremonial offer, never the recipient (clause 25)", async () => {
    // NOTE (mutation check, 2026-09-09): charge_the_recipient reserved and
    // committed against the household on the offer, which on a ceremonial
    // offer is the recipient. This assertion failed: the settlement named
    // the recipient as payer. The refutation pass measured a return gift
    // billed to the person it was sent to.
    const offer = await createConformingOffer({ purpose: "ceremonial" });
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
    const read = await call("GET", `/offers/${offer.id}`);
    const view = read.body as { household: string; giver: string };
    const payer = (settled.body as { payer: string }).payer;
    expect(payer).toBe(view.giver);
    expect(payer).not.toBe(view.household);
  });

  test("a gift is presented only on its giver's signature, over terms the suite computes itself (§12)", async () => {
    // NOTE (mutation check, 2026-09-19): gift_presented_unsigned and
    // gift_signature_unchecked. The first failed with 200 on an empty body,
    // the second with 200 on a stranger's signature.
    //
    // Question 64. A ceremonial offer charges its giver, and the giver was
    // whatever household the presenter wrote: a refutation pass measured a
    // household named as giver charged 1500 without any act of its own.
    const offer = await createConformingOffer({ purpose: "ceremonial" });
    const unsigned = await fetch(`${BASE}/offers/${offer.id}/present`, {
      method: "POST", headers: { "content-type": "application/json" }, body: "{}",
    });
    expect(unsigned.status).toBe(422);
    expect(((await unsigned.json()) as { error: string }).error).toBe("gift_unsigned");

    const stranger = generateKeyPairSync("ed25519").privateKey;
    const read = (await call("GET", `/offers/${offer.id}`)).body as Parameters<typeof canonicalGift>[0];
    const forged = await call("POST", `/offers/${offer.id}/present`, {
      signature: sign(null, canonicalGift(read), stranger).toString("base64"),
    });
    expect(forged.status).toBe(422);
    expect((forged.body as { error: string }).error).toBe("bad_signature");
    expect(((await call("GET", `/offers/${offer.id}`)).body as { state: string }).state).toBe("drafted");

    // The terms the host serves agree with the ones computed here.
    const terms = (await call("GET", `/offers/${offer.id}/gift`)).body as { upper_bound: number; giver: string; recipient: string };
    expect(terms.giver).toBe(read.giver);
    expect(terms.recipient).toBe(read.household);
    expect(terms.upper_bound).toBe(read.candidates.reduce((sum, c) => sum + (c.given_by ? 0 : c.unit_price * c.quantity), 0));

    const signed = await call("POST", `/offers/${offer.id}/present`, { signature: signGift(offer.id) });
    expect(signed.status).toBe(200);
    expect((signed.body as { state: string }).state).toBe("presented");
  });

  test("a gift's signature names the host, and its giver is a key (§12, §13.2)", async () => {
    // NOTE (mutation check, 2026-09-19): gift_names_no_host and
    // gift_giver_any_name. The first presented a gift signed for another
    // relying party; the second made a gift from a name that is not a key.
    //
    // Question 58. A gift's bytes named no host, and the giver was any name,
    // so a presenter could register its own key under one and sign as the
    // giver. Measured by the third refutation pass over question 64.
    const offer = await createConformingOffer({ purpose: "ceremonial" });
    const read = (await call("GET", `/offers/${offer.id}`)).body as Parameters<typeof canonicalGift>[0];
    const terms = (await call("GET", `/offers/${offer.id}/gift`)).body as { host: string };
    expect(terms.host).toBe(RP_ID);
    const elsewhere = await call("POST", `/offers/${offer.id}/present`, {
      signature: sign(null, canonicalGift(read, `other.${RP_ID}`), keyForHousehold(read.giver)).toString("base64"),
    });
    expect(elsewhere.status).toBe(422);
    expect((elsewhere.body as { error: string }).error).toBe("bad_signature");

    const named = await call("POST", "/offers", conformingOffer({ purpose: "ceremonial", giver: "grandmother-tanaka" }));
    expect(named.status).toBe(422);
    expect((named.body as { error: string }).error).toBe("name_is_not_the_key");
  });

  test("a gift is held to the giver's daily ceiling, and the recipient's never refuses it (§12, §16.3)", async () => {
    // NOTE (mutation check, 2026-09-19): gift_ceiling_is_the_recipients. The
    // first settle answered 200 and the second 422: the recipient's ceiling
    // was read for a gift the giver pays.
    //
    // Question 60. A daily ceiling protects the person whose money moves. A
    // second refutation pass noted that until this probe the rule rested on
    // the engine's unit tests alone.
    const keepOne = (offer: { candidates: { id: string }[] }) => ({
      decisions: offer.candidates.map((c, i) => ({
        candidate: c.id,
        valence: i === 0 ? "kept" : "returned",
        ...(i === 0 ? { kept_as: "self" } : {}),
      })),
    });

    const tightGiver = await ownMandate({ ceiling_daily: 1 });
    const first = await createConformingOffer({ purpose: "ceremonial", giver: tightGiver.household });
    expect((await call("POST", `/offers/${first.id}/present`, {})).status).toBe(200);
    expect((await decide(first.id, keepOne(first))).status).toBe(200);
    const refused = await call("POST", `/offers/${first.id}/settle`, {});
    expect(refused.status).toBe(422);
    expect((refused.body as { error: string }).error).toBe("mandate_ceiling_daily");

    const tightRecipient = await ownMandate({ ceiling_daily: 1 });
    const second = await createConformingOffer({
      purpose: "ceremonial", household: tightRecipient.household, mandate: tightRecipient.mandate.id,
    });
    expect((await call("POST", `/offers/${second.id}/present`, {})).status).toBe(200);
    expect((await decide(second.id, keepOne(second))).status).toBe(200);
    expect((await call("POST", `/offers/${second.id}/settle`, {})).status).toBe(200);
  });

  test("a recipient who chose one item is sent no default (clause 25)", async () => {
    // NOTE (mutation check, 2026-09-09): default_beside_kept shipped a
    // default at expiry whenever a candidate was undecided, even beside a
    // kept one. This assertion failed: two items shipped and the giver paid
    // twice. "If nothing is chosen" is the whole condition.
    const offer = await createConformingOffer({ purpose: "ceremonial", expires_at: soon(EXPIRY_MS) });
    await call("POST", `/offers/${offer.id}/present`, {});
    const [chosen] = offer.candidates;
    await decide(offer.id, { decisions: [{ candidate: chosen!.id, valence: "kept", kept_as: "self" }] });
    await sleep(EXPIRY_MS + 500);
    const read = await call("GET", `/offers/${offer.id}`);
    const candidates = (read.body as { candidates: { valence: string }[] }).candidates;
    expect(candidates.filter((c) => c.valence === "defaulted").length).toBe(0);
    expect(candidates.filter((c) => c.valence === "kept").length).toBe(1);
  });

  test("the band bounds the line, not the unit (clause 23)", async () => {
    // NOTE (mutation check, 2026-09-09): band_on_unit checked the unit price
    // against the band and let five units of the cheapest product through
    // inside a band that one unit fits. This assertion failed with 201.
    const prices = Object.values(PRICES);
    const band = { min: Math.min(...prices), max: Math.max(...prices) };
    const cheapest = PRODUCTS.find((p) => PRICES[p] === band.min)!;
    const many = Math.ceil(band.max / band.min) + 1;
    const created = await call("POST", "/offers", conformingOffer({
      purpose: "ceremonial",
      price_band: band,
      candidates: [{ product: cheapest, quantity: many, predicted_conversion: 0.5, is_exploration: true }],
    }));
    expect(created.status).toBe(422);
  });

  test("exactly one candidate is defaulted and the rest returned", async () => {
    // NOTE (mutation check, 2026-09-08): unredeemed_revenue removed the
    // ceremonial branch, so every candidate expired as `returned`. This
    // assertion failed: nothing was defaulted, and the giver's price band was
    // kept by the presenter.
    const offer = await createConformingOffer({
      purpose: "ceremonial",
      expires_at: soon(EXPIRY_MS),
    });
    await call("POST", `/offers/${offer.id}/present`, {});
    await sleep(EXPIRY_MS + 500);

    const read = await call("GET", `/offers/${offer.id}`);
    expect(read.status).toBe(200);
    const body = read.body as {
      candidates: { valence: string; unit_price: number; quantity: number }[];
    };
    const defaulted = body.candidates.filter((c) => c.valence === "defaulted");
    expect(defaulted.length).toBe(1);
    expect(
      body.candidates.filter((c) => c.valence === "returned").length
    ).toBe(body.candidates.length - 1);

    const settled = await call("POST", `/offers/${offer.id}/settle`, {});
    expect(settled.status).toBe(200);
    const settlement = settled.body as { kept_amount: number };
    // Charged for the one that shipped, and for nothing else.
    expect(settlement.kept_amount).toBe(
      defaulted[0]!.unit_price * defaulted[0]!.quantity
    );
  });
});

describe("settlement: the offer's own prices (§6.3, §3.1)", () => {
  test("a settlement charges the prices frozen on the offer", async () => {
    // NOTE (mutation check, 2026-09-08): settle_at_current_price made the
    // settlement read the presenter's live catalogue instead of the version
    // stamped on the offer. Against a single catalogue version the amounts
    // agree, so this probe did NOT catch it, and the note says so rather than
    // claiming a catch it did not make. What it does catch is a settlement
    // that charges anything other than the candidate prices the household was
    // shown, which `leak_field_offer_view` and `accepts-unit-price` approach
    // from the other side.
    const offer = await createConformingOffer();
    await call("POST", `/offers/${offer.id}/present`, {});
    const read = await call("GET", `/offers/${offer.id}`);
    const candidates = (read.body as {
      candidates: { id: string; unit_price: number; quantity: number }[];
    }).candidates;

    await decide(offer.id, {
      decisions: candidates.map((c, i) => ({
        candidate: c.id,
        valence: i === 0 ? "kept" : "returned",
        ...(i === 0 ? { kept_as: "self" } : {}),
      })),
    });
    const settled = await call("POST", `/offers/${offer.id}/settle`, {});
    expect(settled.status).toBe(200);
    expect((settled.body as { kept_amount: number }).kept_amount).toBe(
      candidates[0]!.unit_price * candidates[0]!.quantity
    );
  });
});

describe("settlement: terms are frozen at config_version (§6.3)", () => {
  /**
   * The probe this suite was missing. A settlement that reads the presenter's
   * live catalogue instead of the version stamped on the offer agrees with a
   * conforming one whenever there is only one catalogue, which is why the
   * mutation written for §6.3 survived the first four versions of these
   * suites.
   *
   * So the deployment declares a second, later catalogue in which one product
   * has moved, and the probe settles an offer made against the first.
   */
  test("a settlement uses the price stamped on the offer, not the current one", async () => {
    // NOTE (mutation check, 2026-09-08): settle_at_latest_config made the
    // settlement resolve the presenter's newest catalogue rather than the
    // offer's own. This assertion failed, charging the later price. Its
    // predecessor, settle_at_current_price, read the frozen config by another
    // route and was caught by nothing; MUTATIONS.md records both.
    const offer = await createConformingOffer();
    const read = await call("GET", `/offers/${offer.id}`);
    const candidates = (read.body as {
      candidates: { id: string; product: string; unit_price: number; quantity: number }[];
    }).candidates;

    const repriced = candidates.find((c) => c.product === REPRICED);
    expect(repriced).toBeDefined();
    // The offer was stamped with the earlier catalogue.
    expect(repriced!.unit_price).toBe(PRICES[REPRICED]);
    expect(PRICES_LATER[REPRICED]).not.toBe(PRICES[REPRICED]);

    await call("POST", `/offers/${offer.id}/present`, {});
    await decide(offer.id, {
      decisions: candidates.map((c) => ({
        candidate: c.id,
        valence: c.id === repriced!.id ? "kept" : "returned",
        ...(c.id === repriced!.id ? { kept_as: "self" } : {}),
      })),
    });
    const settled = await call("POST", `/offers/${offer.id}/settle`, {});
    expect(settled.status).toBe(200);
    expect((settled.body as { kept_amount: number }).kept_amount).toBe(
      PRICES[REPRICED] * repriced!.quantity
    );
  });

  test("an offer made against the later catalogue carries the later price", async () => {
    // NOTE (mutation check, 2026-09-09): resolve_first_config resolves the
    // presenter's earliest catalogue whatever version the offer named, which
    // would make the freeze probe beside it vacuous. This assertion failed.
    // This note used to name ignore_config_version, which resolves the NEWEST
    // catalogue; for this presenter that is usually the version the probe
    // asked for, so the probe passed and the note was wrong.
    // Guards the probe above from passing because the second catalogue is
    // inert. If this offer also came out at the earlier price, the deployment
    // is not honouring config_version at creation either and the freeze probe
    // would be vacuous.
    const body = conformingOffer({ config_version: CONFIG_VERSION_LATER });
    const created = await call("POST", "/offers", body);
    expect(created.status).toBe(201);
    const candidates = (created.body as {
      candidates: { product: string; unit_price: number }[];
    }).candidates;
    const repriced = candidates.find((c) => c.product === REPRICED);
    expect(repriced!.unit_price).toBe(PRICES_LATER[REPRICED]);
  });
});
