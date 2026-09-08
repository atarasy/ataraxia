import { beforeEach, describe, expect, test } from "bun:test";
import {
  call,
  callSecond,
  createConformingOffer,
  freshHousehold,
  LINEAGE_EDGE,
  presenter,
} from "../lib/probe.js";

/**
 * Clauses 47, 61 and 62.
 *
 * A household exports what it holds, moves its node to another host intact,
 * and recovery is a power separate from reading.
 *
 * The suite runs against two hosts of the same implementation. With one, the
 * strongest question available is whether a file was produced, and clause 47
 * asks for something else: that the data be held in a form the customer can
 * export **in full**. Fullness is not a field list, because a surface added
 * later can be missing from the export while the export still matches its own
 * schema. So the question here is whether the second host answers as the first
 * did.
 */

// Each test moves a household of its own. Since exploration became what a
// household has never been offered (clause 30), a second offer to the same
// household marking every product as exploration is refused, so the fixed
// household cannot be seeded twice.
let current = freshHousehold();
beforeEach(() => {
  current = freshHousehold();
});
const household = () => current;

async function seedSomethingToMove() {
  const offer = await createConformingOffer({ household: household() });
  await call("POST", `/offers/${offer.id}/present`, {});
  await call("POST", `/candidates/${offer.candidates[0]!.id}/note`, {
    author: household(),
    text: "kept for the smell",
    shared_with: [],
  });
  await call("POST", `/offers/${offer.id}/decisions`, {
    decisions: offer.candidates.map((c, i) => ({
      candidate: c.id,
      valence: i === 0 ? "kept" : "returned",
      ...(i === 0 ? { kept_as: "self" } : {}),
    })),
  });
  await call("POST", `/offers/${offer.id}/settle`, {});
  return offer;
}

describe("exit: the export (clause 47)", () => {
  test("the export names its format and its version", async () => {
    // NOTE (mutation check, 2026-09-09): export_no_format blanked the
    // format string. Clause 59 permits forks, and a fork has to know what
    // it is holding. This assertion failed.
    // A format only the implementation that wrote it can read is not a format.
    // Clause 59 permits forks, and a fork has to know what it is holding.
    const exported = await call(
      "GET",
      `/households/${encodeURIComponent(household())}/export`
    );
    expect(exported.status).toBe(200);
    const node = exported.body as { format: string };
    expect(typeof node.format).toBe("string");
    expect(node.format).toMatch(/\/\d+$/);
  });

  test("the export carries what the surfaces withhold", async () => {
    // NOTE (mutation check, 2026-09-09): export_only_what_surfaces_show built
    // the export from the giver's surface instead of from the record. This
    // assertion failed on the lineage. The giver's screen deliberately holds
    // no list of gifts sent, and a member who moves hosts must not lose their
    // own record of what they gave because of it.
    await call("POST", "/lineage", LINEAGE_EDGE);
    const exported = await call(
      "GET",
      `/households/${encodeURIComponent(LINEAGE_EDGE.from as string)}/export`
    );
    expect(exported.status).toBe(200);
    const node = exported.body as { lineage: { from: string }[] };
    const outgoing = node.lineage.filter(
      (e) => e.from === (LINEAGE_EDGE.from as string)
    );
    expect(outgoing.length).toBeGreaterThan(0);
  });

  test("the export carries offers, settlements, notes and receipts", async () => {
    // NOTE (mutation check, 2026-09-09): export_drops_settlements left the
    // settlements out. The file was still produced and still matched its
    // own schema. This assertion failed.
    await seedSomethingToMove();
    const exported = await call(
      "GET",
      `/households/${encodeURIComponent(household())}/export`
    );
    const node = exported.body as {
      offers: unknown[];
      settlements: unknown[];
      notes: unknown[];
      receipts: unknown[];
    };
    expect(node.offers.length).toBeGreaterThan(0);
    expect(node.settlements.length).toBeGreaterThan(0);
    expect(node.notes.length).toBeGreaterThan(0);
    expect(Array.isArray(node.receipts)).toBe(true);
  });
});

describe("exit: the move (clause 61)", () => {
  test("the second host answers as the first did", async () => {
    // NOTE (mutation check, 2026-09-09): export_drops_settlements left the
    // settlements out of the export. The schema was still valid and the file
    // was still produced; this assertion failed because the second host
    // answered a question differently. That is the whole reason the probe
    // compares answers rather than field names.
    // Read the presenter before anything is exported: the helper creates an
    // offer to read it from, and an offer created after the export is a
    // difference between the hosts that the move did not make.
    const who = await presenter();
    const offer = await seedSomethingToMove();

    const exported = await call(
      "GET",
      `/households/${encodeURIComponent(household())}/export`
    );
    expect(exported.status).toBe(200);

    const imported = await callSecond(
      "POST",
      `/households/${encodeURIComponent(household())}/import`,
      exported.body
    );
    expect(imported.status).toBe(201);

    // The same questions, asked of both hosts. The settlement is on the list
    // because leaving it off is what let a mutation drop settlements from the
    // export while both hosts still answered alike: nothing asked.
    for (const path of [
      `/offers/${offer.id}`,
      `/offers/${offer.id}/settlement`,
      `/offers?household=${encodeURIComponent(household())}&presenter=${encodeURIComponent(who)}`,
      `/households/${encodeURIComponent(household())}/receipts`,
    ]) {
      const first = await call("GET", path);
      const second = await callSecond("GET", path);
      expect(second.status).toBe(first.status);
      expect(second.body).toEqual(first.body);
    }
  });

  test("a lineage edge still resolves after the move", async () => {
    // NOTE (mutation check, 2026-09-09): export_only_what_surfaces_show
    // built the export from the giver's surface, which holds no outgoing
    // edges. The circle was empty on the second host. This assertion
    // failed.
    // Edges name keys, not hosts. An edge that stopped resolving because its
    // subject moved would make the network a function of who is hosting whom.
    await call("POST", "/lineage", LINEAGE_EDGE);
    const giver = LINEAGE_EDGE.from as string;

    const exported = await call(
      "GET",
      `/households/${encodeURIComponent(giver)}/export`
    );
    await callSecond(
      "POST",
      `/households/${encodeURIComponent(giver)}/import`,
      exported.body
    );

    const before = await call(
      "GET",
      `/lineage/circle?viewer=${encodeURIComponent(giver)}`
    );
    const after = await callSecond(
      "GET",
      `/lineage/circle?viewer=${encodeURIComponent(giver)}`
    );
    expect(after.status).toBe(200);
    // Every edge the first host served is served by the second. Not the same
    // count: other probes in this suite post edges of their own, and a count
    // comparison made this probe fail for a reason that has nothing to do with
    // the move. What clause 61 asks is that nothing stops resolving.
    const key = (e: { from: string; to: string; merchant: string }) =>
      `${e.from}|${e.to}|${e.merchant}`;
    const beforeEdges = (before.body as {
      edges: { from: string; to: string; merchant: string }[];
    }).edges;
    const afterEdges = new Set(
      (after.body as {
        edges: { from: string; to: string; merchant: string }[];
      }).edges.map(key)
    );
    expect(beforeEdges.length).toBeGreaterThan(0);
    for (const edge of beforeEdges) {
      expect(afterEdges.has(key(edge))).toBe(true);
    }
  });

  test("an export in an unknown format is refused rather than half read", async () => {
    // NOTE (mutation check, 2026-09-09): import_accepts_anything accepted
    // any document. An import that reads what it does not understand loses
    // the half it could not parse, silently. This assertion failed.
    const refused = await callSecond(
      "POST",
      `/households/${encodeURIComponent(household())}/import`,
      { format: "something-else/9", offers: [] }
    );
    expect([400, 422]).toContain(refused.status);
  });
});

describe("exit: recovery is not reading (clause 62)", () => {
  const HOUSE = "household-recovery-probe";

  test("a recoverer cannot be named without a channel it does not control", async () => {
    // NOTE (mutation check, 2026-09-09): recoverer_owns_every_channel dropped
    // the requirement. This assertion failed with 201. A recoverer holding the
    // only channel can recover in silence, and clause 62's notice becomes
    // decorative.
    const refused = await call("POST", "/_node/channels", {
      household: HOUSE,
      channels: [{ channel: "recoverer-sms", controlled_by_recoverer: true }],
    });
    expect([400, 422]).toContain(refused.status);

    const accepted = await call("POST", "/_node/channels", {
      household: HOUSE,
      channels: [
        { channel: "recoverer-sms", controlled_by_recoverer: true },
        { channel: "own-email", controlled_by_recoverer: false },
      ],
    });
    expect(accepted.status).toBe(201);
  });

  test("recovery is logged, and the log names who did it", async () => {
    // NOTE (mutation check, 2026-09-09): recovery_not_logged stopped
    // writing the log. Clause 62 asks for a record the person can read
    // afterwards. This assertion failed.
    await call("POST", "/_node/channels", {
      household: HOUSE,
      channels: [{ channel: "own-email", controlled_by_recoverer: false }],
    });
    await call("POST", "/_node/recoverers", {
      household: HOUSE,
      keys: ["key-recoverer-1"],
    });

    const recovered = await call(`POST`, `/households/${HOUSE}/recoveries`, {
      by: "key-recoverer-1",
    });
    expect(recovered.status).toBe(201);

    const log = await call("GET", `/households/${HOUSE}/recoveries`);
    expect(log.status).toBe(200);
    const rows = (log.body as { recoveries: { initiated_by: string }[] })
      .recoveries;
    expect(rows.some((r) => r.initiated_by === "key-recoverer-1")).toBe(true);
  });

  test("someone who is not a recoverer cannot recover", async () => {
    // NOTE (mutation check, 2026-09-09): anyone_can_recover removed the check
    // that the caller is a named recoverer. This assertion failed with 201.
    const refused = await call(`POST`, `/households/${HOUSE}/recoveries`, {
      by: "key-a-stranger",
    });
    expect(refused.status).toBe(409);
  });

  test("recovering does not make the recoverer able to read", async () => {
    // NOTE (no mutation, 2026-09-09): this probe has never been shown to fail.
    // The reference engine authenticates nothing, so a recoverer's view and a
    // stranger's are identical for a reason that has nothing to do with
    // clause 62, and no mutation of it can separate them. The probe bites only
    // against an implementation that authenticates reads. It is counted as
    // unproven and left in place, because the clause is worth asserting and
    // the alternative is asserting nothing.
    // The separation clause 62 asks for. Being named a recoverer, and using
    // it, must not put anyone on the reading side of the household's data.
    await call("POST", "/_node/recoverers", {
      household: HOUSE,
      keys: ["key-recoverer-1"],
    });
    await call(`POST`, `/households/${HOUSE}/recoveries`, { by: "key-recoverer-1" });

    // The recoverer's own view of the household is what any stranger's is.
    const asRecoverer = await call(
      "GET",
      `/households/${encodeURIComponent(HOUSE)}/receipts`,
      undefined,
      { "x-key": "key-recoverer-1" }
    );
    const asStranger = await call(
      "GET",
      `/households/${encodeURIComponent(HOUSE)}/receipts`,
      undefined,
      { "x-key": "key-a-stranger" }
    );
    expect(asRecoverer.status).toBe(asStranger.status);
    expect(asRecoverer.body).toEqual(asStranger.body);
  });

  test("the recovery log leaves with the node", async () => {
    // NOTE (mutation check, 2026-09-09): recovery_not_logged as above. A
    // log that does not survive a move cannot be read by someone who left
    // because of what it records. This assertion failed.
    const exported = await call(
      "GET",
      `/households/${encodeURIComponent(HOUSE)}/export`
    );
    const node = exported.body as { recoveries: unknown[] };
    expect(node.recoveries.length).toBeGreaterThan(0);
  });
});
