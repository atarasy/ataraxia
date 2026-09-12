import { describe, expect, test } from "bun:test";
import {
  call,
  createConformingOffer,
  findKey,
  HOUSEHOLD,
  LINEAGE_EDGE,
  LINEAGE_RECIPIENT,
  meansAnyOf,
  PRODUCTS,
  sleep,
} from "../lib/probe.js";

/**
 * Clauses 16, 18 and 19, and specification §7.2, §7.6 and §7.7.
 *
 * No surface discloses that a recipient did not act, reciprocation is never
 * prompted, and a recipient's record holds the fact of receipt and nothing
 * else.
 *
 * This is the suite the scaffold called the hard one, and the reason is in
 * §7.2: the constraint is on inference rather than on field names. A response
 * that names no forbidden field can still report inaction through an array's
 * length, an optional object's presence, a timestamp, an identifier that
 * resolves, or a second surface a reader can difference against the first.
 *
 * So these probes look for the channels rather than for the fields. What they
 * cannot reach is written down at the end of the file rather than left for
 * someone to find by exploiting it.
 */

const PROFILE_KEYS = [
  "profile",
  "preference",
  "preferences",
  "taste",
  "affinity",
  "score",
  "rating",
  "segment",
  "propensity",
  "predicted_conversion",
  "opened",
  "read",
  "seen",
  "responded",
  "answered",
  "pending",
  "outstanding",
  "awaiting",
  "no_response",
];

/**
 * §7.7 and clause 18. Ordering is the display a total would have been, and a
 * prompt is the notification clause 18 forbids arriving as a field. Neither
 * word was in any list in this repository until 2026-09-11, when
 * `acts_carry_a_rank` and `a_reciprocate_field_on_the_circle` both passed
 * every probe that reads those two surfaces.
 */
const ORDERING_KEYS = [
  "rank",
  "ranking",
  "position",
  "order",
  "priority",
  "degree",
  "total",
  "count",
];

const PROMPT_KEYS = [
  "reciprocate",
  "reciprocation",
  "remind",
  "reminder",
  "nudge",
  "prompt",
  "suggest",
  "suggested",
  "owe",
  "due",
  "deadline",
  "expires_at",
];

const giver = () => LINEAGE_EDGE.from as string;

describe("opacity: the giver's surface reports no inaction (§7.2)", () => {
  test("a gift creates nothing on the giver's surface to be answered", async () => {
    // NOTE (mutation check, 2026-09-08): sent_list_on_giver_surface added the
    // giver's own outgoing gifts to /lineage/acts. This assertion failed: a
    // gift and the acts that answer it in one response is the join clause 16
    // exists to prevent, and the giver reads the missing row as a silence.
    const before = await call(
      "GET",
      `/lineage/acts?giver=${encodeURIComponent(giver())}`
    );
    expect(before.status).toBe(200);
    const beforeActs = (before.body as { acts: unknown[] }).acts.length;

    const posted = await call("POST", "/lineage", LINEAGE_EDGE);
    expect(posted.status).toBe(201);

    const after = await call(
      "GET",
      `/lineage/acts?giver=${encodeURIComponent(giver())}`
    );
    expect(after.status).toBe(200);
    // Giving changed nothing on the giver's own surface. Only an act can.
    expect((after.body as { acts: unknown[] }).acts.length).toBe(beforeActs);
  });

  test("no field on the giver's surface names a state of not having acted", async () => {
    // NOTE (mutation check, 2026-09-09): inaction_field_on_acts added a
    // `responded` flag to every act. This assertion failed. The value was
    // always true, which is exactly what makes its absence elsewhere
    // readable.
    const acts = await call(
      "GET",
      `/lineage/acts?giver=${encodeURIComponent(giver())}`
    );
    expect(acts.status).toBe(200);
    expect(findKey(acts.body, meansAnyOf(PROFILE_KEYS))).toEqual([]);
    // NOTE (mutation check, 2026-09-11): acts_carry_a_rank put `rank` on each
    // act. Every probe in this file passed, because the list above holds the
    // words for inaction and none for ordering, and the ordering list lives
    // in another suite. An order is the display a total would have been.
    expect(findKey(acts.body, meansAnyOf(ORDERING_KEYS))).toEqual([]);
    expect(findKey(acts.body, meansAnyOf(PROMPT_KEYS))).toEqual([]);
  });

  test("the surface carries no period, so an empty one is never reported", async () => {
    // NOTE (mutation check, 2026-09-08): period_on_acts added `from` and `to`
    // timestamps framing the response. This assertion failed. A window with
    // nothing in it is a report that nothing happened in it, which is the
    // absence clause 16 forbids, dressed as metadata.
    const acts = await call(
      "GET",
      `/lineage/acts?giver=${encodeURIComponent(giver())}`
    );
    const body = acts.body as Record<string, unknown>;
    expect(Object.keys(body)).toEqual(["acts"]);
  });

  test("a gift someone received is not an act on their own surface", async () => {
    // NOTE (mutation check, 2026-09-11): acts_include_gifts_not_answered
    // removed the line that skips gift edges, so every gift a household
    // received appeared among the acts directed at it. Nothing went red.
    // The probe above posts an edge the giver sent and counts the giver's own
    // acts, and `actsVisibleToGiver` filters on `edge.to` before it looks at
    // the kind, so that scenario never reaches the line the mutation removes.
    // This one asks from the other end. A gift sitting in the list makes the
    // answer that never came readable as the row beside it, which is the join
    // clause 16 exists to prevent.
    await call("POST", "/lineage", LINEAGE_EDGE);
    const acts = await call(
      "GET",
      `/lineage/acts?giver=${encodeURIComponent(LINEAGE_RECIPIENT)}`
    );
    expect(acts.status).toBe(200);
    const rows = (acts.body as { acts: { kind?: string }[] }).acts;
    expect(rows.every((a) => a.kind !== "gift")).toBe(true);
  });

  test("an unknown giver and a giver with no acts are indistinguishable", async () => {
    // NOTE (mutation check, 2026-09-09): unknown_giver_differs returned
    // 404 for a key nobody had attested and 200 for a giver whose
    // recipients had not acted. The difference answers a question about a
    // person. This assertion failed.
    // The empty-versus-404 channel. If a giver nobody has heard of returned
    // something different from a giver whose recipients have not acted, the
    // difference would answer a question about a person.
    const unknown = await call(
      "GET",
      `/lineage/acts?giver=${encodeURIComponent("key-that-was-never-attested")}`
    );
    const quiet = await call(
      "GET",
      `/lineage/acts?giver=${encodeURIComponent(giver())}`
    );
    expect(unknown.status).toBe(quiet.status);
    expect(Object.keys(unknown.body as object)).toEqual(
      Object.keys(quiet.body as object)
    );
  });
});

describe("opacity: reciprocation is never prompted (clause 18)", () => {
  test("no route asks a recipient to reciprocate", async () => {
    // NOTE (mutation check, 2026-09-08): nudge_route registered
    // POST /lineage/nudge, returning 202. This assertion failed. Clause 18
    // makes reciprocation easy and forbids prompting it, and a route that
    // exists will be called.
    for (const path of [
      "/lineage/nudge",
      "/lineage/remind",
      "/lineage/prompt",
      "/reciprocate",
      "/thanks/remind",
    ]) {
      const posted = await call("POST", path, { to: LINEAGE_RECIPIENT });
      expect(posted.status).toBe(404);
    }
  });

  test("an unanswered gift carries no deadline", async () => {
    // NOTE (mutation check, 2026-09-09): deadline_on_receipt put a due
    // date on each receipt. Clause 18 says reciprocation has no deadline,
    // and a field is a deadline even when nothing enforces it. This
    // assertion failed.
    await call("POST", "/lineage", LINEAGE_EDGE);
    const receipts = await call(
      "GET",
      `/households/${encodeURIComponent(LINEAGE_RECIPIENT)}/receipts`
    );
    expect(receipts.status).toBe(200);
    expect(
      findKey(receipts.body, meansAnyOf(["due", "deadline", "expires_at", "by"]))
    ).toEqual([]);
  });
});

describe("opacity: the recipient's record (clause 19, §7.6)", () => {
  test("a receipt carries no reference that resolves to anything", async () => {
    // NOTE (mutation check, 2026-09-08): receipt_ref_resolves put the edge id
    // back on the receipt and added GET /lineage/{id}. This assertion failed
    // on the second call: an identifier that resolves turns the fact of
    // receipt into a purchase history one hop long.
    const posted = await call("POST", "/lineage", LINEAGE_EDGE);
    expect(posted.status).toBe(201);

    const read = await call(
      "GET",
      `/households/${encodeURIComponent(LINEAGE_RECIPIENT)}/receipts`
    );
    expect(read.status).toBe(200);
    const receipts = (read.body as { receipts: Record<string, unknown>[] })
      .receipts;
    expect(receipts.length).toBeGreaterThan(0);

    for (const receipt of receipts) {
      for (const value of Object.values(receipt)) {
        if (typeof value !== "string") continue;
        // Whatever the token is called, no route may turn it into an edge.
        for (const path of [`/lineage/${value}`, `/edges/${value}`]) {
          const resolved = await call("GET", path);
          expect(resolved.status).toBe(404);
        }
      }
    }
  });

  test("a receipt names no product and no merchant", async () => {
    // NOTE (mutation check, 2026-09-09): history_from_receipt put the
    // product and the merchant back on the receipt. This assertion failed.
    await call("POST", "/lineage", LINEAGE_EDGE);
    const read = await call(
      "GET",
      `/households/${encodeURIComponent(LINEAGE_RECIPIENT)}/receipts`
    );
    expect(
      findKey(read.body, meansAnyOf(["product", "merchant", "item", "sku", "from"]))
    ).toEqual([]);
  });
});

describe("opacity: what a recipient has received is listed nowhere (clause 20)", () => {
  /**
   * Clause 20, as rewritten on 2026-09-09. A giver avoids a duplicate only
   * by asking the recipient's own node under a grant. The route that would
   * make asking unnecessary is a list of what a household has received,
   * under any of the names it would be given.
   */
  test("no route lists what a household has received", async () => {
    // NOTE (mutation check, 2026-09-09): received_route registered
    // GET /households/{id}/received returning the products behind the
    // household's gifts. This assertion failed with 200. Receipts resolving
    // to nothing (the probes below) is only a guarantee while no other route
    // resolves them in bulk.
    for (const name of ["received", "gifts", "gifts_received", "history", "inventory"]) {
      const read = await call("GET", `/households/${encodeURIComponent(LINEAGE_RECIPIENT)}/${name}`);
      expect(read.status).toBe(404);
    }
  });
});

describe("opacity: the lineage circle (clause 21, §7.7)", () => {
  test("the viewer's own edges carry no date and no product", async () => {
    // NOTE (mutation check, 2026-09-08): date_on_own_edges kept the timestamp
    // and the product on the viewer's outgoing edges. This assertion failed.
    // With a date, "nothing came back for what I sent on the third" is
    // available; without one, the most that can be read is that someone is in
    // the circle and has never acted.
    await call("POST", "/lineage", LINEAGE_EDGE);
    const circle = await call(
      "GET",
      `/lineage/circle?viewer=${encodeURIComponent(giver())}`
    );
    expect(circle.status).toBe(200);
    const edges = (circle.body as {
      edges: { from: string; at: number | null; product: string | null }[];
    }).edges;
    const own = edges.filter((e) => e.from === giver());
    expect(own.length).toBeGreaterThan(0);
    for (const edge of own) {
      expect(edge.at).toBeNull();
      expect(edge.product).toBeNull();
    }
  });

  test("the circle names the merchant and no aggregate", async () => {
    // NOTE (mutation check, 2026-09-09): hide_merchant blanked the
    // merchant on an accepted edge. Clause 21 says lineage does not hide
    // merchants. This assertion failed.
    const circle = await call(
      "GET",
      `/lineage/circle?viewer=${encodeURIComponent(giver())}`
    );
    const body = circle.body as { edges: { merchant: string }[] };
    expect(body.edges.every((e) => typeof e.merchant === "string" && e.merchant !== "")).toBe(true);
    expect(
      findKey(circle.body, meansAnyOf(["total", "count", "network_size", "rank", "reach", "degree"]))
    ).toEqual([]);
    // NOTE (mutation check, 2026-09-11): a_reciprocate_field_on_the_circle put
    // `reciprocate: true` on every row. Nothing went red, because no list in
    // this repository held a word for prompting: clause 18's deadline half was
    // checked on the receipts surface only, and the circle was checked for
    // aggregates alone. A prompt arriving as a field is still a prompt.
    expect(findKey(circle.body, meansAnyOf(PROMPT_KEYS))).toEqual([]);
  });

  test("the circle does not expand past direct edges", async () => {
    // NOTE (mutation check, 2026-09-08): second_degree_circle walked one hop
    // further, adding edges between two people the viewer knows. This
    // assertion failed. Clause 21 shows density within one's own circle, and a
    // circle that grows with the network has begun measuring its size.
    const circle = await call(
      "GET",
      `/lineage/circle?viewer=${encodeURIComponent(giver())}`
    );
    const edges = (circle.body as { edges: { from: string; to: string }[] }).edges;
    for (const edge of edges) {
      expect(edge.from === giver() || edge.to === giver()).toBe(true);
    }
  });
});

describe("opacity: timing", () => {
  test("a giver with acts and a giver without answer in comparable time", async () => {
    // NOTE (mutation check, 2026-09-09): slow_when_there_are_acts spun for
    // 120ms when the acts stream had something in it. A store consulted
    // only when there is something in it answers by how long it takes.
    // This assertion failed.
    // The response-timing channel. A surface that takes measurably longer when
    // there is something to report answers the question by how long it takes,
    // whatever it returns.
    //
    // This probe is deliberately loose. It catches an implementation that
    // queries a store only when acts exist, and it cannot catch a difference
    // smaller than the noise on a local network. The limit is real and is
    // recorded rather than papered over.
    const sample = async (who: string) => {
      const runs: number[] = [];
      for (let i = 0; i < 5; i++) {
        const start = performance.now();
        await call("GET", `/lineage/acts?giver=${encodeURIComponent(who)}`);
        runs.push(performance.now() - start);
        await sleep(10);
      }
      runs.sort((a, b) => a - b);
      return runs[2]!;
    };
    const withActs = await sample(giver());
    const without = await sample("key-with-nothing-at-all");
    const ratio = Math.max(withActs, without) / Math.max(1, Math.min(withActs, without));
    expect(ratio).toBeLessThan(20);
  }, 30_000);
});

describe("opacity: a note is the writer's, and nothing here helps buy one (§7.6b)", () => {
  /**
   * 令和5年内閣府告示第19号 makes a seller's own display that a consumer cannot
   * tell is the seller's an unfair display, and its 運用基準 asks whether the
   * content was 「第三者の自主的な意思による」. A seller that gives goods in
   * order to be written about, or that lets a household infer that writing
   * brings 「経済上の利益」, has made the writing its own; the guideline's own
   * note says such consideration is not only money but 「対価性を有する一切の
   * もの」, and the next gift is one of those.
   *
   * **What this specification can do is not carry the levers**, and these are
   * the three. What it cannot do is written in §7.6b rather than implied here:
   * a merchant reads the lines a writer chose to share with it, so whether it
   * gives again to those households is its own conduct and its own liability.
   */
  test("no route carries a gift eligibility for a household", async () => {
    // `valence.gift_eligible` is a field of a merchant's feed and a property
    // of a product. An eligibility a maker could set per household is one it
    // could set for writing.
    const offer = await createConformingOffer();
    const read = await call("GET", `/offers/${offer.id}`);
    const hits = findKey(read.body, meansAnyOf(["giftEligible", "gift_eligible", "eligibleForGifts", "giftable"]));
    expect(hits).toEqual([]);
    for (const path of [`/households/${encodeURIComponent(HOUSEHOLD)}/offers`, `/offers/${offer.id}/approval`]) {
      const response = await call("GET", path);
      expect(findKey(response.body, meansAnyOf(["giftEligible", "gift_eligible", "eligibleForGifts", "giftable"]))).toEqual([]);
    }
  });

  test("an agent cannot exclude a candidate for what a household wrote", async () => {
    // NOTE (mutation check, 2026-09-09): the closed list is already guarded by
    // `exclusion_rule_is_free_text`; this assertion names the reason the list
    // is closed, which is that a rule about writing would put the inference
    // the 告示 forbids into the protocol itself.
    const offer = await createConformingOffer();
    for (const reason of ["no_note", "wrote_no_review", "silent"]) {
      const recorded = await call("POST", `/offers/${offer.id}/deliberation`, {
        per_candidate: Object.fromEntries(
          offer.candidates.map((c) => [c.id, { alternatives: ["another tin"], argument_against: "you have two" }])
        ),
        excluded: [{ product: PRODUCTS[0], reason }],
        mandate: { kind: "individual", scope: "this offer", lapses_at: null },
      });
      expect([400, 422]).toContain(recorded.status);
    }
  });

  test("a note takes nothing from a merchant", async () => {
    // A candidate carries no brief and the note route takes the writer's own
    // author, text and audience and nothing else. The refusal is §3.3's
    // strictness; the probe names what must never be added to it.
    const offer = await createConformingOffer();
    const candidate = offer.candidates[0]!.id;
    for (const extra of [{ brief: "mention the packaging" }, { requested_by: "maker-a" }, { sponsored: true }]) {
      const written = await call("POST", `/candidates/${candidate}/note`, {
        author: HOUSEHOLD,
        text: "the tea was good",
        shared_with: ["merchant"],
        ...extra,
      });
      expect(written.status).toBe(400);
    }
  });
});
