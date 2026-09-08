import { describe, expect, test } from "bun:test";
import {
  call,
  conformingOffer,
  decide,
  floorFor,
  freshHousehold,
  offerBody,
  presenter,
  PRODUCTS,
} from "../lib/probe.js";

/**
 * Clause 30 and specification §5.
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
  test("exploration candidates are not concealed from the household (§5.3)", async () => {
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

describe("floor: the floor asks for what exists (§5)", () => {
  test("a presenter that has offered a household everything owes it no exploration", async () => {
    // NOTE (mutation check, 2026-09-09): floor_ignores_exhaustion dropped
    // the cap on the floor, so a second offer to a household that had seen
    // every product was refused for lacking exploration it could not have.
    // This assertion failed with 422.
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
    expect(second.status).toBe(201);
  });
});

describe("floor: the floor cannot be padded (§5.1)", () => {
  /**
   * The probe that matters most in this suite, and the one that was missing
   * from its first version.
   *
   * Refusing an offer that is short of the floor is worth nothing if the
   * count can be met by relabelling. A presenter marks the items it most
   * expects to be kept, the arithmetic passes, and clause 30 costs nothing.
   *
   * So the probe teaches the implementation that a product is known and
   * wanted, by having the household keep it, and then offers the same product
   * back as exploration with a high prediction.
   */
  test("a kept, well-predicted product cannot be marked as exploration", async () => {
    // NOTE (mutation check, 2026-09-08): pad_the_floor removed the
    // qualification check from the reference engine, leaving the count. This
    // assertion failed with 201: an offer of two products the household had
    // already kept, both marked exploration, was accepted.
    // Built to meet the floor at whatever rate the deployment runs, because
    // the earlier two-candidate version was refused for the floor rather than
    // for padding once the rate went above 0.5, and the probe then failed on
    // its own setup.
    const known = PRODUCTS[0]!;
    const required = floorFor(PRODUCTS.length);
    const household = freshHousehold();
    const first = offerBody(
      PRODUCTS.map((product, i) => ({
        product,
        predicted_conversion: i < required ? 0.05 : 0.9,
        is_exploration: i < required,
      })),
      { household }
    );
    const created = await call("POST", "/offers", first);
    expect(created.status).toBe(201);
    const offer = created.body as { id: string; candidates: { id: string }[] };
    await call("POST", `/offers/${offer.id}/present`, {});
    const decided = await decide(offer.id, {
      decisions: offer.candidates.map((c, i) => ({
        candidate: c.id,
        valence: i === 0 ? "kept" : "returned",
        ...(i === 0 ? { kept_as: "self" } : {}),
      })),
    });
    expect(decided.status).toBe(200);

    // The same product offered back as exploration. It has been offered to
    // this household before, so under §5.1 it is not exploration whatever the
    // prediction, and the count is met, so an implementation that checks only
    // the count accepts it.
    const padded = offerBody(
      PRODUCTS.map((product, i) => ({
        product,
        predicted_conversion: product === known ? 0.95 : i < required ? 0.05 : 0.9,
        is_exploration: i < required,
      })),
      { household }
    );
    const refused = await call("POST", "/offers", padded);
    expect(refused.status).toBe(422);
  });
});
