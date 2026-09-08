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
 * Clauses 19, 21 and 22, and specification §7.2, §7.4 and §7.5.
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
    // gift and the acts that answer it in one response is the join clause 19
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
    // absence clause 19 forbids, dressed as metadata.
    const acts = await call(
      "GET",
      `/lineage/acts?giver=${encodeURIComponent(giver())}`
    );
    const body = acts.body as Record<string, unknown>;
    expect(Object.keys(body)).toEqual(["acts"]);
  });

  test("an unknown giver and a giver with no acts are indistinguishable", async () => {
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

describe("opacity: reciprocation is never prompted (clause 21)", () => {
  test("no route asks a recipient to reciprocate", async () => {
    // NOTE (mutation check, 2026-09-08): nudge_route registered
    // POST /lineage/nudge, returning 202. This assertion failed. Clause 21
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

describe("opacity: the recipient's record (clause 22, §7.4)", () => {
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

describe("opacity: the lineage circle (clause 24, §7.5)", () => {
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
    // assertion failed. Clause 24 shows density within one's own circle, and a
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
