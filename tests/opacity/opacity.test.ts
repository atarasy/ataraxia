import { describe, expect, test } from "bun:test";
import {
  call,
  createConformingOffer,
  findKey,
  LINEAGE_EDGE,
  LINEAGE_RECIPIENT,
  meansAnyOf,
  sleep,
} from "../lib/probe.js";

/**
 * Clauses 16, 18 and 19, and specification §7.2, §7.4 and §7.5.
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

describe("opacity: the recipient's record (clause 19, §7.4)", () => {
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

describe("opacity: the lineage circle (clause 21, §7.5)", () => {
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
