import { generateKeyPairSync } from "node:crypto";
import { describe, expect, test } from "bun:test";
import { call, findKey, meansAnyOf, conformingOffer } from "../lib/probe.js";

/**
 * Clause 1, and specification §17.
 *
 * The endpoint registry resolves and does not rank. It is the one piece of
 * shared infrastructure that could become the place where things are found,
 * and these probes are the line that keeps it from becoming that.
 *
 * The test for every probe here is the same: does the answer depend on
 * anything but the question? An order that means something, a field that
 * scores, a query by what a person wants, or an answer that differs by who
 * asks, and the registry has become the intent layer under the name of a
 * directory.
 */

const RANKING_KEYS = [
  "rank",
  "score",
  "relevance",
  "popularity",
  "featured",
  "recommended",
  "sponsored",
  "priority",
  "weight",
  "position",
  "boost",
];

describe("registry: an entry resolves (§17.1)", () => {
  test("a merchant resolves to its endpoints by key", async () => {
    // NOTE (mutation check, 2026-09-09): registry_resolve_404 made every
    // resolution a 404. This assertion failed. A registry that cannot
    // resolve is a list, and the list is the half that must not become
    // discovery.
    const list = await call("GET", "/registry?protocol=valence");
    expect(list.status).toBe(200);
    const entries = (list.body as { entries: { merchant: string }[] }).entries;
    expect(entries.length).toBeGreaterThan(0);

    const one = await call("GET", `/registry/${encodeURIComponent(entries[0]!.merchant)}`);
    expect(one.status).toBe(200);
    const entry = one.body as { endpoints: Record<string, string> };
    expect(typeof entry.endpoints.valence).toBe("string");
  });
});

describe("registry: no order that means anything (§17.2)", () => {
  test("the list is in key order", async () => {
    // NOTE (mutation check, 2026-09-09): registry_by_registration returned
    // entries in the order they registered, which the seed arranges to differ
    // from key order. This assertion failed. Registration order rewards being
    // early, which is a ranking with a polite name.
    const list = await call("GET", "/registry?protocol=valence");
    const keys = (list.body as { entries: { merchant: string }[] }).entries.map((e) => e.merchant);
    expect(keys.length).toBeGreaterThan(1);
    expect([...keys].sort()).toEqual(keys);
  });

  test("no entry carries a rank, a score, or a flag that promotes it", async () => {
    // NOTE (mutation check, 2026-09-09): registry_featured added a `featured`
    // flag to marked entries. This assertion failed, naming it. A flag that
    // promotes is a rank with one level.
    const list = await call("GET", "/registry");
    expect(findKey(list.body, meansAnyOf(RANKING_KEYS))).toEqual([]);
  });

  test("there is no parameter that sorts", async () => {
    // NOTE (mutation check, 2026-09-09): registry_accepts_sort let ?sort=
    // through the parameter check. This assertion failed with 200. A sort
    // parameter the caller supplies is a ranking the caller chose, and the
    // registry has still served it.
    for (const param of ["sort=popularity", "order=rank", "sort=mark", "orderBy=registered_at"]) {
      const sorted = await call("GET", `/registry?${param}`);
      expect(sorted.status).toBe(404);
    }
  });
});

describe("registry: no query by intent (§17.2)", () => {
  test("a query by what a person wants is not a parameter", async () => {
    // NOTE (mutation check, 2026-09-09): registry_search accepted ?q= and
    // matched it against endpoint URLs. This assertion failed with 200. The
    // moment a registry answers a want, it has decided what a person sees.
    for (const param of ["q=tea", "product=tea-a", "category=tea", "occasion=birth", "price=1200", "search=gift"]) {
      const asked = await call("GET", `/registry?${param}`);
      expect(asked.status).toBe(404);
    }
  });

  test("an entry carries no product data", async () => {
    // NOTE (mutation check, 2026-09-09): registry_products_on_entry put
    // two product references on each entry. This assertion failed, naming
    // products. A registry that copies what merchants sell has an index,
    // and whoever holds the index takes the rent.
    const list = await call("GET", "/registry");
    expect(
      findKey(list.body, meansAnyOf(["product", "products", "catalogue", "catalog", "items", "sku", "price", "category"]))
    ).toEqual([]);
  });
});

describe("registry: the same answer to every caller (§17.2)", () => {
  test("two callers get the same list", async () => {
    // NOTE (mutation check, 2026-09-09): registry_personalised put the entry
    // matching the caller's `x-household` first. This assertion failed. An
    // answer that depends on who asked is a recommendation.
    const a = await call("GET", "/registry?protocol=valence", undefined, { "x-household": "household-a" });
    const b = await call("GET", "/registry?protocol=valence", undefined, { "x-household": "household-b" });
    expect(a.body).toEqual(b.body);
  });

  test("no field names who asked", async () => {
    // NOTE (mutation check, 2026-09-09): registry_echoes_caller echoed the
    // x-household header in the response. This assertion failed. A field
    // that names the asker is the first half of an answer that depends on
    // them.
    const list = await call("GET", "/registry", undefined, { "x-household": "household-a" });
    expect(findKey(list.body, meansAnyOf(["household", "caller", "asked_by", "viewer", "for"]))).toEqual([]);
  });
});

describe("registry: the mark is not a gate (clause 55, §17.2)", () => {
  test("an entry without the mark is listed", async () => {
    // NOTE (mutation check, 2026-09-09): registry_requires_mark dropped
    // unmarked entries from every list. This assertion failed. Clause 55 says
    // the mark attaches to software and hosts and never gates a merchant, and
    // a registry that lists only the marked has made the mark a gate.
    const list = await call("GET", "/registry?protocol=valence");
    const entries = (list.body as { entries: { mark: boolean }[] }).entries;
    expect(entries.some((e) => e.mark === false)).toBe(true);
    expect(entries.some((e) => e.mark === true)).toBe(true);
  });

  test("an entry without the mark resolves", async () => {
    // NOTE (mutation check, 2026-09-11): registry_resolve_needs_the_mark made
    // resolve throw 404 for an entry that does not carry the mark. Every probe
    // passed: the listing probes read both entries, and every resolve in this
    // file resolved a merchant that happens to carry it. Being listed and
    // being reachable are two gates, and clause 55 closes both.
    const list = await call("GET", "/registry?protocol=valence");
    const entries = (list.body as { entries: { merchant: string; mark: boolean }[] }).entries;
    const unmarked = entries.find((e) => e.mark === false);
    expect(unmarked).toBeDefined();
    const resolved = await call("GET", `/registry/${encodeURIComponent(unmarked!.merchant)}`);
    expect(resolved.status).toBe(200);
  });

  test("filtering on the mark happens only when the caller asks by name", async () => {
    // NOTE (mutation check, 2026-09-09): registry_ignores_mark_filter
    // ignored ?mark=true and returned every entry. This assertion failed.
    // The mark may be preferred by a caller who asks; a registry that
    // cannot honour the ask has made the mark meaningless from the other
    // side.
    const only = await call("GET", "/registry?mark=true");
    const entries = (only.body as { entries: { mark: boolean }[] }).entries;
    expect(entries.every((e) => e.mark === true)).toBe(true);
  });
});

describe("registry: no entry names a platform (clause 6)", () => {
  /**
   * Clause 6, as rewritten on 2026-09-09. An agent prefers a merchant for
   * what it does, never for where it is hosted, and the way that is made
   * structural is that nothing it reads carries the field. An entry with a
   * `platform`, `host` or `powered_by` is that field arriving.
   */
  const PLATFORM_KEYS = ["platform", "host", "hosted_by", "hosting", "edition", "powered_by", "vendor", "provider"];

  test("the list names no platform on any entry", async () => {
    // NOTE (mutation check, 2026-09-09): registry_names_platform put
    // `platform: "atarasy-hosted"` on every entry. This assertion failed,
    // naming entries[0].platform.
    const list = await call("GET", "/registry?protocol=valence");
    expect(list.status).toBe(200);
    expect(findKey(list.body, meansAnyOf(PLATFORM_KEYS))).toEqual([]);
  });
});

describe("registry: listing is not a condition of taking part (clause 13)", () => {
  /**
   * Clause 13, as rewritten on 2026-09-09. A merchant with a feed can be
   * offered whether or not it chose to be listed. The registry resolves; it
   * gates nothing. The probe reads the merchant off a conforming offer,
   * confirms the registry does not know it, and confirms the offer was
   * created anyway.
   */
  test("an offer names a merchant the registry does not list, and is created", async () => {
    // NOTE (mutation check, 2026-09-09): require_registered_merchant refused
    // an offer whose candidates name an unlisted merchant. This assertion
    // failed with 422. A registry that gates is a programme by another name.
    const created = await call("POST", "/offers", conformingOffer());
    expect(created.status).toBe(201);
    const merchant = (created.body as { candidates: { merchant: string }[] }).candidates[0]!.merchant;
    const resolved = await call("GET", `/registry/${encodeURIComponent(merchant)}`);
    expect(resolved.status).toBe(404);
  });
});


describe("registry: an attested key is not replaced (§17.1)", () => {
  test("a second attestation with a different key is refused", async () => {
    // NOTE (mutation check, 2026-09-09): attest_overwrites let a later caller
    // replace a merchant's attested key. This assertion failed with 201.
    // Whoever can overwrite the key can sign the merchant's entry, and the
    // same map is what clauses 22 and 35 resolve to.
    const merchant = `probe-merchant-${Math.random().toString(36).slice(2, 8)}`;
    const one = generateKeyPairSync("ed25519").publicKey.export({ type: "spki", format: "pem" }).toString();
    const two = generateKeyPairSync("ed25519").publicKey.export({ type: "spki", format: "pem" }).toString();
    const first = await call("POST", "/registry/attest", { merchant, public_key: one });
    expect(first.status).toBe(201);
    const again = await call("POST", "/registry/attest", { merchant, public_key: one });
    expect(again.status).toBe(201);
    const replaced = await call("POST", "/registry/attest", { merchant, public_key: two });
    expect(replaced.status).toBe(409);
    // NOTE (mutation check, 2026-09-11): attest_replaces_the_key wrote the new
    // key and then threw the conflict, so the refusal above still returned 409
    // while the stored key had already been replaced. This line catches it
    // without a route that reads keys back: presenting the original key is
    // idempotent and returns 201 while it is the stored one, and would
    // conflict if the second key had taken its place.
    const stillTheFirst = await call("POST", "/registry/attest", { merchant, public_key: one });
    expect(stillTheFirst.status).toBe(201);
  });

  test("attestation answers with no key material (clause 2)", async () => {
    // NOTE (mutation check, 2026-09-11): attest_returns_the_key_it_stored made
    // the route answer with the key it had just recorded. Nothing went red,
    // because no probe read this response's body at all. Clause 2 roots
    // identity outside the system: this route records a key somebody brought,
    // and a route that hands one back reads as the place keys come from.
    const merchant = `probe-merchant-${Math.random().toString(36).slice(2, 8)}`;
    const key = generateKeyPairSync("ed25519").publicKey.export({ type: "spki", format: "pem" }).toString();
    const attested = await call("POST", "/registry/attest", { merchant, public_key: key });
    expect(attested.status).toBe(201);
    expect(
      findKey(attested.body, meansAnyOf(["public_key", "key", "private_key", "secret", "seed", "pem"]))
    ).toEqual([]);
  });
});
