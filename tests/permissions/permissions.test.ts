import { describe, expect, test } from "bun:test";
import { generateKeyPairSync } from "node:crypto";
import {
  call,
  conformingOffer,
  coSignDecisions,
  createConformingOffer,
  decide,
  findKey,
  HOUSEHOLD,
  MANDATE_STATE,
  meansAnyOf,
  PRODUCTS,
  assertDecisions,
  assertMandate,
  CO_SIGNER_KEY,
  signDecisions,
  signMandate,
  sleep,
  soon,
} from "../lib/probe.js";

/**
 * Clauses 37 to 42.
 *
 * Permission is asked at the moment of use, scoped and time-limited. Blanket
 * consent in a settings screen does not exist. The list is always visible and
 * each entry is revoked on its own.
 *
 * The ledger is a list of exceptions to "nobody but me", and the household's
 * own agent is not in it: clause 38 makes the person the default recipient,
 * which is not a permission. If it were, it could be revoked, and the hub
 * would stop working.
 */

const soon = (ms: number) => Date.now() + ms;

async function liveAction(household = HOUSEHOLD) {
  const opened = await call("POST", `/households/${encodeURIComponent(household)}/actions`, {
    describes: "drafting next week's order",
    expires_at: soon(60_000),
  });
  expect(opened.status).toBe(201);
  return (opened.body as { id: string }).id;
}

const grant = (household: string, body: Record<string, unknown>) =>
  call("POST", `/households/${encodeURIComponent(household)}/permissions`, body);

describe("permissions: asked at the moment of use (clause 37)", () => {
  test("a grant that names no live action is refused", async () => {
    // NOTE (mutation check, 2026-09-09): grant_without_an_action removed the
    // requirement. This assertion failed with 201, which is blanket consent in
    // a settings screen wearing the shape of a permission.
    const refused = await grant(HOUSEHOLD, {
      grantee: "merchant-1",
      scope: ["purchase_history"],
      purpose: "to draft next week's order",
      expires_at: soon(86_400_000),
      asked_from: "an-action-that-does-not-exist",
    });
    expect([400, 422]).toContain(refused.status);
  });

  test("a grant against a live action is accepted", async () => {
    // NOTE (mutation check, 2026-09-09): refuse_every_grant made every
    // grant fail. This assertion failed, and it exists so that the refusal
    // probes beside it cannot pass by refusing everything.
    const action = await liveAction();
    const granted = await grant(HOUSEHOLD, {
      grantee: "merchant-1",
      scope: ["purchase_history"],
      purpose: "to draft next week's order",
      expires_at: soon(86_400_000),
      asked_from: action,
    });
    expect(granted.status).toBe(201);
  });

  test("a permission with no expiry cannot be expressed", async () => {
    // NOTE (mutation check, 2026-09-09): permission_never_expires accepted an
    // expires_at in the past and treated it as unlimited. This assertion
    // failed. Clause 37 requires time limits, and a null that means "never" is
    // how they come back.
    const action = await liveAction();
    for (const expires of [0, Date.now() - 1000]) {
      const refused = await grant(HOUSEHOLD, {
        grantee: "merchant-1",
        scope: ["purchase_history"],
        purpose: "forever",
        expires_at: expires,
        asked_from: action,
      });
      expect([400, 422]).toContain(refused.status);
    }
  });

  test("a scope naming nothing is refused", async () => {
    // NOTE (mutation check, 2026-09-09): empty_scope_ok accepted an empty
    // scope. This assertion failed. A permission that names no field is
    // not scoped, which is half of clause 37.
    const action = await liveAction();
    const refused = await grant(HOUSEHOLD, {
      grantee: "merchant-1",
      scope: [],
      purpose: "everything",
      expires_at: soon(86_400_000),
      asked_from: action,
    });
    expect([400, 422]).toContain(refused.status);
  });
});

describe("permissions: the person is not a grantee (clause 38)", () => {
  test("the household's own agent cannot be granted a permission", async () => {
    // NOTE (mutation check, 2026-09-09): own_agent_is_a_grantee allowed it.
    // This assertion failed with 201. An entry for the person themselves is
    // revocable, and revoking it would switch off the hub on its owner.
    const action = await liveAction();
    const refused = await grant(HOUSEHOLD, {
      grantee: HOUSEHOLD,
      scope: ["purchase_history"],
      purpose: "to act for me",
      expires_at: soon(86_400_000),
      asked_from: action,
    });
    expect([400, 422]).toContain(refused.status);
  });
});

describe("permissions: always visible, revoked one at a time (clause 40)", () => {
  test("revoking appends rather than removing", async () => {
    // NOTE (mutation check, 2026-09-09): revoke_deletes_the_row dropped the
    // permission from the list instead of stamping it. This assertion failed
    // on the length. A list that forgets what was revoked is not "always
    // visible" about the past, and a person cannot audit what they once gave.
    const action = await liveAction();
    const granted = await grant(HOUSEHOLD, {
      grantee: "merchant-to-revoke",
      scope: ["purchase_history"],
      purpose: "to draft next week's order",
      expires_at: soon(86_400_000),
      asked_from: action,
    });
    const id = (granted.body as { id: string }).id;

    const before = await call("GET", `/households/${encodeURIComponent(HOUSEHOLD)}/permissions`);
    const beforeRows = (before.body as { permissions: unknown[] }).permissions.length;

    const revoked = await call(
      "POST",
      `/households/${encodeURIComponent(HOUSEHOLD)}/permissions/${id}/revoke`,
      {}
    );
    expect(revoked.status).toBe(200);

    const after = await call("GET", `/households/${encodeURIComponent(HOUSEHOLD)}/permissions`);
    const rows = (after.body as { permissions: { id: string; revoked_at: number | null }[] })
      .permissions;
    expect(rows.length).toBe(beforeRows);
    const row = rows.find((r) => r.id === id);
    expect(row).toBeDefined();
    expect(typeof row!.revoked_at).toBe("number");
  });

  test("revoking one leaves the others standing", async () => {
    // NOTE (mutation check, 2026-09-09): revoke_revokes_everything stamped
    // the whole list. This assertion failed. Clause 40 says each is
    // revoked individually.
    const action = await liveAction();
    const a = await grant(HOUSEHOLD, {
      grantee: "merchant-a",
      scope: ["purchase_history"],
      purpose: "a",
      expires_at: soon(86_400_000),
      asked_from: action,
    });
    const b = await grant(HOUSEHOLD, {
      grantee: "merchant-b",
      scope: ["lineage"],
      purpose: "b",
      expires_at: soon(86_400_000),
      asked_from: action,
    });
    await call(
      "POST",
      `/households/${encodeURIComponent(HOUSEHOLD)}/permissions/${(a.body as { id: string }).id}/revoke`,
      {}
    );
    const after = await call("GET", `/households/${encodeURIComponent(HOUSEHOLD)}/permissions`);
    const rows = (after.body as { permissions: { id: string; revoked_at: number | null }[] })
      .permissions;
    const other = rows.find((r) => r.id === (b.body as { id: string }).id);
    expect(other!.revoked_at).toBeNull();
  });

  test("revoking twice is refused rather than silently repeated", async () => {
    // NOTE (mutation check, 2026-09-09): revoke_deletes_the_row removed
    // the row, so the second call found nothing and answered 404 instead
    // of 409. This assertion failed on the status.
    const action = await liveAction();
    const granted = await grant(HOUSEHOLD, {
      grantee: "merchant-twice",
      scope: ["purchase_history"],
      purpose: "c",
      expires_at: soon(86_400_000),
      asked_from: action,
    });
    const id = (granted.body as { id: string }).id;
    const path = `/households/${encodeURIComponent(HOUSEHOLD)}/permissions/${id}/revoke`;
    expect((await call("POST", path, {})).status).toBe(200);
    expect((await call("POST", path, {})).status).toBe(409);
  });
});

describe("permissions: what the ledger does not carry (clause 39, 41)", () => {
  test("no field prices a permission", async () => {
    // NOTE (mutation check, 2026-09-09): compensation_on_permission added a
    // `compensation` to each row. This assertion failed. Clause 39 says no
    // capability to sell data is built, and a price on a permission is that
    // capability in one column.
    const read = await call("GET", `/households/${encodeURIComponent(HOUSEHOLD)}/permissions`);
    expect(read.status).toBe(200);
    const PRICES_A_GRANT = meansAnyOf([
      "compensation",
      "price",
      "fee",
      "payment",
      "reward",
      "amount",
    ]);
    expect(findKey(read.body, PRICES_A_GRANT)).toEqual([]);
    // Widened 2026-09-11: the ledger was walked and the answer the person is
    // shown when they grant was not. the_grant_response_prices_it put the
    // figure on that response, where a market in permissions would appear
    // first, and this probe stored nothing to see it in.
    const action = await liveAction();
    const granted = await grant(HOUSEHOLD, {
      grantee: "merchant-priced",
      scope: ["purchase_history"],
      purpose: "to see what a grant answers with",
      expires_at: soon(60_000),
      asked_from: action,
    });
    expect(granted.status).toBe(201);
    expect(findKey(granted.body, PRICES_A_GRANT)).toEqual([]);
  });

  test("no field names a model", async () => {
    // NOTE (mutation check, 2026-09-09): model_on_permission recorded which
    // model the grant was made against. This assertion failed. Clause 41 says
    // changing the model behind an agent moves neither the ledger nor the
    // records, and a model named on a row is a ledger that follows the model.
    const read = await call("GET", `/households/${encodeURIComponent(HOUSEHOLD)}/permissions`);
    expect(findKey(read.body, meansAnyOf(["model", "llm", "provider", "engine"]))).toEqual([]);
  });

  test("a grantee cannot list the household's permissions", async () => {
    // NOTE (mutation check, 2026-09-09): global_permissions_route
    // registered GET /permissions. This assertion failed. A grantee that
    // can read the ledger learns what else the household has granted, and
    // to whom.
    // The ledger is the household's view. A grantee that could read it would
    // learn what else the household has granted, and to whom.
    // Widened 2026-09-11: the clause is about the capability and not about the
    // spelling. a_grantee_can_list_what_it_holds registered the same listing
    // under the grantee rather than under the household, and this probe, which
    // asked for one path, saw nothing.
    for (const path of [
      "/permissions",
      "/grantees/merchant-1/permissions",
      "/permissions/merchant-1",
      "/grantees/merchant-1/grants",
    ]) {
      const read = await call("GET", path);
      expect(read.status).toBe(404);
    }
  });
});

describe("permissions: the ledger is consulted (clause 20, §7.4)", () => {
  /**
   * The probes above prove properties of the ledger. Until 2026-09-09 no read
   * path consulted it, so all of them proved properties of a list nothing
   * read. Duplicate avoidance is that path: one bit, under a grant, against a
   * live action, written into the recipient's own record.
   */
  test("a duplicate check without a grant is refused, and with one answers a bit", async () => {
    // NOTE (mutation check, 2026-09-09): duplicate_check_without_grant
    // answered without consulting the ledger. The first assertion failed
    // with 200: the recipient alone decides whether the query runs.
    const recipient = `${HOUSEHOLD}-recipient-${Math.random().toString(36).slice(2, 8)}`;
    const giver = `${HOUSEHOLD}-giver`;
    const action = await liveAction(recipient);

    const refused = await call("POST", `/households/${encodeURIComponent(recipient)}/duplicate-check`, {
      product: PRODUCTS[0],
      asked_by: giver,
      asked_from: action,
    });
    expect(refused.status).toBe(422);

    const granted = await grant(recipient, {
      grantee: giver,
      scope: ["duplicate_check"],
      purpose: "so a gift is not a duplicate",
      expires_at: soon(60_000),
      asked_from: action,
    });
    expect(granted.status).toBe(201);

    const answered = await call("POST", `/households/${encodeURIComponent(recipient)}/duplicate-check`, {
      product: PRODUCTS[0],
      asked_by: giver,
      asked_from: action,
    });
    expect(answered.status).toBe(200);
    expect(typeof (answered.body as { already_received: boolean }).already_received).toBe("boolean");
    // One bit and nothing else: no date, no merchant, no reference.
    expect(Object.keys(answered.body as object)).toEqual(["already_received"]);
  });

  test("who asked what is in the recipient's own record", async () => {
    // NOTE (mutation check, 2026-09-09): duplicate_check_unlogged answered
    // without writing the row. This assertion failed: one bit at a time is
    // still a read of the list, and the reads are the recipient's to see.
    const recipient = `${HOUSEHOLD}-recipient-${Math.random().toString(36).slice(2, 8)}`;
    const giver = `${HOUSEHOLD}-giver`;
    const action = await liveAction(recipient);
    await grant(recipient, {
      grantee: giver,
      scope: ["duplicate_check"],
      purpose: "so a gift is not a duplicate",
      expires_at: soon(60_000),
      asked_from: action,
    });
    await call("POST", `/households/${encodeURIComponent(recipient)}/duplicate-check`, {
      product: PRODUCTS[0],
      asked_by: giver,
      asked_from: action,
    });
    const record = await call("GET", `/households/${encodeURIComponent(recipient)}/queries`);
    expect(record.status).toBe(200);
    const rows = (record.body as { queries: { asked_by: string; product: string }[] }).queries;
    expect(rows.length).toBe(1);
    expect(rows[0]!.asked_by).toBe(giver);
    expect(rows[0]!.product).toBe(PRODUCTS[0]);
  });

  test("no route enumerates what a household has received (clause 20)", async () => {
    // The bit is the whole of what duplicate avoidance gives. A grant for it
    // does not open a list.
    const recipient = `${HOUSEHOLD}-recipient-${Math.random().toString(36).slice(2, 8)}`;
    const giver = `${HOUSEHOLD}-giver`;
    const action = await liveAction(recipient);
    await grant(recipient, {
      grantee: giver,
      scope: ["duplicate_check"],
      purpose: "so a gift is not a duplicate",
      expires_at: soon(60_000),
      asked_from: action,
    });
    for (const name of ["received", "gifts", "history", "inventory"]) {
      const read = await call("GET", `/households/${encodeURIComponent(recipient)}/${name}`);
      expect(read.status).toBe(404);
    }
  });
});

describe("mandates: a loosening needs its co-signers (clauses 46, 47, §16)", () => {
  /**
   * Until 2026-09-09 a mandate was a reference an offer carried, so clauses
   * 46 and 47 were promises: nothing held a ceiling and nothing could tell a
   * loosening from a tightening. What makes them checkable is writing down
   * which changes need whose signature.
   */
  const next = (over: Partial<typeof MANDATE_STATE>) => ({
    id: MANDATE_STATE.id,
    household: MANDATE_STATE.household,
    ceiling_out_of_network: MANDATE_STATE.ceiling_out_of_network,
    co_signers: MANDATE_STATE.co_signers,
    lapses_at: MANDATE_STATE.lapses_at,
    version: MANDATE_STATE.version + 1,
    ...over,
  });

  test("raising the ceiling without the co-signer is refused", async () => {
    // NOTE (mutation check, 2026-09-09): loosening_without_cosigner required
    // only the person. This assertion failed with 201: a protection set
    // while someone had capacity was loosened by one party alone.
    const raised = next({ ceiling_out_of_network: MANDATE_STATE.ceiling_out_of_network + 50000 });
    const refused = await call("POST", "/_node/mandates", {
      ...raised,
      signatures: signMandate(raised, false),
    });
    expect(refused.status).toBe(422);

    const accepted = await call("POST", "/_node/mandates", {
      ...raised,
      signatures: signMandate(raised, true),
    });
    expect(accepted.status).toBe(201);
    expect((accepted.body as { ceiling_out_of_network: number }).ceiling_out_of_network).toBe(
      raised.ceiling_out_of_network
    );
  });

  test("lowering the ceiling is the person's alone", async () => {
    // Clause 46: they may lower it. A tightening does not wait on anybody.
    const read = await call("GET", `/_node/mandates/${encodeURIComponent(MANDATE_STATE.id)}`);
    expect(read.status).toBe(200);
    const current = read.body as typeof MANDATE_STATE;
    const lowered = {
      id: current.id,
      household: current.household,
      ceiling_out_of_network: Math.max(0, current.ceiling_out_of_network - 1000),
      co_signers: current.co_signers,
      lapses_at: current.lapses_at,
      version: current.version + 1,
    };
    const accepted = await call("POST", "/_node/mandates", {
      ...lowered,
      signatures: signMandate(lowered, false),
    });
    expect(accepted.status).toBe(201);
  });

  test("dropping a co-signer is a loosening", async () => {
    const read = await call("GET", `/_node/mandates/${encodeURIComponent(MANDATE_STATE.id)}`);
    const current = read.body as typeof MANDATE_STATE;
    const dropped = {
      id: current.id,
      household: current.household,
      ceiling_out_of_network: current.ceiling_out_of_network,
      co_signers: [],
      lapses_at: current.lapses_at,
      version: current.version + 1,
    };
    const refused = await call("POST", "/_node/mandates", {
      ...dropped,
      signatures: { [dropped.household]: signMandate(dropped, false)[dropped.household]! },
    });
    expect(refused.status).toBe(422);
  });

  test("an offer over the ceiling is refused at presentation", async () => {
    // NOTE (mutation check, 2026-09-09): ceiling_not_enforced stopped
    // checking. This assertion failed with 200: the ceiling the person
    // signed bound nothing. Clause 46 is what a household sets against
    // merchants the registry does not list, and the reference deployment's
    // makers are not listed, so every candidate here counts toward it.
    const own = `mandate-ceiling-${Math.random().toString(36).slice(2, 8)}`;
    const tight = {
      id: own,
      household: MANDATE_STATE.household,
      ceiling_out_of_network: 1,
      co_signers: [],
      lapses_at: soon(600_000),
      version: 1,
    };
    const recorded = await call("POST", "/_node/mandates", {
      ...tight,
      signatures: signMandate(tight, false),
    });
    expect(recorded.status).toBe(201);

    const created = await call("POST", "/offers", conformingOffer({ mandate: own }));
    expect(created.status).toBe(201);
    const presented = await call("POST", `/offers/${(created.body as { id: string }).id}/present`, {});
    expect(presented.status).toBe(422);
    expect(presented.text).toContain("over_ceiling");
  });

  test("a lapsed mandate carries no offer", async () => {
    // NOTE (mutation check, 2026-09-09): lapsed_mandate_still_works skipped
    // the check. This assertion failed with 200. Clause 58: a standing
    // mandate lapses unless renewed, and lapsing has to stop something.
    const own = `mandate-lapsing-${Math.random().toString(36).slice(2, 8)}`;
    const brief = {
      id: own,
      household: MANDATE_STATE.household,
      ceiling_out_of_network: 10_000_000,
      co_signers: [],
      lapses_at: soon(2000),
      version: 1,
    };
    const recorded = await call("POST", "/_node/mandates", {
      ...brief,
      signatures: signMandate(brief, false),
    });
    expect(recorded.status).toBe(201);

    const created = await call("POST", "/offers", conformingOffer({ mandate: own }));
    expect(created.status).toBe(201);
    await sleep(2500);
    const presented = await call("POST", `/offers/${(created.body as { id: string }).id}/present`, {});
    expect(presented.status).toBe(422);
    expect(presented.text).toContain("lapsed");
  });

  test("a version that is not the next one is refused", async () => {
    const stale = next({ version: MANDATE_STATE.version });
    const refused = await call("POST", "/_node/mandates", {
      ...stale,
      signatures: signMandate(stale, true),
    });
    expect([409, 422]).toContain(refused.status);
  });
});

describe("mandates: the thresholds a person sets are enforced (§16.3, §16.4, §16.5)", () => {
  /**
   * Written 2026-09-10, when the ceiling and the lapse were the only two
   * protections a mandate carried. `04` §8 of the concept documents proposed
   * the other three and nothing was built; these probes and the mutations
   * beside them are what makes them more than a proposal.
   *
   * Each test sets its protection, uses it, and puts the mandate back. A
   * protection left on the shared fixture would fail every suite that settles
   * afterwards, which is the shape of a mutation that breaks the fixture
   * rather than one the corpus catches.
   */
  const current = async () => {
    const read = await call("GET", `/_node/mandates/${encodeURIComponent(MANDATE_STATE.id)}`);
    expect(read.status).toBe(200);
    return read.body as {
      id: string;
      household: string;
      ceiling_out_of_network: number;
      ceiling_daily: number | null;
      cooling_seconds: number | null;
      co_signers: string[];
      lapses_at: number;
      version: number;
    };
  };

  const put = async (over: Record<string, unknown>, withCoSigner: boolean) => {
    const now = await current();
    const next = { ...now, ...over, version: now.version + 1 };
    return {
      response: await call("POST", "/_node/mandates", {
        ...next,
        signatures: signMandate(next, withCoSigner),
      }),
      next,
    };
  };

  /**
   * Put the mandate back as it was, if a probe's write went through.
   *
   * A probe that expects a refusal writes nothing when the engine is right,
   * and under the mutation it exists to catch it writes whatever it sent into
   * the shared mandate. Measured 2026-09-11: assertion_challenge_unchecked
   * failed fifteen probes, most of them in other suites that settle, because a
   * version probe left a cooling window behind. A probe that fails for the
   * right reason must not take the corpus down with it.
   */
  const restore = async (was: Awaited<ReturnType<typeof current>>) => {
    const now = await current();
    if (now.version === was.version) return;
    const back = { ...was, version: now.version + 1 };
    expect(
      (await call("POST", "/_node/mandates", { ...back, signatures: signMandate(back, true) })).status
    ).toBe(201);
  };

  const keepEverything = (offer: { candidates: { id: string }[] }) =>
    offer.candidates.map((c) => ({ candidate: c.id, valence: "kept", kept_as: "self" }));

  /** An offer a person can decide on: created, then presented. */
  const presented = async () => {
    const offer = await createConformingOffer();
    const shown = await call("POST", `/offers/${offer.id}/present`, {});
    expect(shown.status).toBe(200);
    return shown.body as { id: string; candidates: { id: string; category: string | null }[] };
  };

  test("a settlement above the daily ceiling is refused, and the refusal names it", async () => {
    // NOTE (mutation check, 2026-09-10): daily_ceiling_ignored drops the sum
    // at settlement. This assertion failed with 200: a ceiling the person
    // signed bound nothing at all.
    const set = await put({ ceiling_daily: 1 }, false);
    expect(set.response.status).toBe(201);
    try {
      const offer = await presented();
      const decided = await decide(offer.id, { decisions: keepEverything(offer) });
      expect(decided.status).toBe(200);
      const settled = await call("POST", `/offers/${offer.id}/settle`, {});
      expect(settled.status).toBe(422);
      // §16.6. Four refusals share this status code. A `422` that does not say
      // which threshold refused is one no person can act on.
      expect((settled.body as { error: string }).error).toBe("mandate_ceiling_daily");
    } finally {
      // Removing a ceiling is a loosening, so it needs the co-signer.
      expect((await put({ ceiling_daily: null }, true)).response.status).toBe(201);
    }
  });

  test("no daily ceiling is not a ceiling of zero", async () => {
    // §16. Absent is not zero, which is the difference between "the person set
    // no daily limit" and "the person set one that refuses everything".
    const mandate = await current();
    expect(mandate.ceiling_daily).toBe(null);
    const offer = await presented();
    const decided = await decide(offer.id, { decisions: keepEverything(offer) });
    expect(decided.status).toBe(200);
    const settled = await call("POST", `/offers/${offer.id}/settle`, {});
    expect(settled.status).toBe(200);
    expect((settled.body as { charged: number }).charged).toBeGreaterThan(0);
  });

  test("a set inside its cooling window does not settle, and can be taken back", async () => {
    // NOTE (mutation check, 2026-09-10): cooling_settles_immediately drops the
    // window. This assertion failed with 200: a decision the person could
    // still take back was already money.
    const set = await put({ cooling_seconds: 3600 }, false);
    expect(set.response.status).toBe(201);
    try {
      const offer = await presented();
      const decided = await decide(offer.id, { decisions: keepEverything(offer) });
      expect(decided.status).toBe(200);
      expect((decided.body as { state: string }).state).toBe("decided");

      const early = await call("POST", `/offers/${offer.id}/settle`, {});
      expect(early.status).toBe(422);
      expect((early.body as { error: string }).error).toBe("mandate_cooling");

      // §16.5. Taking it back is the person's alone and needs no co-signer.
      const withdrawn = await call("DELETE", `/offers/${offer.id}/decisions`, undefined);
      expect(withdrawn.status).toBe(200);
      expect((withdrawn.body as { state: string }).state).toBe("presented");
      const back = (withdrawn.body as { candidates: { valence: string }[] }).candidates;
      expect(back.every((c) => c.valence === "offered")).toBe(true);
    } finally {
      // Shortening cooling is a loosening, and removing it is the shortest.
      expect((await put({ cooling_seconds: null }, true)).response.status).toBe(201);
    }
  });


  test("a confirmation taken back cannot be sent again (§10.5)", async () => {
    // NOTE (mutation check, 2026-09-11): confirmation_reusable stops recording
    // what has confirmed this offer. This assertion failed with 200 and the
    // offer read `decided` again, after the person had taken it back.
    //
    // The canonical form binds a decided set to an offer and to nothing else,
    // so the bytes that confirmed it are still good after the person takes it
    // back. Whatever saw them once, the hub that carried them included, could
    // put the set back inside the window §16.5 gives the person to change
    // their mind. Found by an adversarial pass on 2026-09-11 and measured
    // before it was closed: decide, withdraw, resend, and the offer read
    // `decided` again.
    const set = await put({ cooling_seconds: 3600 }, false);
    expect(set.response.status).toBe(201);
    try {
      const offer = await presented();
      const decisions = keepEverything(offer);
      const signature = signDecisions(offer.id, decisions as never);
      const first = await call("POST", `/offers/${offer.id}/decisions`, { decisions, signature });
      expect(first.status).toBe(200);
      expect((await call("DELETE", `/offers/${offer.id}/decisions`, undefined)).status).toBe(200);
      const again = await call("POST", `/offers/${offer.id}/decisions`, { decisions, signature });
      expect(again.status).toBe(422);
      expect((again.body as { error: string }).error).toBe("confirmation_reused");
      // NOTE (mutation check, 2026-09-11): confirmation_token_is_the_string
      // identifies a confirmation by the string that was posted. This
      // assertion failed with 200: base64 has many spellings for one
      // signature, and a register of strings holds none of the others, so a
      // space put the withdrawn set back.
      for (const spelling of [
        signature.replace(/=+$/, ""),
        signature.replace(/\+/g, "-").replace(/\//g, "_"),
        `${signature.slice(0, 8)} ${signature.slice(8)}`,
      ]) {
        const respelled = await call("POST", `/offers/${offer.id}/decisions`, {
          decisions,
          signature: spelling,
        });
        expect([spelling.slice(0, 12), respelled.status]).toEqual([spelling.slice(0, 12), 422]);
        expect((respelled.body as { error: string }).error).toBe("confirmation_reused");
      }
      // The offer is where the withdrawal left it, not where the replay
      // wanted it.
      const read = await call("GET", `/offers/${offer.id}`);
      expect((read.body as { state: string }).state).toBe("presented");
    } finally {
      expect((await put({ cooling_seconds: null }, true)).response.status).toBe(201);
    }
  });


  test("a passkey records the protections a person sets (§16.1)", async () => {
    // NOTE (mutation check, 2026-09-11): mandate_refuses_assertion takes a
    // bare signature and nothing else, which is what the route did until this
    // day. This assertion failed with 422 bad_signature: the assertion is read
    // as if it were a signature over the bytes, which it is not, so a person
    // who had signed in the only shape their device can produce was told their
    // signature was bad.
    //
    // Found by building the screen where a member sets their own protections,
    // which is how the same defect was found in §10.5 that morning. An
    // authenticator signs its own data and the hash of the client's, never
    // bytes a caller hands it, so a person who holds a passkey and nothing
    // else could record no ceiling, no cooling window and no co-signer. §16.5
    // went with it: without a cooling window there is nothing to take a
    // decided set back into.
    const now = await current();
    const next = { ...now, cooling_seconds: 3600, version: now.version + 1 };
    const recorded = await call("POST", "/_node/mandates", {
      ...next,
      assertions: { [next.household]: assertMandate(next) },
    });
    expect(recorded.status).toBe(201);
    try {
      const read = await call("GET", `/_node/mandates/${encodeURIComponent(next.id)}`);
      expect((read.body as { cooling_seconds: number }).cooling_seconds).toBe(3600);
    } finally {
      // Removing a cooling window is a loosening, so it carries the co-signer.
      expect((await put({ cooling_seconds: null }, true)).response.status).toBe(201);
    }
  });

  test("an assertion for one version does not record another (§16.1)", async () => {
    // The challenge is the mandate's canonical bytes, and a version is inside
    // them. Without that a person who agreed to one change would have agreed
    // to every later one.
    const now = await current();
    const next = { ...now, cooling_seconds: 3600, version: now.version + 1 };
    const later = { ...next, cooling_seconds: 60 };
    try {
      const wrong = await call("POST", "/_node/mandates", {
        ...later,
        assertions: { [later.household]: assertMandate(next) },
      });
      expect(wrong.status).toBe(422);
      expect((wrong.body as { error: string }).error).toBe("bad_signature");
    } finally {
      await restore(now);
    }
  });

  test("a change carries a signature or an assertion, and not both (§16.1)", async () => {
    const now = await current();
    const next = { ...now, cooling_seconds: 3600, version: now.version + 1 };
    try {
      const both = await call("POST", "/_node/mandates", {
        ...next,
        signatures: signMandate(next, false),
        assertions: { [next.household]: assertMandate(next) },
      });
      expect(both.status).toBe(400);
    } finally {
      await restore(now);
    }
  });

  test("the key a member actually holds records a mandate (§16.1)", async () => {
    // NOTE (mutation check, 2026-09-11): assertion_ed25519_only checks every
    // signature the way ed25519 is checked. This assertion failed with 422
    // bad_signature: the key most devices carry was refused, which is what
    // left a member of a hub unable to record any protection at all.
    //
    // The probes above sign with the fixture's ed25519 key and would pass
    // against an implementation that took ed25519 alone, which is the one that
    // leaves a real member unable to record anything. So this one registers a
    // key of the kind a device makes and records with it. `/_identities` is in
    // the specification (§13.2), which is why a probe may call it.
    const pair = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
    const who = `household-p256-${Math.random().toString(36).slice(2, 10)}`;
    const registered = await call("POST", "/_identities", {
      key: who,
      public_key: pair.publicKey.export({ type: "spki", format: "pem" }).toString(),
      attested: false,
    });
    expect(registered.status).toBe(201);
    const mandate = {
      id: `mandate-p256-${Math.random().toString(36).slice(2, 10)}`,
      household: who,
      ceiling_out_of_network: 100000,
      ceiling_daily: null,
      cooling_seconds: 3600,
      co_signers: [] as string[],
      lapses_at: Date.now() + 365 * 86_400_000,
      version: 1,
    };
    const recorded = await call("POST", "/_node/mandates", {
      ...mandate,
      assertions: { [who]: assertMandate(mandate, { key: pair.privateKey }) },
    });
    expect(recorded.status).toBe(201);
  });

  test("a co-signer cannot be fused by moving a comma (§16.1)", async () => {
    // NOTE (mutation check, 2026-09-11, re-anchored 2026-09-12): 
    // mandate_form_is_malleable joins the list without escaping it. This
    // assertion failed with 201: the record took a co-signer nobody signed
    // for, and the signature still verified.
    //
    // A plain comma join makes ["a","b"] and ["a,b"] the same bytes, so
    // whoever relays the change can post the second while the person signed
    // the first: the record then names one co-signer nobody holds, after
    // which no loosening can ever be signed, and the signature still
    // verifies. The probe read the category list until §16.4 was withdrawn;
    // the defect was always on both.
    const now = await current();
    const signed = {
      ...now,
      co_signers: [...now.co_signers, "cs-one", "cs-two"].sort(),
      version: now.version + 1,
    };
    const relayed = { ...signed, co_signers: [...now.co_signers, "cs-one,cs-two"].sort() };
    try {
      const posted = await call("POST", "/_node/mandates", {
        ...relayed,
        signatures: signMandate(signed, true),
      });
      expect(posted.status).toBe(422);
      expect((posted.body as { error: string }).error).toBe("bad_signature");
    } finally {
      await restore(now);
    }
  });

  test("a collection starts the window it is measured against (§16.5)", async () => {
    // NOTE (mutation check, 2026-09-11): recovery_leaves_no_moment decides the
    // offer without recording when. This assertion failed with 200 well after
    // the window had closed: the record of what a household used went back to
    // `offered`, and nobody had signed anything to make that happen.
    //
    // The physical binding is the one place an offer becomes decided without
    // anybody signing: the route comes back, and what was used and what came
    // back decides it (§11.2). If that leaves no moment, the window that makes
    // a decision final never starts.
    const set = await put({ cooling_seconds: 1 }, false);
    expect(set.response.status).toBe(201);
    try {
      const created = await call("POST", "/offers", conformingOffer({ binding: "physical" }));
      expect(created.status).toBe(201);
      const offer = created.body as { id: string; candidates: { id: string }[] };
      expect((await call("POST", `/offers/${offer.id}/present`, {})).status).toBe(200);
      const [used, ...back] = offer.candidates;
      const collected = await call("POST", `/offers/${offer.id}/recovery`, {
        returned: back.map((c) => c.id),
        consumed: [used!.id],
      });
      expect(collected.status).toBe(200);
      // The collection answers with its own row, so the offer is read back.
      const afterCollection = await call("GET", `/offers/${offer.id}`);
      expect((afterCollection.body as { state: string }).state).toBe("decided");
      await sleep(1_500);
      const late = await call("DELETE", `/offers/${offer.id}/decisions`, undefined);
      expect(late.status).toBe(422);
      expect((late.body as { error: string }).error).toBe("cooling_over");
    } finally {
      expect((await put({ cooling_seconds: null }, true)).response.status).toBe(201);
    }
  });

});

describe("permissions: a grant to a computation (clauses 9, 39, §7.5)", () => {
  /**
   * Clause 9 admits one calculation across nodes and clause 39 names it as
   * the one exception to a person never selling their data. What runs is not
   * the specification's business; what a grant to it must look like is.
   */
  test("a computation grant names an aggregate result, or is refused", async () => {
    // NOTE (mutation check, 2026-09-09): computation_grant_without_form
    // accepted a computation grant with no result form. The first assertion
    // failed with 201.
    const action = await liveAction();
    const refused = await grant(HOUSEHOLD, {
      grantee: "which-declines-predict-the-market",
      scope: ["valences"],
      purpose: "so makers learn what is not wanted",
      expires_at: soon(60_000),
      asked_from: action,
      kind: "computation",
    });
    expect(refused.status).toBe(422);

    const accepted = await grant(HOUSEHOLD, {
      grantee: "which-declines-predict-the-market",
      scope: ["valences"],
      purpose: "so makers learn what is not wanted",
      expires_at: soon(60_000),
      asked_from: action,
      kind: "computation",
      result_form: "aggregate",
    });
    expect(accepted.status).toBe(201);
    const row = accepted.body as { kind: string; result_form: string };
    expect(row.kind).toBe("computation");
    expect(row.result_form).toBe("aggregate");
  });

  test("raw data cannot be granted to a computation", async () => {
    // NOTE (mutation check, 2026-09-09): computation_grant_raw admitted it.
    // This assertion failed with 201. A model trained on raw data cannot
    // un-train a revoked grant, and whoever held it would hold per-person
    // events, so the limit is on what a grant can express.
    const action = await liveAction();
    const refused = await grant(HOUSEHOLD, {
      grantee: "which-declines-predict-the-market",
      scope: ["valences"],
      purpose: "so makers learn what is not wanted",
      expires_at: soon(60_000),
      asked_from: action,
      kind: "computation",
      result_form: "raw",
    });
    expect(refused.status).toBe(422);
  });

  test("a party grant carries no result form", async () => {
    const action = await liveAction();
    const refused = await grant(HOUSEHOLD, {
      grantee: `${HOUSEHOLD}-family`,
      scope: ["receipts"],
      purpose: "so they can help",
      expires_at: soon(60_000),
      asked_from: action,
      result_form: "aggregate",
    });
    expect(refused.status).toBe(422);
  });
});
