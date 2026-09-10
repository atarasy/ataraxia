import { describe, expect, test } from "bun:test";
import { generateKeyPairSync } from "node:crypto";
import {
  CONFIG_VERSION,
  HOUSEHOLD,
  MANDATE,
  freshHousehold,
  PRODUCTS,
  signDecisions,
  soon,
} from "../lib/probe.js";

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

/** A call that returns the body, for the end-to-end probe below. */
async function send(base: string, method: string, path: string, body?: unknown): Promise<unknown> {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${method} ${path} -> ${response.status} ${text}`);
  }
  return text ? JSON.parse(text) : {};
}

/** §16.3. What the hub says has settled for this household today. */
async function total(): Promise<number> {
  const body = (await send(
    HUB_ONLY,
    "GET",
    `/households/${encodeURIComponent(HOUSEHOLD)}/settled?since=0`
  )) as { total: number };
  return body.total;
}

function offerBody(who: string = HOUSEHOLD) {
  // The same shape `lib/probe.ts` builds, written out here because this suite
  // posts to a party the library does not know about.
  return {
    binding: "digital",
    household: who,
    purpose: "replenish",
    config_version: CONFIG_VERSION,
    expires_at: soon(60_000),
    mandate: MANDATE,
    candidates: PRODUCTS.map((product) => ({
      product,
      quantity: 1,
      predicted_conversion: 0.05,
      is_exploration: true,
    })),
  };
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

  test("it answers for deciding, because authority travels in the signature", async () => {
    // Deciding was the hub's until 2026-09-11, on the reasoning that a decided
    // set is the person's. It is, and clause 35 makes it so by the signature,
    // which whoever answers the route cannot forge. What answering it needs is
    // the offer, and only the engine has one.
    expect(await answers(ENGINE_ONLY, "/offers/probe/decisions", "POST")).toBe(true);
  });

  test("it does not answer for the household's delivery surface", async () => {
    // §7.5b. A carrier's code resolves to an address, so a merchant must not
    // read one. This is the action whose path is the offer's and whose role is
    // the hub's, and a hub holds deliveries without holding offers.
    expect(await answers(ENGINE_ONLY, "/offers/probe/delivery")).toBe(false);
  });
});

describe("roles: a hub alone answers for the person's surface (§13.1)", () => {
  test("it answers for the household and the mandate", async () => {
    expect(await answers(HUB_ONLY, "/households/probe/export")).toBe(true);
    expect(await answers(HUB_ONLY, "/_node/mandates/probe")).toBe(true);
  });

  test("it answers for delivery and not for deciding", async () => {
    expect(await answers(HUB_ONLY, "/offers/probe/delivery")).toBe(true);
    expect(await answers(HUB_ONLY, "/offers/probe/decisions", "POST")).toBe(false);
  });

  test("it does not answer for the presenter's surface", async () => {
    expect(await answers(HUB_ONLY, "/offers", "POST")).toBe(false);
    expect(await answers(HUB_ONLY, "/offers/probe/settle", "POST")).toBe(false);
    expect(await answers(HUB_ONLY, "/_presenter/configs", "POST")).toBe(false);
  });
});

describe("roles: the two parties are one implementation (§13.2)", () => {
  /**
   * The probes above ask **who answers**, which is what §13.1 was written to
   * make checkable. They cannot ask whether an answer has anything behind it,
   * and on 2026-09-11 that gap hid three defects for a day: an engine summing
   * its own settlements, a hub exporting an empty node, and deciding assigned
   * to the party without the offer.
   *
   * This one asks the other question. It settles an offer on the engine and
   * reads the result from the hub, so nothing but a working interface between
   * them can make it pass.
   */
  test("a settlement on the engine reaches the person's own copy on the hub", async () => {
    const before = await total();
    const offer = (await send(ENGINE_ONLY, "POST", "/offers", offerBody())) as {
      id: string;
      candidates: { id: string }[];
    };
    expect(offer.id).toBeTruthy();
    await send(ENGINE_ONLY, "POST", `/offers/${offer.id}/present`, {});
    const decisions = offer.candidates.map((c) => ({
      candidate: c.id,
      valence: "kept" as const,
      kept_as: "self" as const,
    }));
    const decided = await send(ENGINE_ONLY, "POST", `/offers/${offer.id}/decisions`, {
      decisions,
      signature: signDecisions(offer.id, decisions),
    });
    expect((decided as { state: string }).state).toBe("decided");
    const settled = (await send(ENGINE_ONLY, "POST", `/offers/${offer.id}/settle`, {})) as {
      charged: number;
    };
    expect(settled.charged).toBeGreaterThan(0);

    // The hub is a different process with a different store. What it knows
    // about this settlement it can only have been told.
    const after = await total();
    expect(after - before).toBe(settled.charged);
  });

  test("the hub alone exports a node that has the offer in it", async () => {
    // A household of its own: novelty is per household (clause 26), and the
    // probe above has already been offered every product in the catalogue.
    const who = freshHousehold();
    // Clause 43, §13.2. Until 2026-09-11 the export read the engine's store,
    // so a hub presenting its role alone answered this route with an empty
    // node: the route was there and there was nothing behind it.
    const offer = (await send(ENGINE_ONLY, "POST", "/offers", offerBody(who))) as {
      id: string;
      candidates: { id: string }[];
    };
    await send(ENGINE_ONLY, "POST", `/offers/${offer.id}/present`, {});
    // Clause 8: what was declined belongs in the person's copy as much as what
    // was kept, so this set refuses everything and the export still carries it.
    const decisions = offer.candidates.map((c) => ({
      candidate: c.id,
      valence: "returned" as const,
    }));
    await send(ENGINE_ONLY, "POST", `/offers/${offer.id}/decisions`, {
      decisions,
      signature: signDecisions(offer.id, decisions),
    });

    const node = (await send(
      HUB_ONLY,
      "GET",
      `/households/${encodeURIComponent(who)}/export`
    )) as { offers?: { id: string }[] };
    expect(node.offers?.some((o) => o.id === offer.id)).toBe(true);
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

describe("roles: a key belongs to neither (clause 2, §13.2)", () => {
  test("both roles register one", async () => {
    // NOTE (no measurable mutation, 2026-09-11): identities_need_both_roles
    // gives the route to the engine, and it aborts rather than being caught.
    // The reference's own seed reads the role table, so under the mutation it
    // posts every key to the engine alone, and its first lineage edge to the
    // hub is then refused as unattested before any probe runs. A hub that
    // cannot hold a key cannot be seeded, so against this deployment the
    // requirement is enforced by the fixture; the probe is here because
    // another implementation's harness may seed differently. It is named
    // among the unproven in MUTATIONS.md rather than counted.
    //
    // Both roles verify signatures, so both hold keys, and clause 2 puts the
    // root of identity outside either. A hub that could not take a key could
    // not check the edge a person signs; an engine that could not take one
    // could not check a catalogue.
    for (const base of [ENGINE_ONLY, HUB_ONLY]) {
      const pair = generateKeyPairSync("ed25519");
      const response = await fetch(`${base}/_identities`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          key: `key-roles-${Math.random().toString(36).slice(2, 10)}`,
          public_key: pair.publicKey.export({ type: "spki", format: "pem" }).toString(),
          attested: false,
        }),
      });
      expect(response.status).toBe(201);
    }
  });
});
