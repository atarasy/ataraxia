import { describe, expect, test } from "bun:test";
import { call, findKey, HOUSEHOLD, meansAnyOf } from "../lib/probe.js";

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
    expect(
      findKey(read.body, meansAnyOf(["compensation", "price", "fee", "payment", "reward", "amount"]))
    ).toEqual([]);
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
    const read = await call("GET", "/permissions");
    expect(read.status).toBe(404);
  });
});
