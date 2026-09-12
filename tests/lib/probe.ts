import { createPrivateKey, sign, createHash, type KeyObject } from "node:crypto";
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
/** §5. A narrower catalogue under the same presenter, for the trimming probe. */
export const CONFIG_VERSION_NARROW = required("VALENCE_CONFIG_VERSION_NARROW");
/**
 * §5.2. A catalogue of a presenter whose key no identity root endorsed, which
 * is what a rename looks like from outside: a second identity, visibly not
 * the same one.
 */
export const CONFIG_VERSION_UNROOTED = required("VALENCE_CONFIG_VERSION_UNROOTED");
export const PRODUCTS_UNROOTED = required("VALENCE_PRODUCTS_UNROOTED")
  .split(",")
  .map((p) => p.trim())
  .filter(Boolean);
export const HOUSEHOLD = required("VALENCE_HOUSEHOLD");

/**
 * §10a. A product in `VALENCE_CONFIG_VERSION` whose merchant has registered no
 * disclosure, so that the refusal can be reached. A deployment that has one
 * for every merchant cannot show a probe what happens when one is missing,
 * which is the requirement with the consequence.
 */
export const PRODUCT_UNDISCLOSED = required("VALENCE_PRODUCT_UNDISCLOSED");

/**
 * §10a. The block the merchant of `VALENCE_PRODUCTS` composed, as it was
 * registered. The probes compare what an offer carries against this, because
 * the requirement is that it is returned **as composed**: a probe that only
 * checked the field was present would pass an implementation that reordered
 * the items, summarised them, or translated them.
 */
export const DISCLOSURE: {
  merchant: string;
  version: string;
  items: { label: string; value: string }[];
  signature: string;
} = (() => {
  const raw = required("VALENCE_DISCLOSURE");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("VALENCE_DISCLOSURE is not valid JSON");
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("VALENCE_DISCLOSURE must be a JSON object");
  }
  const d = parsed as Record<string, unknown>;
  for (const key of ["merchant", "version", "signature"]) {
    if (typeof d[key] !== "string" || d[key] === "") {
      throw new Error(`VALENCE_DISCLOSURE is missing ${key}`);
    }
  }
  if (!Array.isArray(d.items) || d.items.length === 0) {
    throw new Error("VALENCE_DISCLOSURE needs at least one item");
  }
  return d as never;
})();

/**
 * A household nobody has offered anything to. Since 2026-09-09 exploration
 * is what a household has never been offered by this presenter (clause 26,
 * §5.1), so an offer marking every product as exploration is conforming only
 * for a household that has seen none of them. Offers default to a fresh one;
 * a probe that needs the same household twice names it.
 */
export function freshHousehold(): string {
  return `${HOUSEHOLD}-${Math.random().toString(36).slice(2, 10)}`;
}
export const MANDATE = required("VALENCE_MANDATE");

/**
 * Clause 35. The private half of the key registered for the mandate, base64
 * of a PKCS#8 PEM. The probes confirm with it; an implementation that
 * settles on an unsigned confirmation, or on a set other than the one
 * signed, is caught in approval/.
 */
const MANDATE_KEY = (() => {
  const raw = required("VALENCE_MANDATE_KEY");
  try {
    return createPrivateKey(Buffer.from(raw, "base64").toString("utf8"));
  } catch {
    throw new Error("VALENCE_MANDATE_KEY must be the base64 of a PKCS#8 PEM");
  }
})();

/**
 * §16. The mandate this deployment seeded, and the private half of its one
 * co-signer's key, so the probes can sign a change and see which signatures
 * a loosening needs.
 */
export const MANDATE_STATE: {
  id: string;
  household: string;
  ceiling_out_of_network: number;
  co_signers: string[];
  lapses_at: number;
  version: number;
  co_signer_key: string;
} = (() => {
  const raw = required("VALENCE_MANDATE_STATE");
  try {
    return JSON.parse(Buffer.from(raw, "base64").toString("utf8"));
  } catch {
    throw new Error("VALENCE_MANDATE_STATE is not base64 of a JSON object");
  }
})();

export const CO_SIGNER_KEY = createPrivateKey(
  Buffer.from(MANDATE_STATE.co_signer_key, "base64").toString("utf8")
);

/** §16.1. The bytes a mandate version is signed over. */
export function canonicalMandate(m: {
  id: string;
  household: string;
  ceiling_out_of_network: number;
  ceiling_daily?: number | null;
  cooling_seconds?: number | null;
  co_signers: string[];
  lapses_at: number;
  version: number;
}): Buffer {
  return Buffer.from(
    [
      m.id,
      m.household,
      String(m.ceiling_out_of_network),
      // §16. The three protections of 2026-09-10 sit in the record's order.
      // Absent is not zero: an empty line is no ceiling and no cooling.
      m.ceiling_daily === undefined || m.ceiling_daily === null
        ? ""
        : String(m.ceiling_daily),
      // Each item escaped before the join, as §16.1 now requires: a plain
      // comma join made ["coffee","tea"] and ["coffee,tea"] the same bytes.
      m.cooling_seconds === undefined || m.cooling_seconds === null
        ? ""
        : String(m.cooling_seconds),
      [...m.co_signers].sort().map(encodeURIComponent).join(","),
      String(m.lapses_at),
      String(m.version),
    ].join("\n"),
    "utf8"
  );
}

/** Signed by the household, and by the co-signer when `withCoSigner`. */
export function signMandate(
  m: Parameters<typeof canonicalMandate>[0],
  withCoSigner: boolean
): Record<string, string> {
  const bytes = canonicalMandate(m);
  const out: Record<string, string> = {
    [m.household]: sign(null, bytes, MANDATE_KEY).toString("base64"),
  };
  if (withCoSigner) {
    for (const k of MANDATE_STATE.co_signers) {
      out[k] = sign(null, bytes, CO_SIGNER_KEY).toString("base64");
    }
  }
  return out;
}

/**
 * §16.1. What a member's device sends where the specification asks the person
 * to sign a mandate: an assertion whose challenge is the mandate's canonical
 * bytes. The suite builds it rather than asking for an authenticator, as
 * `assertDecisions` does and for the same reason.
 *
 * A passkey cannot sign bytes a caller hands it, which is why this exists at
 * all: without it a member who holds one could record no protection.
 */
export function assertMandate(
  m: Parameters<typeof canonicalMandate>[0],
  options: { key?: KeyObject; relyingParty?: string } = {}
) {
  const { key = MANDATE_KEY, relyingParty = RP_ID } = options;
  const challenge = createHash("sha256").update(canonicalMandate(m)).digest("base64url");
  const authenticatorData = Buffer.concat([
    createHash("sha256").update(relyingParty).digest(),
    Buffer.from([0x05]),
    Buffer.from([0, 0, 0, 1]),
  ]);
  const clientDataJson = Buffer.from(
    JSON.stringify({ type: "webauthn.get", challenge, origin: `https://${relyingParty}` }),
    "utf8"
  );
  const signed = Buffer.concat([
    authenticatorData,
    createHash("sha256").update(clientDataJson).digest(),
  ]);
  return {
    authenticator_data: authenticatorData.toString("base64"),
    client_data_json: clientDataJson.toString("base64"),
    signature: sign(key.asymmetricKeyType === "ed25519" ? null : "sha256", signed, key).toString("base64"),
  };
}

export type DecisionSpec = {
  candidate: string;
  valence: string;
  kept_as?: string;
  lineage?: string;
};

/**
 * Specification §10.5. The decided set in the shape that is signed: the
 * offer id, then one line per decision in ascending candidate id, each
 * `candidate:valence:kept_as:lineage` with empty strings for what is absent.
 */
export function canonicalDecisions(offerId: string, decisions: DecisionSpec[]): Buffer {
  const lines = [...decisions]
    .sort((a, b) => (a.candidate < b.candidate ? -1 : a.candidate > b.candidate ? 1 : 0))
    .map((d) => `${d.candidate}:${d.valence}:${d.kept_as ?? ""}:${d.lineage ?? ""}`);
  return Buffer.from([offerId, ...lines].join("\n"), "utf8");
}

export function signDecisions(offerId: string, decisions: DecisionSpec[]): string {
  return sign(null, canonicalDecisions(offerId, decisions), MANDATE_KEY).toString("base64");
}

/**
 * §14b. The relying party this deployment accepts assertions for: the name a
 * member's device signs for, which is the hub's own. A deployment that names
 * none cannot tell whom an assertion was made for, and the specification has
 * it refuse the shape rather than guess.
 */
export const RP_ID = required("VALENCE_RP_ID");

/**
 * §10.5. What a member's device sends: an authenticator's assertion, whose
 * challenge is the decided set. The suite builds it rather than asking for a
 * device, because a suite that needed a real authenticator could not run
 * anywhere.
 *
 * The authenticator data is in the shape WebAuthn §6.1 gives it, because an
 * implementation reads the flags out of it: the SHA-256 of a relying party
 * id, one byte of flags and a counter. `present` and `verified` are what the
 * flags say, and a real device sets both when a person confirms. The hash is
 * of the name the deployment declared (§14b), because an implementation
 * compares it. `key` is the
 * private half of whatever key the offer's mandate was registered with; the
 * fixture's is ed25519, and a probe that registered a P-256 key passes its
 * own.
 */
export function assertDecisions(
  offerId: string,
  decisions: DecisionSpec[],
  options: {
    ceremony?: "webauthn.get" | "webauthn.create";
    present?: boolean;
    verified?: boolean;
    key?: KeyObject;
    relyingParty?: string;
  } = {}
) {
  const {
    ceremony = "webauthn.get",
    present = true,
    verified = true,
    key = MANDATE_KEY,
    relyingParty = RP_ID,
  } = options;
  const challenge = createHash("sha256")
    .update(canonicalDecisions(offerId, decisions))
    .digest("base64url");
  const flags = (present ? 0x01 : 0) | (verified ? 0x04 : 0);
  const authenticatorData = Buffer.concat([
    createHash("sha256").update(relyingParty).digest(),
    Buffer.from([flags]),
    Buffer.from([0, 0, 0, 1]),
  ]);
  const clientDataJson = Buffer.from(
    JSON.stringify({ type: ceremony, challenge, origin: `https://${relyingParty}` }),
    "utf8"
  );
  const signed = Buffer.concat([
    authenticatorData,
    createHash("sha256").update(clientDataJson).digest(),
  ]);
  return {
    authenticator_data: authenticatorData.toString("base64"),
    client_data_json: clientDataJson.toString("base64"),
    // ed25519 signs the bytes as they are; a P-256 key signs their SHA-256.
    signature: sign(key.asymmetricKeyType === "ed25519" ? null : "sha256", signed, key).toString("base64"),
  };
}

export function coSignDecisions(offerId: string, decisions: DecisionSpec[]): string {
  return sign(null, canonicalDecisions(offerId, decisions), CO_SIGNER_KEY).toString("base64");
}

/**
 * Post a decided set, signed as the mandate. `body` is what the probe would
 * have sent; the signature is added over `body.decisions` when it is a list.
 */
export async function decide(
  offerId: string,
  body: Record<string, unknown>,
  headers: Record<string, string> = {}
): Promise<Probe> {
  const decisions = body.decisions;
  const signed = Array.isArray(decisions)
    ? { ...body, signature: signDecisions(offerId, decisions as DecisionSpec[]) }
    : body;
  return call("POST", `/offers/${offerId}/decisions`, signed, headers);
}
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
  for (const key of ["from", "to", "product", "merchant", "maker", "kind", "signature"]) {
    if (typeof edge[key] !== "string" || edge[key] === "") {
      throw new Error(`VALENCE_LINEAGE_EDGE is missing ${key}`);
    }
  }
  return edge;
})();

export const LINEAGE_RECIPIENT = LINEAGE_EDGE.to as string;

/**
 * §7.1. A well-formed edge signed with a key no identity root endorsed. It is
 * accepted and recorded, it shows as unattested, and it makes nothing known
 * to the household it names.
 */
export const UNATTESTED_EDGE: Record<string, unknown> = (() => {
  const raw = required("VALENCE_UNATTESTED_EDGE");
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (typeof parsed !== "object" || parsed === null) throw new Error("not an object");
    return parsed;
  } catch {
    throw new Error("VALENCE_UNATTESTED_EDGE is not a JSON object");
  }
})();

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
 * Who made each product, as the deployment declares it, in the same shape as
 * `VALENCE_PRICES`.
 *
 * **This exists because presence is not the assertion.** Clause 12 asks that a
 * candidate name who made it, and a probe that only checks the field is a
 * non-empty string passes an implementation that fills it with the merchant's
 * own name, which is what the specification did until 2026-09-12. Measured the
 * same day: `maker_is_the_merchant` survived the first probe written for it.
 *
 * A deployment whose merchant makes everything it sells declares the merchant
 * here and the probe is satisfied, which is correct: the two parties are the
 * same for that shop. What the probe refuses is an implementation that answers
 * with a party the catalogue did not name.
 */
export const MAKERS: Record<string, string> = (() => {
  const raw = required("VALENCE_MAKERS");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("VALENCE_MAKERS is not valid JSON");
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("VALENCE_MAKERS must be a JSON object of product to maker");
  }
  const makers = parsed as Record<string, unknown>;
  for (const [ref, maker] of Object.entries(makers)) {
    if (typeof maker !== "string" || maker === "") {
      throw new Error(`VALENCE_MAKERS: ${ref} is not a non-empty string`);
    }
  }
  return makers as Record<string, string>;
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
 * Clause 52 says a member can move an entire node to another host. Checking
 * that against one host can only ask whether a file was produced, which is the
 * weakest possible reading of clause 43. With two, the question becomes whether
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
    household: freshHousehold(),
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
    // Clause 23. A ceremonial offer carries the band the giver chose; the
    // default band spans every declared price so the probes that are not
    // about the band are not refused by it.
    ...(overrides.purpose === "ceremonial" && overrides.price_band === undefined
      ? { price_band: { min: Math.min(...Object.values(PRICES)), max: Math.max(...Object.values(PRICES)) } }
      : {}),
    // Clause 25, §12. A ceremonial offer names its giver, who pays; the
    // household on the offer is the recipient, who chooses.
    ...(overrides.purpose === "ceremonial" && overrides.giver === undefined
      ? { giver: `${HOUSEHOLD}-giver` }
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
 * conforming implementation has to say it (clause 36's `hide_presenter`).
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
