import { describe, expect, test } from "bun:test";

/**
 * §13.1. An implementation may present the engine's surface, the hub's, or
 * both, and is judged on the surface it presents.
 *
 * These probes reach two servers the harness starts beside the reference, each
 * declaring one role. Everything else in this corpus reaches an implementation
 * that runs both, and against that one nothing here could be seen: a boundary
 * a probe cannot reach is one this specification cannot hold anyone to, which
 * is the argument the section is built on.
 */
const ENGINE_ONLY = required("VALENCE_ENGINE_ONLY_URL");
const HUB_ONLY = required("VALENCE_HUB_ONLY_URL");

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set. The harness starts a server per role.`);
  return v.replace(/\/+$/, "");
}

/**
 * What a probe here needs is not the status but the reason. An empty server
 * answers 404 for a household it has never heard of, and a server that does
 * not present the hub answers 404 for the same path: the same status, two
 * different facts. §13.1's refusal carries `not_this_role`, so the two are
 * told apart by the name rather than by the number.
 */
async function answers(base: string, path: string, method = "GET"): Promise<boolean> {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { "content-type": "application/json" },
    body: method === "GET" || method === "DELETE" ? undefined : "{}",
  });
  if (response.status !== 404) return true;
  const body = (await response.json().catch(() => ({}))) as { error?: string };
  return body.error !== "not_this_role";
}

async function status(base: string, path: string, method = "GET"): Promise<number> {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { "content-type": "application/json" },
    body: method === "GET" || method === "DELETE" ? undefined : "{}",
  });
  return response.status;
}

describe("roles: an engine alone answers for the presenter's surface (§13.1)", () => {
  test("it answers for offers", async () => {
    // 404 would mean the route is not here; anything else means it is, and the
    // probe is about presence rather than about a particular success.
    expect(await answers(ENGINE_ONLY, "/offers?household=probe")).toBe(true);
  });

  test("it does not answer for the household's surface", async () => {
    expect(await answers(ENGINE_ONLY, "/households/probe/export")).toBe(false);
    expect(await answers(ENGINE_ONLY, "/_node/mandates/probe")).toBe(false);
    expect(await answers(ENGINE_ONLY, "/lineage/acts?household=probe")).toBe(false);
  });

  test("it does not answer for the two offer actions that carry the person's authority", async () => {
    // The path is the offer's and the role is the hub's. An engine that
    // answered here would be taking the person's signature and the person's
    // delivery surface with it.
    expect(await answers(ENGINE_ONLY, "/offers/probe/decisions", "POST")).toBe(false);
    expect(await answers(ENGINE_ONLY, "/offers/probe/delivery")).toBe(false);
  });
});

describe("roles: a hub alone answers for the person's surface (§13.1)", () => {
  test("it answers for the household and the mandate", async () => {
    expect(await answers(HUB_ONLY, "/households/probe/export")).toBe(true);
    expect(await answers(HUB_ONLY, "/_node/mandates/probe")).toBe(true);
  });

  test("it answers for deciding and for delivery", async () => {
    expect(await answers(HUB_ONLY, "/offers/probe/decisions", "POST")).toBe(true);
    expect(await answers(HUB_ONLY, "/offers/probe/delivery")).toBe(true);
  });

  test("it does not answer for the presenter's surface", async () => {
    expect(await answers(HUB_ONLY, "/offers", "POST")).toBe(false);
    expect(await answers(HUB_ONLY, "/offers/probe/settle", "POST")).toBe(false);
    expect(await answers(HUB_ONLY, "/_presenter/configs", "POST")).toBe(false);
  });
});

describe("roles: the registry belongs to neither (clause 1, §17)", () => {
  test("both roles answer for it", async () => {
    // Clause 1's neutral infrastructure is nobody's subject, and a deployment
    // may put it behind either role. A registry that answered only where the
    // engine ran would make resolution a presenter's favour.
    expect(await status(ENGINE_ONLY, "/registry")).toBe(200);
    expect(await status(HUB_ONLY, "/registry")).toBe(200);
  });
});
