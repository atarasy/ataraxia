import { describe, expect, test } from "bun:test";
import {
  call,
  findKey,
  LINEAGE_EDGE,
  LINEAGE_RECIPIENT,
} from "../lib/probe.js";

/**
 * Clauses 19 and 22, and specification §7.1 and §7.5.
 *
 * A lineage edge is recognised on its signature and never on the software
 * that produced it, and a recipient's record holds the fact of receipt and
 * nothing else.
 *
 * These are the two clauses the mark rests on that nothing else here reaches.
 * Clause 22 is what stops the conformance mark from becoming a gate: a fork's
 * gift must land exactly as the reference hub's does, or the mark has attached
 * itself to people after all. Clause 19 is what stops a recipient from
 * acquiring a profile by having been given something.
 */

/** Names a profile would be called if one were being built. */
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
];

describe("lineage: an edge is not discriminated by its client (§7.1)", () => {
  test("the same signed edge is accepted from two different clients", async () => {
    // NOTE (mutation check, 2026-09-08): reject_foreign_client made the
    // reference engine refuse an edge whose user-agent was not its own. The
    // second post failed with 403 and this assertion caught it.
    const first = await call("POST", "/lineage", LINEAGE_EDGE, {
      "user-agent": "atarasy-reference/0.0.0",
    });
    expect(first.status).toBe(201);

    const second = await call("POST", "/lineage", LINEAGE_EDGE, {
      "user-agent": "some-other-hub/9.9.9",
      "x-client": "a fork",
    });
    expect(second.status).toBe(201);
  });

  test("the accepted edge names the merchant (clause 12)", async () => {
    // NOTE (mutation check, 2026-09-08): hide_merchant dropped `merchant` from
    // the edge response. This assertion failed. The merchant is never hidden,
    // and lineage is where hiding it would be most tempting.
    const posted = await call("POST", "/lineage", LINEAGE_EDGE);
    expect(posted.status).toBe(201);
    const edge = posted.body as Record<string, unknown>;
    expect(typeof edge.merchant).toBe("string");
    expect(edge.merchant).not.toBe("");
  });

  test("an edge with a broken signature is refused", async () => {
    // NOTE (mutation check, 2026-09-08): accept_any_signature removed
    // the verification. The tampered edge was stored with 201 and this
    // assertion failed. Clause 22 says an edge is recognised on its
    // signature, which is only a guarantee if the signature is checked.
    const tampered = { ...LINEAGE_EDGE, signature: "not-a-signature" };
    const posted = await call("POST", "/lineage", tampered);
    expect([400, 422]).toContain(posted.status);
  });
});

describe("lineage: the recipient's record (§7.5, clause 19)", () => {
  test("holds the fact of receipt and nothing that resembles a profile", async () => {
    // NOTE (mutation check, 2026-09-08): profile_from_receipt added a
    // `preference` field to each receipt row, derived from the product
    // received. This assertion failed, naming receipts[0].preference.
    const posted = await call("POST", "/lineage", LINEAGE_EDGE);
    expect(posted.status).toBe(201);

    const read = await call(
      "GET",
      `/households/${encodeURIComponent(LINEAGE_RECIPIENT)}/receipts`
    );
    expect(read.status).toBe(200);
    expect(
      findKey(read.body, (k) => PROFILE_KEYS.includes(k.toLowerCase()))
    ).toEqual([]);
  });

  test("a receipt is not a purchase history the presenter can offer from", async () => {
    // NOTE (mutation check, 2026-09-08): history_from_receipt added
    // the product to each receipt row. This assertion failed. A profile is
    // not the only shape a record can take; a list of what someone was given
    // is one too, and §7.5 permits neither.
    const read = await call(
      "GET",
      `/households/${encodeURIComponent(LINEAGE_RECIPIENT)}/receipts`
    );
    expect(read.status).toBe(200);
    // §7.5 permits the fact and the time. A product reference here would make
    // the record a history, which is what clause 19 says a recipient does not
    // acquire by receiving.
    expect(findKey(read.body, (k) => k.toLowerCase() === "product")).toEqual([]);
  });
});
