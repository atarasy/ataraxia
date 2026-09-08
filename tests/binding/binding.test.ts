import { describe, expect, test } from "bun:test";
import {
  call,
  conformingOffer,
  decide,
  freshHousehold,
  HAS_PHYSICAL,
  PRICES,
  PRODUCTS,
  RECOVERY_GRACE_DAYS,
  sleep,
  soon,
} from "../lib/probe.js";

/**
 * Specification §3.2 and §11, and §13 condition 8.
 *
 * A household is never billed for goods that were lost, and `consumed` is
 * a gift is never billed and anything else used is bought at the price.
 *
 * Both valences exist only in the physical binding, so an implementation that
 * offers the digital binding alone cannot fail them: it holds no goods to
 * lose. That is a real answer rather than an untested one, and the deployment
 * says which case it is in `VALENCE_BINDINGS`.
 */

// Short enough to wait for in a probe; the deployment declares its grace.
const EXPIRY_MS = 1500;
const GRACE_MS = RECOVERY_GRACE_DAYS * 86_400_000;

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
    // §11. Lost is what the deadline decides about goods nobody collected.
    // Since 2026-09-09 no household or presenter can declare it: the offer
    // expires, the grace period passes with no collection, and the goods
    // are lost. The refutation pass found the earlier version of this probe
    // signing "lost" as the household, which is the hole it now checks.
    const created = await call("POST", "/offers", physicalOffer({ expires_at: soon(EXPIRY_MS) }));
    expect(created.status).toBe(201);
    const offer = created.body as {
      id: string;
      candidates: { id: string; product: string; unit_price: number }[];
    };
    await call("POST", `/offers/${offer.id}/present`, {});
    await sleep(EXPIRY_MS + GRACE_MS + 500);

    const settled = await call("POST", `/offers/${offer.id}/settle`, {});
    expect(settled.status).toBe(200);
    const settlement = settled.body as {
      kept_amount: number;
      consumed_amount: number;
      lost_amount: number;
    };
    const everything = offer.candidates.reduce((sum, c) => sum + c.unit_price, 0);
    expect(settlement.lost_amount).toBe(everything);
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
    const created = await call("POST", "/offers", physicalOffer({ expires_at: soon(EXPIRY_MS) }));
    const offer = created.body as { id: string; candidates: { id: string }[] };
    await call("POST", `/offers/${offer.id}/present`, {});
    const [first, second, ...rest] = offer.candidates;
    // The household keeps one and leaves the rest; the second is never
    // collected and the deadline makes it lost.
    await decide(offer.id, {
      decisions: [
        { candidate: first!.id, valence: "kept", kept_as: "self" },
        ...rest.map((c) => ({ candidate: c.id, valence: "returned" })),
      ],
    });
    void second;
    await sleep(EXPIRY_MS + GRACE_MS + 500);
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

  test("what was used and was not given is charged at the merchant's price", async () => {
    // NOTE (mutation check, 2026-09-09): consumed_at_a_fraction settled a
    // used candidate at a fraction of the price, which is the cost basis
    // returning under another name. This assertion failed.
    // §6.2, clause 10. Two bases and no third: a gift is never billed to
    // its recipient, and anything else used is bought at the price shown.
    const created = await call("POST", "/offers", physicalOffer());
    const offer = created.body as {
      id: string;
      candidates: { id: string; product: string; unit_price: number }[];
    };
    await call("POST", `/offers/${offer.id}/present`, {});

    // §11. Consumed is what the collection found, not a verdict.
    const [first, ...rest] = offer.candidates;
    const collected = await call("POST", `/offers/${offer.id}/recovery`, {
      returned: rest.map((c) => c.id),
      consumed: [first!.id],
    });
    expect(collected.status).toBe(200);

    const settled = await call("POST", `/offers/${offer.id}/settle`, {});
    const settlement = settled.body as {
      kept_amount: number;
      consumed_amount: number;
      charged: number;
    };
    expect(settlement.kept_amount).toBe(0);
    expect(settlement.consumed_amount).toBe(first!.unit_price);
    expect(settlement.charged).toBe(first!.unit_price);
  });

  test("a gift is never billed to the person who received it", async () => {
    // NOTE (mutation check, 2026-09-09): gift_is_billed settled a used gift
    // at the merchant's price. This assertion failed. What a maker, a
    // merchant or a friend gave is a gift; what the giver spends is settled
    // with the merchant in flow C, where the recipient never sees it.
    const body = physicalOffer();
    const list = body.candidates as Record<string, unknown>[];
    list[0]!.given_by = "maker-a";
    const created = await call("POST", "/offers", body);
    expect(created.status).toBe(201);
    const offer = created.body as {
      id: string;
      candidates: { id: string; given_by: string | null; unit_price: number }[];
    };
    expect(offer.candidates[0]!.given_by).toBe("maker-a");
    await call("POST", `/offers/${offer.id}/present`, {});
    const [gift, ...rest] = offer.candidates;
    await call("POST", `/offers/${offer.id}/recovery`, {
      returned: rest.map((c) => c.id),
      consumed: [gift!.id],
    });
    const settled = await call("POST", `/offers/${offer.id}/settle`, {});
    const settlement = settled.body as { consumed_amount: number; charged: number };
    expect(settlement.consumed_amount).toBe(0);
    expect(settlement.charged).toBe(0);
  });

  test("no cost of goods appears anywhere a household can read", async () => {
    // NOTE (mutation check, 2026-09-09): cost_on_candidate puts a cost on
    // every candidate in the offer view. This assertion fails, and since
    // 2026-09-09 there is no cost field in the catalogue for it to copy:
    // clause 10 says no cost of goods is ever quoted to a person.
    const created = await call("POST", "/offers", physicalOffer());
    const offer = created.body as { id: string; candidates: { id: string }[] };
    await call("POST", `/offers/${offer.id}/present`, {});
    const [first, ...rest] = offer.candidates;
    await call("POST", `/offers/${offer.id}/recovery`, {
      returned: rest.map((c) => c.id),
      consumed: [first!.id],
    });
    const settled = await call("POST", `/offers/${offer.id}/settle`, {});
    for (const read of [await call("GET", `/offers/${offer.id}`), settled]) {
      const text = read.text.toLowerCase();
      for (const word of ['"cost"', '"unit_cost"', '"margin"', '"cost_basis"', '"wholesale"']) {
        expect(text).not.toContain(word);
      }
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
      const decided = await decide(offer.id, {
        decisions: [{ candidate: offer.candidates[0]!.id, valence }],
      });
      expect([400, 422]).toContain(decided.status);
    }
  });
});

describe.if(HAS_PHYSICAL)("binding: consumed and lost are the collection's, never a decision (§11)", () => {
  test("a household cannot declare its own goods consumed or lost", async () => {
    // NOTE (mutation check, 2026-09-09): household_declares_consumed let a
    // household decide consumed and lost in the physical binding. Both
    // assertions failed with 200. The refutation pass measured the hole:
    // a household that signs its goods "consumed" pays cost instead of
    // price, and one that signs them "lost" pays nothing.
    const created = await call("POST", "/offers", physicalOffer());
    const offer = created.body as { id: string; candidates: { id: string }[] };
    await call("POST", `/offers/${offer.id}/present`, {});
    const [first, second, ...rest] = offer.candidates;
    for (const valence of ["consumed", "lost"]) {
      const refused = await decide(offer.id, {
        decisions: [
          { candidate: first!.id, valence },
          { candidate: second!.id, valence: "returned" },
          ...rest.map((c) => ({ candidate: c.id, valence: "returned" })),
        ],
      });
      expect(refused.status).toBe(422);
    }
    const read = await call("GET", `/offers/${offer.id}`);
    for (const c of (read.body as { candidates: { valence: string }[] }).candidates) {
      expect(c.valence).toBe("offered");
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
    // One household for both offers: a balance carried forward is only
    // visible to a second offer to the same household, and since exploration
    // became what a household has never been offered, every offer defaults
    // to a fresh one unless named.
    // One household for both offers, and one product held back from the
    // first so the second has the novelty the floor requires (§5): a
    // presenter with nothing new for a household makes it no offer.
    const household = freshHousehold();
    const held = PRODUCTS[PRODUCTS.length - 1]!;
    const shown = PRODUCTS.slice(0, -1);
    const first = await call("POST", "/offers", physicalOffer({
      household,
      candidates: shown.map((product, i) => ({
        product,
        quantity: 1,
        predicted_conversion: 0.5,
        is_exploration: i === 0,
      })),
    }));
    expect(first.status).toBe(201);
    const one = first.body as {
      id: string;
      candidates: { id: string; unit_price: number }[];
    };
    await call("POST", `/offers/${one.id}/present`, {});
    const [tried, ...others] = one.candidates;
    // The trial: the collection finds one used and the rest unopened.
    await call("POST", `/offers/${one.id}/recovery`, {
      returned: others.map((c) => c.id),
      consumed: [tried!.id],
    });
    const trial = await call("POST", `/offers/${one.id}/settle`, {});
    const trialCharge = (trial.body as { charged: number }).charged;
    expect(trialCharge).toBeGreaterThan(0);

    // A second offer to the same household, kept in full.
    const second = await call("POST", "/offers", physicalOffer({
      household,
      // The held-back product is the only novelty and carries the floor;
      // the rest were offered before and cannot be marked (§5.1).
      candidates: [held, ...shown].map((product, i) => ({
        product,
        quantity: 1,
        predicted_conversion: 0.5,
        is_exploration: i === 0,
      })),
    }));
    expect(second.status).toBe(201);
    const two = second.body as {
      id: string;
      candidates: { id: string; unit_price: number; quantity: number }[];
    };
    await call("POST", `/offers/${two.id}/present`, {});
    await decide(two.id, {
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
    // Self-contained since 2026-09-09: the trial happens here, on one
    // household, rather than being inherited from the probe above.
    const household = freshHousehold();
    const held = PRODUCTS[PRODUCTS.length - 1]!;
    const shown = PRODUCTS.slice(0, -1);
    const first = await call("POST", "/offers", physicalOffer({
      household,
      candidates: shown.map((product, i) => ({
        product,
        quantity: 1,
        predicted_conversion: 0.5,
        is_exploration: i === 0,
      })),
    }));
    expect(first.status).toBe(201);
    const one = first.body as { id: string; candidates: { id: string }[] };
    await call("POST", `/offers/${one.id}/present`, {});
    const [tried, ...others] = one.candidates;
    // The trial: the collection finds one used and the rest unopened.
    await call("POST", `/offers/${one.id}/recovery`, {
      returned: others.map((c) => c.id),
      consumed: [tried!.id],
    });
    await call("POST", `/offers/${one.id}/settle`, {});

    const created = await call("POST", "/offers", physicalOffer({
      household,
      candidates: [held, ...shown].map((product, i) => ({
        product,
        quantity: 1,
        predicted_conversion: 0.5,
        is_exploration: i === 0,
      })),
    }));
    expect(created.status).toBe(201);
    const offer = created.body as {
      candidates: { product: string; unit_price: number }[];
    };
    for (const candidate of offer.candidates) {
      expect(candidate.unit_price).toBe(PRICES[candidate.product]);
    }
  });
});

describe.if(HAS_PHYSICAL)("binding: recovery (§11)", () => {
  /**
   * The operations the valences alone do not give you. Goods sit in a home,
   * the route comes back for what was not used, and what is never collected
   * becomes a loss to whoever holds the stock.
   *
   * The rule these probes exist for: silence in the physical binding does not
   * mean the same thing as silence in the digital one. A digital candidate
   * nobody decided is `returned`, because no order should be created by
   * silence. A physical candidate nobody decided is still in someone's house,
   * and only the route or the deadline can say what became of it.
   */
  const soon = (ms: number) => Date.now() + ms;

  async function placed(expiresIn = 60_000) {
    const created = await call(
      "POST",
      "/offers",
      conformingOffer({ binding: "physical", expires_at: soon(expiresIn) })
    );
    expect(created.status).toBe(201);
    const offer = created.body as { id: string; candidates: { id: string }[] };
    const presented = await call("POST", `/offers/${offer.id}/present`, {});
    expect(presented.status).toBe(200);
    return offer;
  }

  test("presenting a physical offer opens a recovery with a deadline", async () => {
    // NOTE (mutation check, 2026-09-09): no_recovery_on_present stopped
    // opening one. This assertion failed with 404. Without a deadline there is
    // nothing for the loss rule to read, and goods in a home have no end date.
    const offer = await placed();
    const recovery = await call("GET", `/offers/${offer.id}/recovery`);
    expect(recovery.status).toBe(200);
    const row = recovery.body as { due_at: number; grace_days: number; collected_at: number | null };
    expect(typeof row.due_at).toBe("number");
    expect(row.grace_days).toBeGreaterThanOrEqual(0);
    expect(row.collected_at).toBeNull();
  });

  test("a collection records what came back and what was used", async () => {
    // NOTE (mutation check, 2026-09-09): collect_ignores_consumed dropped the
    // consumed list. This assertion failed on the valence: a candidate the
    // household tried came back as `returned` and settled at nothing, which
    // makes trying free and removes the middle term §6.2 exists for.
    const offer = await placed();
    const [first, second, ...rest] = offer.candidates;
    const collected = await call("POST", `/offers/${offer.id}/recovery`, {
      returned: [second!.id, ...rest.map((c) => c.id)],
      consumed: [first!.id],
    });
    expect(collected.status).toBe(200);

    const read = await call("GET", `/offers/${offer.id}`);
    const candidates = (read.body as { candidates: { id: string; valence: string }[] }).candidates;
    expect(candidates.find((c) => c.id === first!.id)!.valence).toBe("consumed");
    expect(candidates.find((c) => c.id === second!.id)!.valence).toBe("returned");
  });

  test("a candidate cannot be both returned and consumed", async () => {
    // NOTE (mutation check, 2026-09-09): returned_and_consumed_ok accepted
    // a candidate in both lists. This assertion failed with 200. One item
    // cannot have come back unopened and also been used, and a collection
    // that says so is reporting two worlds.
    const offer = await placed();
    const both = await call("POST", `/offers/${offer.id}/recovery`, {
      returned: [offer.candidates[0]!.id],
      consumed: [offer.candidates[0]!.id],
    });
    expect([400, 422]).toContain(both.status);
  });

  test("collecting twice is refused", async () => {
    // NOTE (mutation check, 2026-09-09): collect_twice accepted a second
    // collection for one offer. This assertion failed with 200. A second
    // report could overwrite the first with a friendlier one, and the
    // settlement would follow the friendlier.
    const offer = await placed();
    const body = { returned: offer.candidates.map((c) => c.id), consumed: [] };
    expect((await call("POST", `/offers/${offer.id}/recovery`, body)).status).toBe(200);
    expect((await call("POST", `/offers/${offer.id}/recovery`, body)).status).toBe(409);
  });

  test("an uncollected candidate is not returned at expiry", async () => {
    // NOTE (mutation check, 2026-09-09): physical_expiry_returns applied the
    // digital rule to the physical binding, so everything uncollected became
    // `returned` the moment the offer expired. This assertion failed. The
    // goods are in a house and nobody has looked at them; calling that a
    // return is a claim about the world rather than a default.
    const offer = await placed(1_500);
    await sleep(2_000);
    const read = await call("GET", `/offers/${offer.id}`);
    const candidates = (read.body as { candidates: { valence: string }[] }).candidates;
    expect(candidates.every((c) => c.valence !== "returned")).toBe(true);
  });

  test.if(RECOVERY_GRACE_DAYS === 0)("what is never collected becomes lost, and is not billed", async () => {
    // NOTE (mutation check, 2026-09-09): never_lost removed the deadline, so
    // uncollected candidates stayed `offered` forever and the offer could not
    // settle. This assertion failed. Loss has to land somewhere, and §3.2 says
    // it lands on the stock holder rather than the household.
    //
    // It runs only where the deployment declares a grace of zero days. A probe
    // that waited a fixed interval against a three-day grace would never reach
    // the deadline and would report that the rule works.
    const offer = await placed(1_000);
    await sleep(1_500);
    const settled = await call("POST", `/offers/${offer.id}/settle`, {});
    expect(settled.status).toBe(200);
    const amounts = settled.body as {
      lost_amount: number;
      charged: number;
      kept_amount: number;
    };
    expect(amounts.lost_amount).toBeGreaterThan(0);
    expect(amounts.charged).toBe(0);
    expect(amounts.kept_amount).toBe(0);
  }, 20_000);
});

describe.if(HAS_PHYSICAL)("binding: eligibility for placement (§11.1)", () => {
  test("a product with no eligibility recorded cannot be placed", async () => {
    // NOTE (mutation check, 2026-09-09): place_anything removed the check.
    // This assertion failed with 201. §11.1 keeps chilled, bulky and regulated
    // goods out of the physical binding, and a lorry is a bad place to
    // discover that a product cannot go in a home.
    const body = conformingOffer({ binding: "physical" });
    (body.candidates as Record<string, unknown>[])[0]!.product = "not-in-the-catalogue";
    const created = await call("POST", "/offers", body);
    expect([404, 422]).toContain(created.status);
  });
});
