import { describe, expect, test } from "bun:test";
import {
  call,
  CONFIG_VERSION_NARROW,
  CONFIG_VERSION_UNROOTED,
  conformingOffer,
  createConformingOffer,
  decide,
  floorFor,
  freshHousehold,
  offerBody,
  presenter,
  PRODUCTS,
  PRODUCTS_UNROOTED,
} from "../lib/probe.js";

/**
 * Clause 26 and specification §5.
 *
 * An offer below the exploration floor is refused with 422, no configuration
 * bypasses the check, and the rate cannot reach zero.
 *
 * The floor is the one place the constitution says an implementation must
 * refuse to do the profitable thing. Selling out is not a setting, so these
 * probes look for a way to reach it and expect not to find one.
 */

const countOf = async (household: string): Promise<number> => {
  const list = await call(
    "GET",
    `/offers?household=${encodeURIComponent(household)}&presenter=${encodeURIComponent(await presenter())}`
  );
  const body = list.body as { offers?: unknown[] };
  return body.offers?.length ?? 0;
};

describe("floor: refusal", () => {
  test("an offer with no exploration candidate is refused with 422", async () => {
    // NOTE (mutation check, 2026-09-08): no_floor disabled the check.
    // This and the three assertions below all failed with 201 instead of 422.
    const body = offerBody(
      PRODUCTS.slice(0, 3).map((product) => ({
        product,
        predicted_conversion: 0.9,
        is_exploration: false,
      }))
    );
    const created = await call("POST", "/offers", body);
    expect(created.status).toBe(422);
  });

  test("a single-candidate offer still needs one exploration candidate", async () => {
    // NOTE (mutation check, 2026-09-08): floor_off_by_one weakened the
    // comparison to `marked < required - 1`, which makes the floor zero for a
    // one-candidate offer. This assertion failed with 201.
    const body = offerBody([
      { product: PRODUCTS[0]!, predicted_conversion: 0.9, is_exploration: false },
    ]);
    const created = await call("POST", "/offers", body);
    expect(created.status).toBe(422);
  });

  test("the refusal names the floor rather than failing opaquely", async () => {
    // NOTE (mutation check, 2026-09-08): no_floor, which made the
    // endpoint return 201 with no message at all. A refusal a presenter
    // cannot read is one they will route around rather than satisfy.
    const body = offerBody(
      PRODUCTS.slice(0, 3).map((product) => ({
        product,
        predicted_conversion: 0.9,
        is_exploration: false,
      }))
    );
    const created = await call("POST", "/offers", body);
    expect(created.status).toBe(422);
    expect(created.text.toLowerCase()).toContain("exploration");
  });

  test("nothing is written when the floor refuses", async () => {
    // NOTE (mutation check, 2026-09-08): no_floor. The refused offer
    // appeared in the household's list, which this counted. A floor that
    // refuses the response but keeps the row has refused nothing.
    const household = freshHousehold();
    const before = await countOf(household);
    const body = offerBody(
      PRODUCTS.slice(0, 3).map((product) => ({
        product,
        predicted_conversion: 0.9,
        is_exploration: false,
      })),
      { household }
    );
    await call("POST", "/offers", body);
    expect(await countOf(household)).toBe(before);
  });
});

describe("floor: no bypass", () => {
  test("declaring the floor met in the request does not meet it", async () => {
    // NOTE (mutation check, 2026-09-08): floor_bypass_field accepted
    // `exploration_floor_met` from the request and skipped the check when it
    // was true. This assertion failed with 201.
    const body = offerBody(
      PRODUCTS.slice(0, 3).map((product) => ({
        product,
        predicted_conversion: 0.9,
        is_exploration: false,
      })),
      { exploration_floor_met: true }
    );
    const created = await call("POST", "/offers", body);
    expect([400, 422]).toContain(created.status);
  });

  test("a per-offer rate is not a field", async () => {
    // NOTE (mutation check, 2026-09-08): strict-drops-unknown made the
    // body check discard unknown fields. All four bypass shapes then returned
    // 201 and this assertion failed.
    for (const bypass of [
      { exploration_rate: 0 },
      { exploration: { rate: 0 } },
      { skip_exploration_floor: true },
      { floor: 0 },
    ]) {
      const created = await call("POST", "/offers", conformingOffer(bypass));
      expect([400, 422]).toContain(created.status);
    }
  });

  test("a header does not turn the check off", async () => {
    // NOTE (mutation check, 2026-09-08): no_floor. A header cannot be
    // read by a check that is not there, so this failed with the rest.
    const body = offerBody(
      PRODUCTS.slice(0, 3).map((product) => ({
        product,
        predicted_conversion: 0.9,
        is_exploration: false,
      }))
    );
    const created = await call("POST", "/offers", body, {
      "x-exploration-floor": "0",
      "x-valence-bypass": "exploration_floor",
    });
    expect(created.status).toBe(422);
  });
});

describe("floor: what qualifies", () => {
  test("exploration candidates are not concealed from the household (§5.4)", async () => {
    // NOTE (mutation check, 2026-09-08): hide_exploration dropped
    // `is_exploration` from the candidate serialisation. This assertion
    // failed: a household cannot decline what it cannot see is a guess.
    const created = await call("POST", "/offers", conformingOffer());
    expect(created.status).toBe(201);
    const offer = created.body as {
      candidates: { is_exploration: boolean }[];
    };
    expect(offer.candidates.some((c) => c.is_exploration === true)).toBe(true);
  });
});

describe("floor: the boundary", () => {
  /**
   * The formula in §5 is `max(1, ceil(n * rate))`, and both sides of it
   * matter. An implementation one short of the floor has removed the
   * household's freedom to decline; one that demands more than the floor has
   * quietly raised the rate above what the deployment declared, which is a
   * different way of taking the choice away from whoever set it.
   */
  const n = PRODUCTS.length;

  test("exactly the floor is accepted", async () => {
    // NOTE (mutation check, 2026-09-08): floor_too_strict tightened the
    // comparison to `marked <= required`. This assertion failed with 422.
    // The first version of this suite had no boundary probe and that mutation
    // survived it, which is why the two tests here exist.
    const required = floorFor(n);
    const body = offerBody(
      PRODUCTS.map((product, i) => ({
        product,
        predicted_conversion: i < required ? 0.05 : 0.9,
        is_exploration: i < required,
      }))
    );
    const created = await call("POST", "/offers", body);
    expect(created.status).toBe(201);
  });

  test("one short of the floor is refused", async () => {
    // NOTE (mutation check, 2026-09-09): floor_off_by_one, and this probe
    // catches it only when the suite runs at a rate above 0.5. At the default
    // 0.2 with five products the floor is one, and the probe returns early
    // because "one short" is zero, which the probes above already cover. It
    // was verified by running the whole suite at a rate of 0.6.
    // NOTE (mutation check, 2026-09-08): floor_off_by_one, run at a rate
    // of 0.6 so that the floor is above one and this probe does not skip.
    // This assertion failed with 201.
    const required = floorFor(n);
    if (required < 2) return; // the floor is one; zero is covered above
    const body = offerBody(
      PRODUCTS.map((product, i) => ({
        product,
        predicted_conversion: i < required - 1 ? 0.05 : 0.9,
        is_exploration: i < required - 1,
      }))
    );
    const created = await call("POST", "/offers", body);
    expect(created.status).toBe(422);
  });
});

describe("floor: what counts as novelty cannot be manufactured (§5)", () => {
  test("a product listed twice in one offer is refused", async () => {
    // NOTE (mutation check, 2026-09-09): allow_duplicate_products let a
    // product appear twice, so one never-offered product met a floor of two.
    // This assertion failed with 201. Quantity is what a line carries.
    const [a, b] = PRODUCTS;
    const created = await call("POST", "/offers", offerBody([
      { product: a!, predicted_conversion: 0.5, is_exploration: true },
      { product: a!, predicted_conversion: 0.5, is_exploration: true },
      { product: b!, predicted_conversion: 0.5, is_exploration: false },
    ]));
    expect(created.status).toBe(400);
  });

  test("a narrower catalogue does not shrink what the presenter still has to offer", async () => {
    // NOTE (mutation check, 2026-09-09): novelty_from_this_catalogue counted
    // what the presenter still has over the catalogue the offer named, so a
    // presenter that registered a two-product version after showing those
    // two owed no exploration. This assertion failed with 201.
    const household = freshHousehold();
    const [a, b] = PRODUCTS;
    const first = await call("POST", "/offers", offerBody(
      [
        { product: a!, predicted_conversion: 0.5, is_exploration: true },
        { product: b!, predicted_conversion: 0.5, is_exploration: true },
      ],
      { household }
    ));
    expect(first.status).toBe(201);
    await call("POST", `/offers/${(first.body as { id: string }).id}/present`, {});
    const trimmed = await call("POST", "/offers", offerBody(
      [
        { product: a!, predicted_conversion: 0.5, is_exploration: false },
        { product: b!, predicted_conversion: 0.5, is_exploration: false },
      ],
      { household, config_version: CONFIG_VERSION_NARROW }
    ));
    expect(trimmed.status).toBe(422);
    // The status alone cannot tell the two refusals apart. Measured 2026-09-09:
    // under `novelty_from_this_catalogue` the narrow catalogue has nothing left
    // to offer, so the engine refuses with `nothing_new` instead of the floor,
    // and a probe that checked only the code passed while the mutation stood.
    // What is being checked here is that the presenter still owes exploration
    // because its OTHER catalogues hold novelty, so the refusal must name the
    // floor.
    expect(trimmed.text.toLowerCase()).toContain("exploration");
  });
});

describe("floor: a presenter with nothing new makes no offer (§5)", () => {
  test("an offer to a household that has seen everything is refused", async () => {
    // NOTE (mutation check, 2026-09-09): floor_ignores_exhaustion lets the
    // offer through with no exploration, which is the sell-out a cap on the
    // floor would have licensed. This assertion failed with 201.
    // Clause 26's first sentence is only true if the floor does not bend to
    // what the presenter has left: a small catalogue would otherwise reach
    // "everything shown" once and sell to that household for ever after.
    const household = freshHousehold();
    const first = await call("POST", "/offers", conformingOffer({ household }));
    expect(first.status).toBe(201);
    await call("POST", `/offers/${(first.body as { id: string }).id}/present`, {});
    const second = await call(
      "POST",
      "/offers",
      offerBody(
        PRODUCTS.map((product) => ({ product, predicted_conversion: 0.5, is_exploration: false })),
        { household }
      )
    );
    expect(second.status).toBe(422);
    expect(second.text).toContain("nothing_new");
  });
});

describe("floor: the floor cannot be padded (§5.1)", () => {
  /**
   * The probe that matters most in this suite, and the one that was missing
   * from its first version.
   *
   * Refusing an offer that is short of the floor is worth nothing if the
   * count can be met by relabelling. A presenter marks the items it most
   * expects to be kept, the arithmetic passes, and clause 26 costs nothing.
   *
   * So the probe teaches the implementation that a product is known and
   * wanted, by having the household keep it, and then offers the same product
   * back as exploration with a high prediction.
   */
  test("a kept, well-predicted product cannot be marked as exploration", async () => {
    // NOTE (mutation check, 2026-09-10): pad_the_floor removes the
    // qualification check and leaves the count. This assertion failed with
    // 201, and it names the refusal so that the two 422s cannot be confused.
    //
    // The version before 2026-09-10 offered every product in the first offer,
    // which left the household with nothing novel at all, so the padded offer
    // was refused with `nothing_new` whatever the padding check did, and the
    // probe passed under the mutation for four days. Measured: pad_the_floor
    // failed no conformance probe and only the engine's own unit test.
    //
    // So the first offer teaches the household exactly one product and leaves
    // the rest novel. The padded offer then meets the count using only that
    // product, and a correct engine refuses it for the floor while an engine
    // that counts without qualifying accepts it.
    const known = PRODUCTS[0]!;
    const household = freshHousehold();
    const first = await call("POST", "/offers", offerBody(
      [{ product: known, predicted_conversion: 0.05, is_exploration: true }],
      { household }
    ));
    expect(first.status).toBe(201);
    const offer = first.body as { id: string; candidates: { id: string }[] };
    await call("POST", `/offers/${offer.id}/present`, {});
    const decided = await decide(offer.id, {
      decisions: [{ candidate: offer.candidates[0]!.id, valence: "kept", kept_as: "self" }],
    });
    expect(decided.status).toBe(200);

    // `known` has been offered to this household, so under §5.1 it is not
    // exploration whatever the prediction. The other products still are, so
    // the presenter has something new and `nothing_new` cannot fire: the only
    // reason left to refuse is the floor.
    const required = floorFor(PRODUCTS.length);
    const padded = offerBody(
      PRODUCTS.map((product) => ({
        product,
        predicted_conversion: product === known ? 0.95 : 0.9,
        is_exploration: product === known,
      })),
      { household }
    );
    const refused = await call("POST", "/offers", padded);
    expect(required).toBe(1); // the construction above marks exactly one
    expect(refused.status).toBe(422);
    expect(refused.text.toLowerCase()).toContain("exploration");
  });
});

describe("floor: a presenter is a key, not a name (§5.2)", () => {
  /**
   * The floor counts what this presenter has offered this household, so what
   * a presenter is decides what the floor is worth. An adversarial pass on
   * 2026-09-09 renamed one and watched a household's history disappear.
   */
  test("a catalogue is refused unless the presenter it names signed it", async () => {
    // NOTE (mutation check, 2026-09-09): unsigned_catalogue accepted one
    // without a signature. This assertion failed with 201: anybody could
    // publish catalogues under anybody's name, and a fresh name is a fresh
    // household history.
    const unsigned = await call("POST", "/_presenter/configs", {
      version: `cfg-unsigned-${Math.random().toString(36).slice(2, 8)}`,
      presenter: await presenter(),
      products: {
        "probe-a": { merchant: "maker-a", ships: "carrier-a", price: 100 },
      },
    });
    expect([400, 422]).toContain(unsigned.status);
  });

  test("an offer says whether a root endorsed the presenter", async () => {
    // NOTE (mutation check, 2026-09-09): presenter_always_attested said yes
    // for every presenter. This assertion failed: the deployment's second
    // presenter is registered and not root-endorsed, which is what a rename
    // looks like from outside, and a household is entitled to see it.
    const rooted = await createConformingOffer();
    const readRooted = await call("GET", `/offers/${rooted.id}`);
    expect(readRooted.status).toBe(200);
    expect((readRooted.body as { presenter_attested: boolean }).presenter_attested).toBe(true);

    const other = await call("POST", "/offers", offerBody(
      PRODUCTS_UNROOTED.map((product, i) => ({
        product,
        predicted_conversion: 0.5,
        is_exploration: i === 0,
      })),
      { household: freshHousehold(), config_version: CONFIG_VERSION_UNROOTED }
    ));
    expect(other.status).toBe(201);
    expect((other.body as { presenter_attested: boolean }).presenter_attested).toBe(false);
  });
});
