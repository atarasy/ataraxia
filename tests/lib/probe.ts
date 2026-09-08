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

/**
 * The merchant's own price for each product in `VALENCE_PRODUCTS`, as JSON.
 *
 * Clause 10 says a household never pays more through an offer than buying
 * direct, and that is only checkable against a price the suite knows
 * independently. Without it a probe can refuse a `unit_price` field and still
 * miss a surcharge applied under another name, which is what happened on
 * 2026-09-08.
 */
export const PRICES: Record<string, number> = (() => {
  const raw = required("VALENCE_PRICES");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("VALENCE_PRICES is not valid JSON");
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("VALENCE_PRICES must be a JSON object of product to price");
  }
  const prices = parsed as Record<string, unknown>;
  for (const [ref, price] of Object.entries(prices)) {
    if (typeof price !== "number") {
      throw new Error(`VALENCE_PRICES: ${ref} is not a number`);
    }
  }
  return prices as Record<string, number>;
})();

/**
 * A catalogue version registered after `VALENCE_CONFIG_VERSION`, in which at
 * least one product has a different price, and the prices it carries.
 *
 * §6.3 says a settlement uses the version stamped on the offer at creation.
 * That is only checkable against a catalogue that has since moved: with a
 * single version, an implementation that reads the live catalogue and one that
 * reads the frozen one return the same amount, and the probe passes either
 * way. The first version of this suite had exactly that blind spot, and the
 * mutation written for it survived.
 */
export const CONFIG_VERSION_LATER = required("VALENCE_CONFIG_VERSION_LATER");

export const PRICES_LATER: Record<string, number> = (() => {
  const raw = required("VALENCE_PRICES_LATER");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("VALENCE_PRICES_LATER is not valid JSON");
  }
  const prices = parsed as Record<string, number>;
  const moved = Object.keys(prices).filter((k) => prices[k] !== PRICES[k]);
  if (moved.length === 0) {
    throw new Error(
      "VALENCE_PRICES_LATER must differ from VALENCE_PRICES for at least one " +
        "product, or the freeze cannot be observed"
    );
  }
  return prices;
})();

/** A product whose price differs between the two catalogue versions. */
export const REPRICED = Object.keys(PRICES_LATER).find(
  (k) => PRICES_LATER[k] !== PRICES[k]
)!;

/**
 * The bindings this deployment implements, comma separated.
 *
 * §3.2 puts `consumed` and `lost` in the physical binding only, so an
 * implementation that offers the digital binding alone cannot bill a household
 * for goods it lost: it has no such goods. Declaring the bindings lets the
 * probes for §13 condition 8 run where they mean something and say so where
 * they do not, rather than skipping quietly.
 */
export const BINDINGS = required("VALENCE_BINDINGS")
  .split(",")
  .map((b) => b.trim())
  .filter(Boolean);

if (!BINDINGS.includes("digital")) {
  throw new Error("VALENCE_BINDINGS must include digital");
}

export const HAS_PHYSICAL = BINDINGS.includes("physical");

/**
 * A second host of the same implementation, empty of this household's node.
 *
 * Clause 61 says a member can move an entire node to another host. Checking
 * that against one host can only ask whether a file was produced, which is the
 * weakest possible reading of clause 47. With two, the question becomes whether
 * the second answers as the first did, which is the reading `exit/` uses.
 */
export const SECOND_HOST = required("VALENCE_SECOND_HOST_URL").replace(/\/+$/, "");

/** Same call, against the receiving host. */
export async function callSecond(
  method: string,
  path: string,
  body?: unknown,
  headers: Record<string, string> = {}
): Promise<Probe> {
  const response = await fetch(`${SECOND_HOST}${path}`, {
    method,
    headers: { "content-type": "application/json", ...headers },
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
 * Days after the recovery deadline before an uncollected candidate is `lost`,
 * as this deployment runs it.
 *
 * §11 gives no figure, like §5's exploration rate, so the suite asks rather
 * than assumes. A probe that waited a fixed interval would pass against a
 * deployment with a three-day grace by never reaching the deadline, and report
 * that the loss rule works.
 */
export const RECOVERY_GRACE_DAYS = Number(
  required("VALENCE_RECOVERY_GRACE_DAYS")
);
if (!Number.isFinite(RECOVERY_GRACE_DAYS) || RECOVERY_GRACE_DAYS < 0) {
  throw new Error("VALENCE_RECOVERY_GRACE_DAYS must be zero or more");
}

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
/**
 * Collapses a key to letters and digits, lower case.
 *
 * `trackingId`, `tracking_id`, `tracking-id` and `TrackingID` are the same
 * capability under four spellings, and a probe that compares exact strings
 * catches one of them. An adversarial pass on 2026-09-08 reintroduced four
 * forbidden fields in camelCase and every probe here stayed green.
 */
export const normaliseKey = (key: string) =>
  key.toLowerCase().replace(/[^a-z0-9]/g, "");

/** True when a key means any of these names, whatever its spelling. */
export const meansAnyOf = (names: readonly string[]) => {
  const wanted = new Set(names.map(normaliseKey));
  return (key: string) => wanted.has(normaliseKey(key));
};

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
    // Clause 26. A ceremonial offer carries the band the giver chose; the
    // default band spans every declared price so the probes that are not
    // about the band are not refused by it.
    ...(overrides.purpose === "ceremonial" && overrides.price_band === undefined
      ? { price_band: { min: Math.min(...Object.values(PRICES)), max: Math.max(...Object.values(PRICES)) } }
      : {}),
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

/**
 * An offer that meets the floor exactly and leaves the rest ordinary.
 *
 * `conformingOffer` marks every candidate as exploration, which is safe for
 * the floor probes and blind everywhere else: a rule that treats exploration
 * candidates differently from ordinary ones is invisible to an offer made
 * entirely of one kind. An adversarial pass turned silence into consent for
 * ordinary candidates only, and every silence probe stayed green.
 */
export function mixedOffer(
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  const required = floorFor(PRODUCTS.length);
  return offerBody(
    PRODUCTS.map((product, i) => ({
      product,
      predicted_conversion: i < required ? 0.05 : 0.9,
      is_exploration: i < required,
    })),
    overrides
  );
}

export async function createMixedOffer(
  overrides: Record<string, unknown> = {}
): Promise<{ id: string; candidates: { id: string; is_exploration: boolean }[] }> {
  const created = await call("POST", "/offers", mixedOffer(overrides));
  if (created.status !== 201) {
    throw new Error(
      `setup failed: POST /offers returned ${created.status} ${created.text}`
    );
  }
  return created.body as {
    id: string;
    candidates: { id: string; is_exploration: boolean }[];
  };
}

let cachedPresenter: string | undefined;

/**
 * The presenter this deployment offers as. Read from an offer rather than
 * from an environment variable, because the offer view is where a
 * conforming implementation has to say it (clause 40's `hide_presenter`).
 */
export async function presenter(): Promise<string> {
  if (cachedPresenter) return cachedPresenter;
  const offer = await createConformingOffer();
  const read = await call("GET", `/offers/${offer.id}`);
  cachedPresenter = (read.body as { presenter: string }).presenter;
  if (!cachedPresenter) throw new Error("setup failed: the offer view names no presenter");
  return cachedPresenter;
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
