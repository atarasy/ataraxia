import { describe, expect, test } from "bun:test";
import { call, conformingOffer, HAS_PHYSICAL } from "../lib/probe.js";

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
