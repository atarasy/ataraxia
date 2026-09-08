import { describe, expect, test } from "bun:test";
import {
  call,
  createConformingOffer,
  findKey,
  meansAnyOf,
} from "../lib/probe.js";

/**
 * Clauses 40, 63, 67 and 68, and §10 of the specification.
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

describe("approval: what a proposal must carry (clause 68)", () => {
  test("every candidate carries alternatives and the argument against it", async () => {
    // NOTE (mutation check, 2026-09-09): approval_without_deliberation
    // rendered the screen from the offer alone. This assertion failed.
    // NOTE (mutation check, 2026-09-09): approval_without_deliberation rendered
    // the screen from the offer alone. This assertion failed. An agent that
    // proposes without saying what else it considered has made the household's
    // tap a formality, which is what clause 68 exists to prevent.
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
    // clause 68 advisory.
    // The half that matters more. A hub that renders a screen anyway has made
    // clause 68 advisory.
    const offer = await createConformingOffer();
    const approval = await call("GET", `/offers/${offer.id}/approval`);
    expect([404, 422]).toContain(approval.status);
  });

  test("the reason a candidate was left out is shown (clause 40)", async () => {
    // NOTE (mutation check, 2026-09-09): drop_excluded_reasons emptied the
    // excluded list on the way to the screen. This assertion failed. Clause 40
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

describe("approval: the merchant does not draw the screen (clause 63)", () => {
  test("no field carries presentation", async () => {
    // NOTE (mutation check, 2026-09-09): presentation_on_approval added a
    // `banner` and a `rank` to each candidate. This assertion failed, naming
    // both. Clause 63 says the screen is drawn by a party to no transaction,
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

describe("approval: the mandate (clauses 37, 67)", () => {
  test("a standing mandate cannot be recorded without a lapse", async () => {
    // NOTE (mutation check, 2026-09-09): standing_never_lapses accepted one
    // with no lapses_at. This assertion failed with 201. Clause 67 says a
    // standing mandate lapses unless renewed, and a mandate with no lapse is
    // the blanket consent clause 41 removes from the settings screen arriving
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

  test("the mandate arrives complete, so one tap is enough (clause 37)", async () => {
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
