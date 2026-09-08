import { describe, expect, test } from "bun:test";
import { call, conformingOffer, HAS_PHYSICAL, PRICES } from "../lib/probe.js";

/**
 * Specification §3.2 and §11, and §13 condition 8.
 *
 * A household is never billed for goods that were lost, and `consumed` is
 * charged at cost rather than at price.
 *
 * Both valences exist only in the physical binding, so an implementation that
 * offers the digital binding alone cannot fail them: it holds no goods to
 * lose. That is a real answer rather than an untested one, and the deployment
 * says which case it is in `VALENCE_BINDINGS`.
 */

const physicalOffer = (overrides: Record<string, unknown> = {}) =>
  conformingOffer({ binding: "physical", ...overrides });

describe("binding: what the deployment implements", () => {
  test("the declared bindings are what the endpoint accepts", async () => {
    // NOTE (mutation check, 2026-09-09): refuse_the_physical_binding
    // refused a physical offer while the deployment declared it. The probe
    // exists so that a fixture cannot claim a binding the implementation
    // does not accept, or hide one it does. This assertion failed.
    // A deployment that declares the physical binding and refuses it, or
    // refuses to declare one it accepts, has made the rest of this file
    // meaningless in either direction.
    const created = await call("POST", "/offers", physicalOffer());
    if (HAS_PHYSICAL) {
      expect(created.status).toBe(201);
    } else {
      expect([400, 422]).toContain(created.status);
    }
  });
});

describe.if(HAS_PHYSICAL)("binding: lost is not billed to the household (§3.2)", () => {
  test("a lost candidate is reported and is not charged", async () => {
    // NOTE (mutation check, 2026-09-08): bill_the_household_for_lost added
    // lost_amount into the charged total. This assertion failed. The trust
    // model is the point of clause 30's neighbouring rule here: loss falls on
    // whoever holds stock risk, and a loss rate is an operating metric rather
    // than a receivable.
    const created = await call("POST", "/offers", physicalOffer());
    expect(created.status).toBe(201);
    const offer = created.body as {
      id: string;
      candidates: { id: string; product: string; unit_price: number }[];
    };
    await call("POST", `/offers/${offer.id}/present`, {});

    const [first, ...rest] = offer.candidates;
    await call("POST", `/offers/${offer.id}/decisions`, {
      decisions: [
        { candidate: first!.id, valence: "lost" },
        ...rest.map((c) => ({ candidate: c.id, valence: "returned" })),
      ],
    });

    const settled = await call("POST", `/offers/${offer.id}/settle`, {});
    expect(settled.status).toBe(200);
    const settlement = settled.body as {
      kept_amount: number;
      consumed_amount: number;
      lost_amount: number;
    };
    expect(settlement.lost_amount).toBe(first!.unit_price);
    expect(settlement.kept_amount).toBe(0);
    expect(settlement.consumed_amount).toBe(0);
    // The breakdown is not the bill. The first version of this probe checked
    // only the three amounts, and an implementation that added lost_amount to
    // what the ledger committed passed it, because everything it reported was
    // true.
    expect((settlement as { charged: number }).charged).toBe(0);
  });

  test("what is charged is the breakdown and nothing else", async () => {
    // NOTE (mutation check, 2026-09-08): bill_the_household_for_lost added
    // lost_amount to the committed total. The probe above did not catch it and
    // this one does, which is why §6 of the specification now names the
    // charged amount rather than leaving it implied by three others.
    const created = await call("POST", "/offers", physicalOffer());
    const offer = created.body as { id: string; candidates: { id: string }[] };
    await call("POST", `/offers/${offer.id}/present`, {});
    const [first, second, ...rest] = offer.candidates;
    await call("POST", `/offers/${offer.id}/decisions`, {
      decisions: [
        { candidate: first!.id, valence: "kept", kept_as: "self" },
        { candidate: second!.id, valence: "lost" },
        ...rest.map((c) => ({ candidate: c.id, valence: "returned" })),
      ],
    });
    const settled = await call("POST", `/offers/${offer.id}/settle`, {});
    expect(settled.status).toBe(200);
    const amounts = settled.body as {
      kept_amount: number;
      consumed_amount: number;
      lost_amount: number;
      charged: number;
    };
    expect(amounts.charged).toBe(amounts.kept_amount + amounts.consumed_amount);
    expect(amounts.lost_amount).toBeGreaterThan(0);
  });

  test("consumed is charged at cost, below the price the household was shown", async () => {
    // NOTE (mutation check, 2026-09-08): consumed_at_price settled a consumed
    // candidate at unit_price. This assertion failed. §6.2 exists so that
    // trying is neither free nor full price, and charging the price makes
    // trying the same as buying.
    const created = await call("POST", "/offers", physicalOffer());
    const offer = created.body as {
      id: string;
      candidates: { id: string; product: string; unit_price: number }[];
    };
    await call("POST", `/offers/${offer.id}/present`, {});

    const [first, ...rest] = offer.candidates;
    await call("POST", `/offers/${offer.id}/decisions`, {
      decisions: [
        { candidate: first!.id, valence: "consumed" },
        ...rest.map((c) => ({ candidate: c.id, valence: "returned" })),
      ],
    });

    const settled = await call("POST", `/offers/${offer.id}/settle`, {});
    const settlement = settled.body as {
      kept_amount: number;
      consumed_amount: number;
    };
    expect(settlement.kept_amount).toBe(0);
    expect(settlement.consumed_amount).toBeGreaterThan(0);
    expect(settlement.consumed_amount).toBeLessThan(first!.unit_price);
  });

  test("the cost basis is never returned to the household", async () => {
    // NOTE (mutation check, 2026-09-09): cost_on_candidate put a cost on
    // every candidate in the offer view. A household that can read the
    // cost basis can read the merchant's margin on every line. This
    // assertion failed.
    // §6.2 records the cost basis on the presenter's side. A household that
    // can read it can read the merchant's margin on every line.
    const created = await call("POST", "/offers", physicalOffer());
    const offer = created.body as { id: string };
    const read = await call("GET", `/offers/${offer.id}`);
    const text = read.text.toLowerCase();
    for (const word of ['"cost"', '"unit_cost"', '"margin"', '"cost_basis"']) {
      expect(text).not.toContain(word);
    }
  });
});

describe.if(!HAS_PHYSICAL)("binding: the physical binding is absent", () => {
  test("consumed and lost cannot be reached from the digital binding", async () => {
    // NOTE (no mutation, 2026-09-09): this probe has never been shown to fail,
    // and it cannot be against the reference engine, which implements the
    // physical binding. It runs only where a deployment declares the digital
    // binding alone, and a fixture that declared that falsely is caught by the
    // probe above rather than reaching this one. It is counted as unproven.
    const created = await call("POST", "/offers", conformingOffer());
    const offer = created.body as { id: string; candidates: { id: string }[] };
    await call("POST", `/offers/${offer.id}/present`, {});
    for (const valence of ["consumed", "lost"]) {
      const decided = await call("POST", `/offers/${offer.id}/decisions`, {
        decisions: [{ candidate: offer.candidates[0]!.id, valence }],
      });
      expect([400, 422]).toContain(decided.status);
    }
  });
});

describe.if(HAS_PHYSICAL)("binding: a trial creates no balance (§6.1)", () => {
  /**
   * The positive half of §6.1, and the last part of §13 condition 5 that was
   * not checked. The negative half, that no route returns a balance, is in
   * `absence/`. This is the half that asks whether one accrued anyway.
   *
   * §6.1 permits two settlements for a trial that precedes a purchase:
   * deduct it from the eventual charge, or charge cost for what was consumed
   * and nothing else. What it forbids is the third, holding the value as a
   * balance the household can spend later, because that is a prepaid payment
   * instrument.
   */
  test("what was consumed is charged once, and nothing carries forward", async () => {
    // NOTE (mutation check, 2026-09-09): credit_the_trial accrued the consumed
    // cost against the household and took it off the next settlement. This
    // assertion failed on the second charge. A balance that is only ever spent
    // down is still a balance.
    const first = await call("POST", "/offers", physicalOffer());
    expect(first.status).toBe(201);
    const one = first.body as {
      id: string;
      candidates: { id: string; unit_price: number }[];
    };
    await call("POST", `/offers/${one.id}/present`, {});
    const [tried, ...others] = one.candidates;
    await call("POST", `/offers/${one.id}/decisions`, {
      decisions: [
        { candidate: tried!.id, valence: "consumed" },
        ...others.map((c) => ({ candidate: c.id, valence: "returned" })),
      ],
    });
    const trial = await call("POST", `/offers/${one.id}/settle`, {});
    const trialCharge = (trial.body as { charged: number }).charged;
    expect(trialCharge).toBeGreaterThan(0);

    // A second offer to the same household, kept in full.
    const second = await call("POST", "/offers", physicalOffer());
    const two = second.body as {
      id: string;
      candidates: { id: string; unit_price: number; quantity: number }[];
    };
    await call("POST", `/offers/${two.id}/present`, {});
    await call("POST", `/offers/${two.id}/decisions`, {
      decisions: two.candidates.map((c) => ({
        candidate: c.id,
        valence: "kept",
        kept_as: "self",
      })),
    });
    const purchase = await call("POST", `/offers/${two.id}/settle`, {});
    const amounts = purchase.body as { charged: number; kept_amount: number };

    const full = two.candidates.reduce(
      (sum, c) => sum + c.unit_price * c.quantity,
      0
    );
    // The full price of what was kept, with nothing taken off for the trial.
    expect(amounts.kept_amount).toBe(full);
    expect(amounts.charged).toBe(full);
  });

  test("the price a household is shown does not move after a trial", async () => {
    // NOTE (mutation check, 2026-09-09): discount_after_trial shaved a
    // tenth off the price for a household that had consumed something. A
    // discount is a discount whatever it is called, and clause 32 says
    // there are none. This assertion failed.
    // The other shape the same defect takes. Instead of a balance, the
    // discount arrives as a lower price on the next offer, which clause 10
    // forbids from the other direction and clause 32 forbids by name.
    const created = await call("POST", "/offers", physicalOffer());
    const offer = created.body as {
      candidates: { product: string; unit_price: number }[];
    };
    for (const candidate of offer.candidates) {
      expect(candidate.unit_price).toBe(PRICES[candidate.product]);
    }
  });
});
