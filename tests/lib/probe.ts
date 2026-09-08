/**
 * The probes talk to an implementation over HTTP and nothing else. They know
 * no route that is not in the Valence specification, and they import nothing
 * from any implementation.
 *
 * Everything an implementation must hand the suite arrives as environment
 * variables, listed in ../README.md. Seeding a catalogue is deployment
 * plumbing that the specification does not describe, so the suite refuses to
 * guess at a route for it.
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(
      `${name} is required. See tests/README.md for the six variables an ` +
        `implementation supplies before the suite can run.`
    );
  }
  return value;
}

export const BASE = required("VALENCE_BASE_URL").replace(/\/+$/, "");
export const CONFIG_VERSION = required("VALENCE_CONFIG_VERSION");
export const HOUSEHOLD = required("VALENCE_HOUSEHOLD");
export const MANDATE = required("VALENCE_MANDATE");
/**
 * §5 publishes no recommended rate, so the suite cannot assume one. The
 * deployment declares the rate it runs at and the suite checks the formula
 * against it, which is what makes the boundary testable: an implementation
 * that refuses one candidate more than the floor requires is as non-conformant
 * as one that accepts one fewer.
 */
export const EXPLORATION_RATE = Number(required("VALENCE_EXPLORATION_RATE"));
if (!(EXPLORATION_RATE > 0) || EXPLORATION_RATE > 1) {
  throw new Error("VALENCE_EXPLORATION_RATE must be greater than 0 and at most 1");
}

export const floorFor = (n: number) => Math.max(1, Math.ceil(n * EXPLORATION_RATE));

export const PRODUCTS = required("VALENCE_PRODUCTS")
  .split(",")
  .map((p) => p.trim())
  .filter(Boolean);

if (PRODUCTS.length < 3) {
  throw new Error("VALENCE_PRODUCTS needs at least three product references");
}

if (PRODUCTS.length <= floorFor(PRODUCTS.length)) {
  throw new Error(
    "VALENCE_PRODUCTS needs enough references that the floor is not the whole " +
      "offer, or the boundary probes cannot distinguish a floor from a rule " +
      "that every candidate must be exploration"
  );
}

/**
 * A well-formed, correctly signed lineage edge that this implementation will
 * accept. Signing one requires a key the identity root has attested, and
 * attesting a key is deployment plumbing the specification does not describe,
 * so the suite asks for the finished article rather than a route to make one.
 *
 * It is required rather than optional. §7.1 is the anti-discrimination
 * guarantee the mark rests on, and a probe that skips when a fixture is
 * missing is a probe an implementation can pass by omission.
 */
export const LINEAGE_EDGE: Record<string, unknown> = (() => {
  const raw = required("VALENCE_LINEAGE_EDGE");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("VALENCE_LINEAGE_EDGE is not valid JSON");
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("VALENCE_LINEAGE_EDGE must be a JSON object");
  }
  const edge = parsed as Record<string, unknown>;
  for (const key of ["from", "to", "product", "merchant", "kind", "signature"]) {
    if (typeof edge[key] !== "string" || edge[key] === "") {
      throw new Error(`VALENCE_LINEAGE_EDGE is missing ${key}`);
    }
  }
  return edge;
})();

export const LINEAGE_RECIPIENT = LINEAGE_EDGE.to as string;

export type Probe = {
  status: number;
  body: unknown;
  text: string;
};

export async function call(
  method: string,
  path: string,
  body?: unknown,
  headers: Record<string, string> = {}
): Promise<Probe> {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let parsed: unknown = undefined;
  try {
    parsed = text === "" ? undefined : JSON.parse(text);
  } catch {
    parsed = undefined;
  }
  return { status: response.status, body: parsed, text };
}

/**
 * Walks a response for a key at any depth.
 *
 * Absence is checked on the whole document rather than on the fields the
 * suite happens to know, because a capability that must not exist is easiest
 * to reintroduce somewhere the reader was not looking.
 */
export function findKey(value: unknown, predicate: (key: string) => boolean): string[] {
  const hits: string[] = [];
  const walk = (node: unknown, trail: string) => {
    if (Array.isArray(node)) {
      node.forEach((item, i) => walk(item, `${trail}[${i}]`));
      return;
    }
    if (node && typeof node === "object") {
      for (const [key, child] of Object.entries(node)) {
        const here = trail === "" ? key : `${trail}.${key}`;
        if (predicate(key)) hits.push(here);
        walk(child, here);
      }
    }
  };
  walk(value, "");
  return hits;
}

export const soon = (ms: number) => Date.now() + ms;
export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type CandidateSpec = {
  product: string;
  quantity?: number;
  predicted_conversion?: number | null;
  is_exploration?: boolean;
};

export function offerBody(
  candidates: CandidateSpec[],
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    binding: "digital",
    household: HOUSEHOLD,
    purpose: "replenish",
    config_version: CONFIG_VERSION,
    expires_at: soon(60_000),
    mandate: MANDATE,
    candidates: candidates.map((c) => ({
      product: c.product,
      quantity: c.quantity ?? 1,
      predicted_conversion:
        c.predicted_conversion === undefined ? 0.5 : c.predicted_conversion,
      is_exploration: c.is_exploration ?? false,
    })),
    ...overrides,
  };
}

/** An offer that satisfies the floor whatever rate the deployment uses. */
export function conformingOffer(
  overrides: Record<string, unknown> = {},
  count = PRODUCTS.length
): Record<string, unknown> {
  const used = PRODUCTS.slice(0, count);
  return offerBody(
    used.map((product) => ({
      product,
      predicted_conversion: 0.05,
      is_exploration: true,
    })),
    overrides
  );
}

export async function createConformingOffer(
  overrides: Record<string, unknown> = {}
): Promise<{ id: string; candidates: { id: string }[] }> {
  const created = await call("POST", "/offers", conformingOffer(overrides));
  if (created.status !== 201) {
    throw new Error(
      `setup failed: POST /offers returned ${created.status} ${created.text}`
    );
  }
  return created.body as { id: string; candidates: { id: string }[] };
}
