import { describe, expect, test } from "bun:test";
import {
  call,
  conformingOffer,
  createConformingOffer,
  decide,
  findKey,
  meansAnyOf,
  PRICES,
  signDecisions,
  assertDecisions,
} from "../lib/probe.js";

/**
 * Clauses 36, 54, 58 and 59, and §10 of the specification.
 *
 * The screen a household is asked to sign, drawn by a party to no transaction.
 *
 * Every other suite here checks what an implementation must not do. This one
 * checks three things it must: carry the alternatives and the argument against
 * a proposal, say why anything was left out, and carry no presentation of its
 * own. The last is what makes the first two mean anything. A contract through
 * which a merchant can pass markup is a screen the merchant draws, whatever
 * else it carries.
 */

/** Anything through which a merchant could draw the screen. */
const PRESENTATION_KEYS = [
  "html",
  "markup",
  "style",
  "styles",
  "css",
  "template",
  "render",
  "layout",
  "banner",
  "image",
  "image_url",
  "position",
  "rank",
  "order",
  "sort",
  "priority",
  "weight",
  "boost",
];

async function deliberated(overrides: Record<string, unknown> = {}) {
  const offer = await createConformingOffer();
  const perCandidate: Record<string, unknown> = {};
  for (const c of offer.candidates) {
    perCandidate[c.id] = {
      alternatives: ["the same tea in a smaller tin"],
      argument_against: "you have two of these already",
    };
  }
  const recorded = await call("POST", `/offers/${offer.id}/deliberation`, {
    per_candidate: perCandidate,
    excluded: [{ product: "coffee-a", reason: "auto_renewal" }],
    mandate: { kind: "individual", scope: "this offer", lapses_at: null },
    ...overrides,
  });
  return { offer, recorded };
}

describe("approval: what a proposal must carry (clause 59)", () => {
  test("every candidate carries alternatives and the argument against it", async () => {
    // NOTE (mutation check, 2026-09-09): renders_empty_alternatives leaves the
    // guard intact and empties the serialisation, so the screen renders 200
    // with no alternatives and this assertion fails. An agent that proposes
    // without saying what else it considered has made the household's tap a
    // formality, which is what clause 59 exists to prevent.
    // This note used to name approval_without_deliberation. The full
    // re-measurement showed that mutation breaks the guard instead, so the two
    // refusal probes below catch it and this one never sees it. A note is a
    // claim; only the measurement says whether it is true.
    const { offer } = await deliberated();
    const approval = await call("GET", `/offers/${offer.id}/approval`);
    expect(approval.status).toBe(200);
    const body = approval.body as {
      candidates: { alternatives: string[]; argument_against: string }[];
    };
    expect(body.candidates.length).toBeGreaterThan(0);
    for (const candidate of body.candidates) {
      expect(candidate.alternatives.length).toBeGreaterThan(0);
      expect(candidate.argument_against).not.toBe("");
    }
  });

  test("an approval is refused when a candidate carries an empty argument", async () => {
    // NOTE (mutation check, 2026-09-09): empty_alternatives kept the check for
    // a missing entry and dropped the check that the entry says anything. The
    // probe above passed, because a well-formed deliberation still renders. It
    // is caught only by recording a deliberation that is present and empty,
    // which is what an agent under time pressure would actually send.
    const offer = await createConformingOffer();
    const perCandidate: Record<string, unknown> = {};
    for (const c of offer.candidates) {
      // An empty argument is refused at the door by the body check, so the
      // shape that reaches the renderer is this one: present, well formed,
      // and saying nothing.
      perCandidate[c.id] = { alternatives: [], argument_against: "none" };
    }
    const recorded = await call("POST", `/offers/${offer.id}/deliberation`, {
      per_candidate: perCandidate,
      excluded: [],
      mandate: { kind: "individual", scope: "this offer", lapses_at: null },
    });
    expect(recorded.status).toBe(201);

    const approval = await call("GET", `/offers/${offer.id}/approval`);
    expect([404, 422]).toContain(approval.status);
  });

  test("an approval is refused when the proposal carries neither", async () => {
    // NOTE (mutation check, 2026-09-09): approval_without_deliberation
    // rendered from the offer alone, with no deliberation recorded at all.
    // This assertion failed. A hub that draws a screen anyway has made
    // clause 59 advisory.
    // The half that matters more. A hub that renders a screen anyway has made
    // clause 59 advisory.
    const offer = await createConformingOffer();
    const approval = await call("GET", `/offers/${offer.id}/approval`);
    expect([404, 422]).toContain(approval.status);
  });

  test("the reason a candidate was left out is shown (clause 36)", async () => {
    // NOTE (mutation check, 2026-09-09): drop_excluded_reasons emptied the
    // excluded list on the way to the screen. This assertion failed. Clause 36
    // is about what did not happen, which no other surface reports.
    const { offer } = await deliberated();
    const approval = await call("GET", `/offers/${offer.id}/approval`);
    const body = approval.body as { excluded: { product: string; reason: string }[] };
    expect(body.excluded.length).toBeGreaterThan(0);
    for (const row of body.excluded) {
      expect(row.reason).not.toBe("");
    }
  });

  test("a reason outside the published rules is refused (clause 6)", async () => {
    // NOTE (mutation check, 2026-09-09): free_text_reason removed the check
    // that a reason names a published rule. The deliberation was recorded
    // with 201 and this assertion failed. A reason that can say anything is
    // a routing rule nobody can audit, whatever the screen shows.
    const { recorded } = await deliberated({
      excluded: [{ product: "coffee-a", reason: "auto-renewing subscription" }],
    });
    expect(recorded.status).toBe(400);
  });
});

describe("approval: the merchant does not draw the screen (clause 54)", () => {
  test("no field carries presentation", async () => {
    // NOTE (mutation check, 2026-09-09): presentation_on_approval added a
    // `banner` and a `rank` to each candidate. This assertion failed, naming
    // both. Clause 54 says the screen is drawn by a party to no transaction,
    // and one field a merchant can fill is enough to make that false.
    const { offer } = await deliberated();
    const approval = await call("GET", `/offers/${offer.id}/approval`);
    expect(findKey(approval.body, meansAnyOf(PRESENTATION_KEYS))).toEqual([]);
  });

  test("no field's value is markup", async () => {
    // NOTE (mutation check, 2026-09-09): markup_in_argument wrapped the
    // argument in a div. This assertion failed. A field named innocently
    // can still carry a tag.
    // The other half. A field named innocently can still carry a tag.
    const { offer } = await deliberated();
    const approval = await call("GET", `/offers/${offer.id}/approval`);
    const text = approval.text;
    for (const marker of ["<div", "<img", "<span", "<script", "style=", "<a ", "&lt;div"]) {
      expect(text).not.toContain(marker);
    }
  });

  test("a deliberation that carries presentation is refused at the door", async () => {
    // NOTE (mutation check, 2026-09-09): strict_drops_unknown made the
    // body check discard unknown fields, so the banner was accepted and
    // quietly dropped. This assertion failed. A merchant that sends
    // presentation and receives a 201 has been told the field exists.
    const offer = await createConformingOffer();
    const perCandidate: Record<string, unknown> = {};
    for (const c of offer.candidates) {
      perCandidate[c.id] = {
        alternatives: ["a smaller tin"],
        argument_against: "you have two already",
        banner: "<img src=x>",
      };
    }
    const recorded = await call("POST", `/offers/${offer.id}/deliberation`, {
      per_candidate: perCandidate,
      excluded: [],
      mandate: { kind: "individual", scope: "this offer", lapses_at: null },
    });
    expect(recorded.status).toBe(400);
  });
});

describe("approval: the mandate (clauses 33, 58)", () => {
  test("a standing mandate cannot be recorded without a lapse", async () => {
    // NOTE (mutation check, 2026-09-09): standing_never_lapses accepted one
    // with no lapses_at. This assertion failed with 201. Clause 58 says a
    // standing mandate lapses unless renewed, and a mandate with no lapse is
    // the blanket consent clause 37 removes from the settings screen arriving
    // by another door.
    const offer = await createConformingOffer();
    const perCandidate: Record<string, unknown> = {};
    for (const c of offer.candidates) {
      perCandidate[c.id] = {
        alternatives: ["a smaller tin"],
        argument_against: "you have two already",
      };
    }
    const recorded = await call("POST", `/offers/${offer.id}/deliberation`, {
      per_candidate: perCandidate,
      excluded: [],
      mandate: { kind: "standing", scope: "weekly staples", lapses_at: null },
    });
    expect([400, 422]).toContain(recorded.status);
  });

  test("the mandate arrives complete, so one tap is enough (clause 33)", async () => {
    // NOTE (mutation check, 2026-09-09): mandate_scope_blank emptied the
    // scope. This assertion failed. A mandate with no scope is not one a
    // person can sign in one tap.
    const { offer } = await deliberated();
    const approval = await call("GET", `/offers/${offer.id}/approval`);
    const body = approval.body as {
      mandate: { kind: string; scope: string };
      expires_at: number;
    };
    expect(["standing", "individual"]).toContain(body.mandate.kind);
    expect(body.mandate.scope).not.toBe("");
    expect(typeof body.expires_at).toBe("number");
  });

  test("the screen says whether the one reminder has gone, not how many remain", async () => {
    // NOTE (mutation check, 2026-09-09): reminded_never_true reported
    // false always and added a count of what remained. This assertion
    // failed on both halves.
    const { offer } = await deliberated();
    await call("POST", `/offers/${offer.id}/present`, {});
    const before = await call("GET", `/offers/${offer.id}/approval`);
    expect((before.body as { reminded: boolean }).reminded).toBe(false);

    await call("POST", `/offers/${offer.id}/remind`, {});
    const after = await call("GET", `/offers/${offer.id}/approval`);
    expect((after.body as { reminded: boolean }).reminded).toBe(true);
    expect(findKey(after.body, meansAnyOf(["reminders_left", "remaining", "count"]))).toEqual([]);
  });
});

describe("approval: a confirmation is the person's signature (clause 35)", () => {
  /**
   * Clause 35, as rewritten on 2026-09-09. The decided set is signed as the
   * mandate, and nothing settles on an unsigned set or on a set other than
   * the one signed. The probe posts the same set three ways: unsigned,
   * signed over a different set, and signed.
   */
  test("an unsigned decided set is refused", async () => {
    // NOTE (mutation check, 2026-09-09): accept_unsigned_decisions skipped
    // the signature check. The first two assertions failed: a set with a
    // signature over nothing, and one signed over another set, were both
    // taken as the person's word.
    const offer = await createConformingOffer();
    await call("POST", `/offers/${offer.id}/present`, {});
    const set = offer.candidates.map((c, i) => ({
      candidate: c.id,
      valence: i === 0 ? "kept" : "returned",
      ...(i === 0 ? { kept_as: "self" } : {}),
    }));
    const unsigned = await call("POST", `/offers/${offer.id}/decisions`, { decisions: set, signature: "" });
    expect([400, 422]).toContain(unsigned.status);

    const other = set.map((d) => ({ ...d, valence: "returned" as const, kept_as: undefined }));
    const wrongSet = await call("POST", `/offers/${offer.id}/decisions`, {
      decisions: set,
      signature: signDecisions(offer.id, other.map(({ candidate, valence }) => ({ candidate, valence }))),
    });
    expect(wrongSet.status).toBe(422);

    const read = await call("GET", `/offers/${offer.id}`);
    expect((read.body as { state: string }).state).toBe("presented");

    const signed = await decide(offer.id, { decisions: set });
    expect(signed.status).toBe(200);
  });
});

/** An offer a person can decide on: created, then presented. */
async function presentedOffer(): Promise<{ id: string; candidates: { id: string }[] }> {
  const offer = await createConformingOffer();
  const shown = await call("POST", `/offers/${offer.id}/present`, {});
  expect(shown.status).toBe(200);
  return shown.body as { id: string; candidates: { id: string }[] };
}

describe("approval: a passkey confirms by challenge (§10.5)", () => {
  /**
   * Written 2026-09-11, when building the member's side found that the
   * specification asked for something no password manager can do. An
   * authenticator signs its own data and the hash of the client's, never bytes
   * a caller hands it, so the decided set travels as the **challenge**.
   *
   * That is why the challenge here is not random. A random one proves a person
   * was present; clause 35 asks what they agreed to.
   */
  test("an assertion whose challenge is this set confirms it", async () => {
    // NOTE (mutation check, 2026-09-11): assertion_challenge_unchecked drops
    // the comparison. This assertion failed with 200 for a set the person
    // never saw.
    const offer = await presentedOffer();
    const decisions = offer.candidates.map((c) => ({
      candidate: c.id,
      valence: "returned" as const,
    }));
    const response = await call("POST", `/offers/${offer.id}/decisions`, {
      decisions,
      assertion: assertDecisions(offer.id, decisions),
    });
    expect(response.status).toBe(200);
    expect((response.body as { state: string }).state).toBe("decided");
  });

  test("an assertion for another set does not confirm this one", async () => {
    const offer = await presentedOffer();
    const decisions = offer.candidates.map((c) => ({
      candidate: c.id,
      valence: "returned" as const,
    }));
    const elsewhere = assertDecisions("some-other-offer", decisions);
    const response = await call("POST", `/offers/${offer.id}/decisions`, {
      decisions,
      assertion: elsewhere,
    });
    expect(response.status).toBe(422);
    expect((response.body as { error: string }).error).toBe("bad_signature");
  });

  test("a registration ceremony is not a confirmation", async () => {
    // NOTE (mutation check, 2026-09-11): assertion_accepts_registration stops
    // checking which ceremony the assertion came from. Until this probe was
    // written the requirement was held by a unit test alone, which is proof
    // about one engine rather than about an implementation, and the mutation
    // failed nothing here.
    //
    // `webauthn.create` proves a person made a key. Clause 35 asks what they
    // agreed to, and a key that has just been made has agreed to nothing.
    const offer = await presentedOffer();
    const decisions = offer.candidates.map((c) => ({
      candidate: c.id,
      valence: "returned" as const,
    }));
    const response = await call("POST", `/offers/${offer.id}/decisions`, {
      decisions,
      assertion: assertDecisions(offer.id, decisions, "webauthn.create"),
    });
    expect(response.status).toBe(422);
    expect((response.body as { error: string }).error).toBe("bad_signature");
  });

  test("a set carries a signature or an assertion, and not both", async () => {
    // A body with both leaves which one was checked to the implementation, and
    // a caller could then satisfy the weaker.
    const offer = await presentedOffer();
    const decisions = offer.candidates.map((c) => ({
      candidate: c.id,
      valence: "returned" as const,
    }));
    const response = await call("POST", `/offers/${offer.id}/decisions`, {
      decisions,
      signature: signDecisions(offer.id, decisions),
      assertion: assertDecisions(offer.id, decisions),
    });
    expect(response.status).toBe(400);
  });
});

describe("approval: a refused set writes nothing (§10.5)", () => {
  test("a set with one bad line leaves every candidate as it was", async () => {
    // NOTE (mutation check, 2026-09-09): decide_writes_on_refusal wrote each
    // line as it was checked, so a set refused on its second line left its
    // first line kept. This assertion failed: the offer read back with one
    // candidate decided under a signature that covered a different set.
    const offer = await createConformingOffer();
    await call("POST", `/offers/${offer.id}/present`, {});
    const [first, second, ...rest] = offer.candidates;
    const refused = await decide(offer.id, {
      decisions: [
        { candidate: first!.id, valence: "kept", kept_as: "self" },
        { candidate: second!.id, valence: "kept" },
        ...rest.map((c) => ({ candidate: c.id, valence: "returned" })),
      ],
    });
    expect([400, 422]).toContain(refused.status);
    const read = await call("GET", `/offers/${offer.id}`);
    const body = read.body as { state: string; candidates: { valence: string }[] };
    expect(body.state).toBe("presented");
    for (const c of body.candidates) expect(c.valence).toBe("offered");
  });
});

describe("approval: the screen names who made it, who ships it, and the band (clauses 12, 23)", () => {
  test("every candidate on the screen names its maker and its carrier", async () => {
    // NOTE (mutation check, 2026-09-09): approval_hides_maker dropped
    // merchant and ships from the rendered candidate and blanked the band.
    // This assertion failed. The refutation pass found clause 12 probed on
    // the offer view while the screen a person signs from named neither.
    const { offer } = await deliberated();
    const approval = await call("GET", `/offers/${offer.id}/approval`);
    expect(approval.status).toBe(200);
    const body = approval.body as { candidates: { merchant?: unknown; ships?: unknown }[] };
    for (const c of body.candidates) {
      expect(typeof c.merchant).toBe("string");
      expect(c.merchant).not.toBe("");
      expect(typeof c.ships).toBe("string");
      expect(c.ships).not.toBe("");
    }
  });

  test("a ceremonial screen carries the band the giver chose", async () => {
    const prices = Object.values(PRICES);
    const band = { min: Math.min(...prices), max: Math.max(...prices) };
    const offer = await createConformingOffer({ purpose: "ceremonial", price_band: band });
    const perCandidate: Record<string, unknown> = {};
    for (const c of offer.candidates) {
      perCandidate[c.id] = { alternatives: ["another in the band"], argument_against: "you may not need it" };
    }
    await call("POST", `/offers/${offer.id}/deliberation`, {
      per_candidate: perCandidate,
      excluded: [],
      mandate: { kind: "individual", scope: "this offer", lapses_at: null },
    });
    const approval = await call("GET", `/offers/${offer.id}/approval`);
    expect(approval.status).toBe(200);
    expect((approval.body as { price_band?: unknown }).price_band).toEqual(band);
  });
});

describe("approval: one set of endpoints, whoever calls (clause 34)", () => {
  test("an offer is accepted from another client as it is from the reference hub", async () => {
    // NOTE (mutation check, 2026-09-09): reject_foreign_offer_client refused
    // POST /offers unless the user-agent was the reference hub's. The second
    // assertion failed with 403. The person's own agent calls the same
    // endpoints the merchant's does, or clause 34 is a sentence.
    const fromReference = await call("POST", "/offers", conformingOffer(), {
      "user-agent": "atarasy-reference/0.0.0",
    });
    expect(fromReference.status).toBe(201);
    const fromElsewhere = await call("POST", "/offers", conformingOffer(), {
      "user-agent": "some-other-agent/9.9.9",
      "x-client": "the person's own",
    });
    expect(fromElsewhere.status).toBe(201);
    const a = Object.keys(fromReference.body as object).sort();
    const b = Object.keys(fromElsewhere.body as object).sort();
    expect(b).toEqual(a);
  });
});
