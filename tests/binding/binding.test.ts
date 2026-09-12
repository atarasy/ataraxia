import { describe, expect, test } from "bun:test";
import {
  call,
  conformingOffer,
  decide,
  freshHousehold,
  HAS_PHYSICAL,
  PRICES,
  PRODUCTS,
  CONFIG_VERSION_UNROOTED,
  DISCLOSURE,
  PRODUCTS_UNROOTED,
  RECOVERY_GRACE_DAYS,
  settleSigned,
  signStatement,
  assertStatement,
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

/**
 * §6.5, 法11条1号. A physical box that was delivered and collected has a
 * delivery record, and the statement renders the carriage from it. A merchant
 * whose price includes carriage records `0`; `null` means an implementation
 * that never recorded what it did, and `settle` refuses that for a box with
 * goods used. The probes record one wherever they collect.
 */
async function delivered(offerId: string, carriage = 550) {
  const recorded = await call("POST", `/offers/${offerId}/delivery`, {
    carriage,
    code: `dc-${offerId.slice(0, 8)}`,
    status: "delivered",
  });
  expect(recorded.status).toBe(201);
}

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
    // model is the point of clause 26's neighbouring rule here: loss falls on
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
    await delivered(offer.id);
    const collected = await call("POST", `/offers/${offer.id}/recovery`, {
      returned: rest.map((c) => c.id),
      consumed: [first!.id],
    });
    expect(collected.status).toBe(200);

    const settled = await settleSigned(offer.id);
    const settlement = settled.body as {
      kept_amount: number;
      consumed_amount: number;
      charged: number;
    };
    expect(settlement.kept_amount).toBe(0);
    expect(settlement.consumed_amount).toBe(first!.unit_price);
    expect(settlement.charged).toBe(first!.unit_price);
  });

  test("a gift the household kept is never billed either", async () => {
    // NOTE (mutation check, 2026-09-12): kept_gift_is_billed charges a kept
    // gift at its price. This assertion failed with the gift's price added.
    //
    // **Measured, not reasoned.** The engine's `kept` branch asked nothing
    // about `given_by` while the `consumed` branch had asked since
    // 2026-09-09, so a gift a household kept was charged and one it used was
    // free. Every probe in this file had consumed the gift and none had kept
    // one, which is why a rule with prose, a probe and a mutation went
    // untested on the branch that mattered. Clause 10: what a maker, a
    // merchant or a friend gave is never billed to the recipient.
    const body = physicalOffer();
    const list = body.candidates as Record<string, unknown>[];
    list[0]!.given_by = "maker-a";
    const created = await call("POST", "/offers", body);
    expect(created.status).toBe(201);
    const offer = created.body as {
      id: string;
      candidates: { id: string; product: string; given_by: string | null; unit_price: number }[];
    };
    await call("POST", `/offers/${offer.id}/present`, {});
    const [gift, ...rest] = offer.candidates;
    await decide(offer.id, {
      decisions: offer.candidates.map((c) => ({ candidate: c.id, valence: "kept", kept_as: "self" })),
    });
    const settled = await call("POST", `/offers/${offer.id}/settle`, {});
    expect(settled.status).toBe(200);
    const settlement = settled.body as { kept_amount: number; charged: number; lines: { candidate: string; amount: number }[] };
    const others = rest.reduce((sum, c) => sum + c.unit_price, 0);
    expect(settlement.kept_amount).toBe(others);
    expect(settlement.charged).toBe(others);
    expect(settlement.lines.find((l) => l.candidate === gift!.id)!.amount).toBe(0);
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
    await delivered(offer.id);
    await call("POST", `/offers/${offer.id}/recovery`, {
      returned: rest.map((c) => c.id),
      consumed: [gift!.id],
    });
    const settled = await settleSigned(offer.id);
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
    await delivered(offer.id);
    await call("POST", `/offers/${offer.id}/recovery`, {
      returned: rest.map((c) => c.id),
      consumed: [first!.id],
    });
    const settled = await settleSigned(offer.id);
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
    await delivered(one.id);
    await call("POST", `/offers/${one.id}/recovery`, {
      returned: others.map((c) => c.id),
      consumed: [tried!.id],
    });
    const trial = await settleSigned(one.id);
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
    // discount is a discount whatever it is called, and clause 28 says
    // there are none. This assertion failed.
    // The other shape the same defect takes. Instead of a balance, the
    // discount arrives as a lower price on the next offer, which clause 10
    // forbids from the other direction and clause 28 forbids by name.
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
    await delivered(one.id);
    await call("POST", `/offers/${one.id}/recovery`, {
      returned: others.map((c) => c.id),
      consumed: [tried!.id],
    });
    await settleSigned(one.id);

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
    await delivered(offer.id);
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
    await delivered(offer.id);
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

describe.if(HAS_PHYSICAL)("binding: goods used are charged on the household's signature (§6.5, question 36)", () => {
  /**
   * The collection records what was used, and the household may not name
   * that verdict itself (§11.2). Until 2026-09-12 the reference then charged
   * those lines on the collection's record alone, with no act of the
   * household on any device: a debt made by a third party's record, which
   * clause 35 forbids and which the concept's legal reading says loses the
   * case for distance selling. So the collection's record is a proposal, and
   * the household's signature over the settlement statement is the
   * application. The household confirms the statement or disputes consumed
   * lines of it; it still cannot choose the verdict.
   */
  async function collected(carriage = 550) {
    const created = await call("POST", "/offers", physicalOffer());
    expect(created.status).toBe(201);
    const offer = created.body as {
      id: string;
      household: string;
      candidates: { id: string; product: string; unit_price: number }[];
    };
    await call("POST", `/offers/${offer.id}/present`, {});
    const [first, second, ...rest] = offer.candidates;
    await delivered(offer.id, carriage);
    const collectedBy = await call("POST", `/offers/${offer.id}/recovery`, {
      returned: rest.map((c) => c.id),
      consumed: [first!.id, second!.id],
    });
    expect(collectedBy.status).toBe(200);
    return { offer, used: [first!, second!] };
  }

  test("the statement shows each used line at its price, with the blocks beside it", async () => {
    // What the household signs is a sale and not a total: every line it will
    // be charged for, at the price the offer froze, with the merchant's own
    // block beside it and the carriage from the delivery record.
    // The carriage is recorded once, with the delivery, and is the figure the
    // statement renders. It used to be re-recorded here at a different amount
    // to prove the statement read the register rather than a constant; the
    // register refuses that since 2026-09-12, because a figure a household
    // signed under must not move afterwards (§7.5b).
    const { offer, used } = await collected(320);
    const statement = await call("GET", `/offers/${offer.id}/statement`);
    expect(statement.status).toBe(200);
    const shown = statement.body as {
      lines: { candidate: string; valence: string; amount: number; unit_price: number; product: string }[];
      disclosures: { merchant: string }[];
      carriage: number | null;
    };
    expect(shown.lines.map((l) => l.candidate).sort()).toEqual(used.map((c) => c.id).sort());
    for (const line of shown.lines) {
      expect(line.valence).toBe("consumed");
      expect(line.unit_price).toBe(PRICES[line.product]);
      expect(line.amount).toBe(PRICES[line.product]);
    }
    expect(shown.disclosures.length).toBeGreaterThan(0);
    expect(shown.carriage).toBe(320);
    // NOTE (mutation check, 2026-09-12): statement_line_without_its_block
    // drops the field. This assertion failed. One screen holds several
    // merchants' blocks, and which governs which line is a property of the
    // contract rather than an instruction about layout (§10a.5).
    for (const line of shown.lines as unknown as { merchant: string; disclosure?: { merchant: string; product: string | null } }[]) {
      expect(line.disclosure).toBeDefined();
      expect(line.disclosure!.merchant).toBe(line.merchant);
      expect(
        shown.disclosures.some(
          (d) => (d as { merchant: string; product: string | null }).merchant === line.disclosure!.merchant &&
            (d as { merchant: string; product: string | null }).product === line.disclosure!.product
        )
      ).toBe(true);
    }
  });

  test("an empty settle is refused and names itself; nothing is charged", async () => {
    // NOTE (mutation check, 2026-09-12): settle_without_statement charges on
    // the collection's record when no signature arrives. This assertion
    // failed with 200.
    const { offer } = await collected();
    const refused = await call("POST", `/offers/${offer.id}/settle`, {});
    expect(refused.status).toBe(422);
    expect((refused.body as { error: string }).error).toBe("statement_unsigned");
    const read = await call("GET", `/offers/${offer.id}/settlement`);
    expect(read.status).toBe(404);
  });

  test("a signature over other lines, or by another key, is refused", async () => {
    const { offer, used } = await collected();
    const statement = await call("GET", `/offers/${offer.id}/statement`);
    const lines = (statement.body as { lines: { candidate: string; valence: string; amount: number }[] }).lines
      .map((l) => ({ ...l, disputed: false }));
    // The statement with a line quietly removed, signed by the right key.
    const fewer = lines.filter((l) => l.candidate !== used[0]!.id);
    const short = await call("POST", `/offers/${offer.id}/settle`, { signature: signStatement(offer.id, 550, fewer) });
    expect(short.status).toBe(422);
    expect((short.body as { error: string }).error).toBe("bad_signature");
    // A stranger's key over the right lines.
    const { generateKeyPairSync } = await import("node:crypto");
    const stranger = generateKeyPairSync("ed25519").privateKey;
    const forged = await call("POST", `/offers/${offer.id}/settle`, { signature: signStatement(offer.id, 550, lines, stranger) });
    expect(forged.status).toBe(422);
  });

  test("the signed statement settles, and the settlement records the confirmation", async () => {
    const { offer, used } = await collected();
    const settled = await settleSigned(offer.id);
    expect(settled.status).toBe(200);
    const settlement = settled.body as { consumed_amount: number; charged: number; disputed_amount: number; confirmation: string | null };
    const total = used.reduce((sum, c) => sum + c.unit_price, 0);
    expect(settlement.consumed_amount).toBe(total);
    expect(settlement.charged).toBe(total);
    expect(settlement.disputed_amount).toBe(0);
    expect(typeof settlement.confirmation).toBe("string");
  });

  test("a signature against one carriage does not settle a box recorded at another", async () => {
    // NOTE (mutation check, 2026-09-13): canonical_form_without_carriage
    // drops the figure from the engine's form. In the 299-mutation run this
    // probe failed on the final valid signature (422 instead of 200): the
    // independent probe library still signs the specified form. The engine
    // unit test, whose signer uses the mutated form, catches the other half:
    // its wrong-carriage signature is accepted. Do not conflate those runs.
    //
    // §6.5, question 40. 法11条1号 puts the carriage on this screen beside the
    // price, and until 2026-09-13 the signature covered the lines and not it,
    // so a household read a figure, signed, and had no record that it had.
    const { offer } = await collected(320);
    const statement = await call("GET", `/offers/${offer.id}/statement`);
    const lines = (statement.body as { lines: { candidate: string; valence: string; amount: number }[] }).lines
      .map((l) => ({ ...l, disputed: false }));
    const wrong = await call("POST", `/offers/${offer.id}/settle`, { signature: signStatement(offer.id, 0, lines) });
    expect(wrong.status).toBe(422);
    expect((wrong.body as { error: string }).error).toBe("bad_signature");
    const right = await call("POST", `/offers/${offer.id}/settle`, { signature: signStatement(offer.id, 320, lines) });
    expect(right.status).toBe(200);
  });

  test("a passkey's assertion over the statement is accepted too (§10.5)", async () => {
    const { offer } = await collected();
    const statement = await call("GET", `/offers/${offer.id}/statement`);
    const lines = (statement.body as { lines: { candidate: string; valence: string; amount: number }[] }).lines
      .map((l) => ({ ...l, disputed: false }));
    const settled = await call("POST", `/offers/${offer.id}/settle`, { assertion: assertStatement(offer.id, 550, lines) });
    expect(settled.status).toBe(200);
  });

  test("a disputed line leaves the rail: not charged, shown as disputed", async () => {
    // NOTE (mutation check, 2026-09-12): settle_ignores_dispute verified the
    // signature over a statement marking the line disputed and charged it
    // anyway. This assertion failed on `charged`.
    const { offer, used } = await collected();
    const [disputedOne, confirmedOne] = used;
    const settled = await settleSigned(offer.id, [disputedOne!.id]);
    expect(settled.status).toBe(200);
    const settlement = settled.body as {
      consumed_amount: number;
      charged: number;
      disputed_amount: number;
      lines: { candidate: string; amount: number; disputed: boolean }[];
    };
    expect(settlement.charged).toBe(confirmedOne!.unit_price);
    expect(settlement.consumed_amount).toBe(confirmedOne!.unit_price);
    expect(settlement.disputed_amount).toBe(disputedOne!.unit_price);
    const line = settlement.lines.find((l) => l.candidate === disputedOne!.id)!;
    expect(line.disputed).toBe(true);
    expect(settlement.lines.find((l) => l.candidate === confirmedOne!.id)!.disputed).toBe(false);
  });

  test("only a consumed line can be disputed", async () => {
    // A kept line is one the household signed itself at the decision, and a
    // returned line charges nothing. The dispute is of the collection's
    // verdict and of nothing else.
    const created = await call("POST", "/offers", physicalOffer());
    const offer = created.body as { id: string; candidates: { id: string }[] };
    await call("POST", `/offers/${offer.id}/present`, {});
    const [first, second, ...rest] = offer.candidates;
    await decide(offer.id, {
      decisions: [
        { candidate: first!.id, valence: "kept", kept_as: "self" },
        ...rest.map((c) => ({ candidate: c.id, valence: "returned" })),
      ],
    });
    await delivered(offer.id);
    await call("POST", `/offers/${offer.id}/recovery`, { returned: [], consumed: [second!.id] });
    const refused = await settleSigned(offer.id, [first!.id]);
    expect(refused.status).toBe(422);
    expect((refused.body as { error: string }).error).toBe("not_disputable");
  });

  test("the next box does not come while a statement stands unsigned", async () => {
    // NOTE (mutation check, 2026-09-12): present_despite_unsigned_statement
    // presents the second box regardless. This assertion failed with 200.
    // The weekly swap is the only pressure this specification puts on a
    // household to sign; nothing accrues on the rail, and what is owed is
    // the merchant's to pursue.
    const household = freshHousehold();
    const held = PRODUCTS[PRODUCTS.length - 1]!;
    const shown = PRODUCTS.slice(0, -1);
    const first = await call("POST", "/offers", physicalOffer({
      household,
      candidates: shown.map((product, i) => ({ product, quantity: 1, predicted_conversion: 0.5, is_exploration: i === 0 })),
    }));
    expect(first.status).toBe(201);
    const one = first.body as { id: string; candidates: { id: string }[] };
    await call("POST", `/offers/${one.id}/present`, {});
    const [used, ...others] = one.candidates;
    await delivered(one.id);
    await call("POST", `/offers/${one.id}/recovery`, { returned: others.map((c) => c.id), consumed: [used!.id] });

    const second = await call("POST", "/offers", physicalOffer({
      household,
      candidates: [held, ...shown].map((product, i) => ({ product, quantity: 1, predicted_conversion: 0.5, is_exploration: i === 0 })),
    }));
    expect(second.status).toBe(201);
    const two = second.body as { id: string };
    const refused = await call("POST", `/offers/${two.id}/present`, {});
    expect(refused.status).toBe(422);
    expect((refused.body as { error: string }).error).toBe("statement_unsigned");

    expect((await settleSigned(one.id)).status).toBe(200);
    const presented = await call("POST", `/offers/${two.id}/present`, {});
    expect(presented.status).toBe(200);
  });

  test("a box that came back with nothing used needs no statement", async () => {
    // The kept lines were signed at the decision and the returned ones
    // charge nothing, so there is nothing in the statement the household has
    // not already signed for.
    const created = await call("POST", "/offers", physicalOffer());
    const offer = created.body as { id: string; candidates: { id: string }[] };
    await call("POST", `/offers/${offer.id}/present`, {});
    await delivered(offer.id);
    await call("POST", `/offers/${offer.id}/recovery`, { returned: offer.candidates.map((c) => c.id), consumed: [] });
    const settled = await call("POST", `/offers/${offer.id}/settle`, {});
    expect(settled.status).toBe(200);
    expect((settled.body as { confirmation: string | null }).confirmation).toBeNull();
  });
});

describe.if(HAS_PHYSICAL)("binding: what the statement screen owes (§6.5, §10a)", () => {
  async function collectedBox() {
    const created = await call("POST", "/offers", physicalOffer());
    expect(created.status).toBe(201);
    const offer = created.body as {
      id: string;
      expires_at: number;
      candidates: { id: string; product: string; unit_price: number }[];
    };
    await call("POST", `/offers/${offer.id}/present`, {});
    const [first, ...rest] = offer.candidates;
    await delivered(offer.id);
    await call("POST", `/offers/${offer.id}/recovery`, {
      returned: rest.map((c) => c.id),
      consumed: [first!.id],
    });
    return offer;
  }

  test("it carries the offer's expiry, as the approval does", async () => {
    // NOTE (mutation check, 2026-09-12): statement_without_expiry drops the
    // field. This assertion failed. §10a.5 lists the expiry among the facts of
    // the sale, and a merchant's stated application period is measured against
    // it. It was missing until a refutation pass asked.
    const offer = await collectedBox();
    const statement = await call("GET", `/offers/${offer.id}/statement`);
    expect(statement.status).toBe(200);
    expect((statement.body as { expires_at: number }).expires_at).toBe(offer.expires_at);
  });

  test("it carries the merchant's block as composed, not merely a block", async () => {
    // NOTE (mutation check, 2026-09-12): disclosure_items_reordered sorts the
    // items by label. This assertion failed.
    // **The first version of this suite asserted only that the array was not
    // empty**, which is the same defect §10a.2 exists against: an
    // implementation that reordered, summarised or translated the seller's
    // statements passed. Found by a refutation pass the same night.
    const offer = await collectedBox();
    const statement = await call("GET", `/offers/${offer.id}/statement`);
    const blocks = (statement.body as { disclosures: { merchant: string; product: string | null; items: { label: string; value: string }[]; version: string; signature: string }[] }).disclosures;
    const mine = blocks.find((b) => b.merchant === DISCLOSURE.merchant && b.product === null);
    expect(mine).toBeDefined();
    expect(mine!.items).toEqual(DISCLOSURE.items);
    expect(mine!.version).toBe(DISCLOSURE.version);
    expect(mine!.signature).toBe(DISCLOSURE.signature);
  });

  test("a collection cannot name a candidate that is not the offer's", async () => {
    // NOTE (mutation check, 2026-09-12): collect_accepts_strangers drops the
    // check. This assertion failed with 200. An id belonging to no candidate
    // resolves nothing and still makes the offer read as collected with goods
    // used, so §6.5's block holds over that household with nothing to sign.
    const created = await call("POST", "/offers", physicalOffer());
    const offer = created.body as { id: string; candidates: { id: string }[] };
    await call("POST", `/offers/${offer.id}/present`, {});
    await delivered(offer.id);
    const refused = await call("POST", `/offers/${offer.id}/recovery`, {
      returned: [],
      consumed: ["not-a-candidate-of-this-offer"],
    });
    expect([400, 422]).toContain(refused.status);
    // §16.6, extended 2026-09-13 to every refusal the specification names:
    // a probe that checks only the status certifies that something was
    // refused and not that the person can tell which rule refused it.
    expect((refused.body as { error: string }).error).toBe("unknown_candidate");
  });

  test("the block is this presenter's, and another presenter's box is not stopped (clause 8)", async () => {
    // NOTE (mutation check, 2026-09-12): block_spans_presenters drops the
    // presenter check. The last assertion failed with 422.
    //
    // **The scope is a constitutional requirement, not a convenience.** Clause
    // 8 gives a merchant what was declined to it and the union to nobody but
    // the person; a block computed across presenters is an engine computing
    // that union and answering a merchant out of it, which is the objection
    // §16.3 already records against the daily ceiling. Suppressing the offer
    // id does not cure it, because what leaks is that something is unsettled
    // elsewhere. It is also the only scope that means the same thing on a
    // split deployment, where each engine holds its own offers.
    //
    // The second presenter here is the one §5.2's fixtures supply, whose key
    // no identity root endorsed. That is beside the point being tested and is
    // the only second presenter the suite is given.
    const household = freshHousehold();
    const held = PRODUCTS[PRODUCTS.length - 1]!;
    const shown = PRODUCTS.slice(0, -1);
    const first = await call("POST", "/offers", physicalOffer({
      household,
      candidates: shown.map((product, i) => ({ product, quantity: 1, predicted_conversion: 0.5, is_exploration: i === 0 })),
    }));
    expect(first.status).toBe(201);
    const one = first.body as { id: string; candidates: { id: string }[] };
    await call("POST", `/offers/${one.id}/present`, {});
    const [used, ...others] = one.candidates;
    await delivered(one.id);
    await call("POST", `/offers/${one.id}/recovery`, { returned: others.map((c) => c.id), consumed: [used!.id] });

    // The same presenter is stopped, and its refusal carries no offer id.
    const mine = await call("POST", "/offers", physicalOffer({
      household,
      candidates: [held, ...shown].map((product, i) => ({ product, quantity: 1, predicted_conversion: 0.5, is_exploration: i === 0 })),
    }));
    const two = mine.body as { id: string };
    const refused = await call("POST", `/offers/${two.id}/present`, {});
    expect(refused.status).toBe(422);
    expect((refused.body as { error: string }).error).toBe("statement_unsigned");
    expect(refused.text).not.toContain(one.id);

    // Another presenter's box is not.
    const theirs = await call("POST", "/offers", physicalOffer({
      household,
      config_version: CONFIG_VERSION_UNROOTED,
      candidates: PRODUCTS_UNROOTED.map((product, i) => ({ product, quantity: 1, predicted_conversion: 0.5, is_exploration: i === 0 })),
    }));
    expect(theirs.status).toBe(201);
    const three = theirs.body as { id: string };
    expect((await call("POST", `/offers/${three.id}/present`, {})).status).toBe(200);

    expect((await settleSigned(one.id)).status).toBe(200);
  });

  test("a box nobody can settle does not block the next one", async () => {
    // NOTE (mutation check, 2026-09-12): block_counts_unsettleable drops the
    // state check. This assertion failed with 422. A presenter that collects
    // part of a box and withdraws it leaves an offer that can never settle;
    // counting it made that household unofferable by anyone, for good, with
    // no act available to it that would lift the block.
    const household = freshHousehold();
    const held = PRODUCTS[PRODUCTS.length - 1]!;
    const shown = PRODUCTS.slice(0, -1);
    const first = await call("POST", "/offers", physicalOffer({
      household,
      candidates: shown.map((product, i) => ({ product, quantity: 1, predicted_conversion: 0.5, is_exploration: i === 0 })),
    }));
    const one = first.body as { id: string; candidates: { id: string }[] };
    await call("POST", `/offers/${one.id}/present`, {});
    // A partial collection: one used, the rest unnamed, so the offer stays
    // presented and cannot be settled.
    await delivered(one.id);
    await call("POST", `/offers/${one.id}/recovery`, { returned: [], consumed: [one.candidates[0]!.id] });
    expect((await call("POST", `/offers/${one.id}/withdraw`, {})).status).toBe(200);
    const second = await call("POST", "/offers", physicalOffer({
      household,
      candidates: [held, ...shown].map((product, i) => ({ product, quantity: 1, predicted_conversion: 0.5, is_exploration: i === 0 })),
    }));
    const two = second.body as { id: string };
    expect((await call("POST", `/offers/${two.id}/present`, {})).status).toBe(200);
  });

  test("a gift is proposed at nothing on the statement, as it settles", async () => {
    // NOTE (mutation check, 2026-09-12): statement_bills_a_gift proposes the
    // gift at its catalogue price. This assertion failed. Clause 10: a gift
    // arrives at its price and is never billed, and a statement that asked a
    // household to sign for one would be signed against a receipt that
    // charges nothing for it.
    const body = physicalOffer();
    (body.candidates as Record<string, unknown>[])[0]!.given_by = "maker-a";
    const created = await call("POST", "/offers", body);
    const offer = created.body as { id: string; candidates: { id: string; given_by: string | null }[] };
    await call("POST", `/offers/${offer.id}/present`, {});
    const [gift, second, ...rest] = offer.candidates;
    await delivered(offer.id);
    await call("POST", `/offers/${offer.id}/recovery`, {
      returned: rest.map((c) => c.id),
      consumed: [gift!.id, second!.id],
    });
    const statement = await call("GET", `/offers/${offer.id}/statement`);
    const line = (statement.body as { lines: { candidate: string; amount: number; given_by: string | null }[] })
      .lines.find((l) => l.candidate === gift!.id)!;
    expect(line.given_by).toBe("maker-a");
    expect(line.amount).toBe(0);
  });
});

describe.if(HAS_PHYSICAL)("binding: a ceremonial offer is digital (§12, §6.5)", () => {
  test("a physical ceremonial offer is refused at creation", async () => {
    // NOTE (mutation check, 2026-09-12): ceremonial_may_be_physical drops the
    // refusal. This assertion failed with 201.
    //
    // **The payer and the signer are different people.** Clause 25 makes the
    // giver the party charged and §6.5 makes the household's signature over
    // the settlement statement the application for a consumed line, so a
    // physical ceremonial box would charge a party that took no act while the
    // party that acted paid nothing. Giving the statement to the giver instead
    // is shut: it lists what the recipient used, which is the candidates
    // clause 24 keeps from the giver and the signal clause 16 forbids.
    const created = await call("POST", "/offers", physicalOffer({
      purpose: "ceremonial",
      price_band: { min: Math.min(...Object.values(PRICES)), max: Math.max(...Object.values(PRICES)) },
      giver: `${freshHousehold()}-giver`,
    }));
    expect(created.status).toBe(422);
    expect((created.body as { error: string }).error).toBe("ceremonial_is_digital");
  });

  test("the same ceremonial offer is accepted in the digital binding", async () => {
    // The refusal is about the binding and not about the purpose, and a probe
    // that only checked the refusal would pass an implementation that had
    // stopped accepting ceremonial offers at all.
    const created = await call("POST", "/offers", conformingOffer({
      purpose: "ceremonial",
      price_band: { min: Math.min(...Object.values(PRICES)), max: Math.max(...Object.values(PRICES)) },
      giver: `${freshHousehold()}-giver`,
    }));
    expect(created.status).toBe(201);
  });
});

describe.if(HAS_PHYSICAL)("binding: the statement carries the carriage, so there is one to carry (§6.5, 法11条1号)", () => {
  test("a box with goods used and no delivery recorded does not settle", async () => {
    // NOTE (mutation check, 2026-09-12): settle_without_a_delivery drops the
    // check. This assertion failed with 200, and the statement it settled on
    // showed `carriage: null`.
    //
    // **`null` and `0` are different facts.** 法11条1号 asks for the carriage
    // beside the price 「販売価格に商品の送料が含まれない場合には」, so a
    // merchant whose price includes it owes no separate figure and records
    // `0`; `null` is an implementation that never recorded what it did. For a
    // statement the goods have by definition been delivered and collected.
    const created = await call("POST", "/offers", physicalOffer());
    const offer = created.body as { id: string; candidates: { id: string }[] };
    await call("POST", `/offers/${offer.id}/present`, {});
    const [used, ...rest] = offer.candidates;
    await call("POST", `/offers/${offer.id}/recovery`, {
      returned: rest.map((c) => c.id),
      consumed: [used!.id],
    });
    const refused = await settleSigned(offer.id);
    expect(refused.status).toBe(422);
    expect((refused.body as { error: string }).error).toBe("delivery_missing");

    // Recorded, it settles, and a price that includes carriage records zero.
    await delivered(offer.id, 0);
    const settled = await settleSigned(offer.id);
    expect(settled.status).toBe(200);
    const statement = await call("GET", `/offers/${offer.id}/statement`);
    expect((statement.body as { carriage: number | null }).carriage).toBe(0);
  });

  test("a box with nothing used settles without one", async () => {
    // Nothing is charged, so no application is made at settlement and no
    // screen owes the statute anything.
    const created = await call("POST", "/offers", physicalOffer());
    const offer = created.body as { id: string; candidates: { id: string }[] };
    await call("POST", `/offers/${offer.id}/present`, {});
    await call("POST", `/offers/${offer.id}/recovery`, {
      returned: offer.candidates.map((c) => c.id),
      consumed: [],
    });
    expect((await call("POST", `/offers/${offer.id}/settle`, {})).status).toBe(200);
  });

  test("an import cannot rewrite a recorded carriage either", async () => {
    // NOTE (mutation check, 2026-09-13): import_rewrites_the_carriage drops
    // the guard. The last assertion failed, reading 800.
    //
    // §7.5b. The guard on `record` was true of one door and false of the
    // other: the household's own move route reached a plain overwrite with
    // nothing in between. A figure the household was shown before it signed
    // must not move, whichever door it comes through.
    const created = await call("POST", "/offers", physicalOffer());
    const offer = created.body as { id: string; household: string };
    const code = `dc-imp-${offer.id.slice(0, 8)}`;
    expect((await call("POST", `/offers/${offer.id}/delivery`, { carriage: 500, code, status: "placed" })).status).toBe(201);
    const imported = await call("POST", `/households/${encodeURIComponent(offer.household)}/import`, {
      // The route refuses anything that is not an export (`http.ts` checks the
      // format before it reads a field), so the shape is an export carrying
      // one delivery and nothing else.
      format: "valence-node/4",
      deliveries: [{ offer: offer.id, carriage: 800, code, status: "delivered", updated_at: Date.now() }],
    });
    expect([409, 422]).toContain(imported.status);
    const read = await call("GET", `/offers/${offer.id}/delivery`);
    expect((read.body as { carriage: number }).carriage).toBe(500);
  });

  test("a delivery update moves the status and may not move the carriage", async () => {
    // NOTE (mutation check, 2026-09-12): delivery_carriage_overwritten drops
    // the check. The last assertion failed, reading 800.
    //
    // The carriage is a figure the approval and the statement put in front of
    // the household before it signed. A despatch update carrying a different
    // one rewrites what a person read after they read it, and the register
    // took a plain overwrite until a refutation pass over the reference hub
    // asked what a household that signed under a carriage has as a record.
    const created = await call("POST", "/offers", physicalOffer());
    const offer = created.body as { id: string };
    const code = `dc-fix-${offer.id.slice(0, 8)}`;
    expect((await call("POST", `/offers/${offer.id}/delivery`, { carriage: 500, code, status: "placed" })).status).toBe(201);
    const moved = await call("POST", `/offers/${offer.id}/delivery`, { carriage: 500, code, status: "delivered" });
    expect(moved.status).toBe(201);
    const changed = await call("POST", `/offers/${offer.id}/delivery`, { carriage: 800, code, status: "delivered" });
    expect(changed.status).toBe(422);
    // §16.6, extended 2026-09-13 to every refusal the specification names:
    // a probe that checks only the status certifies that something was
    // refused and not that the person can tell which rule refused it.
    expect((changed.body as { error: string }).error).toBe("carriage_fixed");
    const read = await call("GET", `/offers/${offer.id}/delivery`);
    expect((read.body as { carriage: number }).carriage).toBe(500);
  });
});

describe.if(HAS_PHYSICAL)("binding: a set nobody signed is not a set anyone can take back (§16.5)", () => {
  test("a box the collection resolved cannot be withdrawn", async () => {
    // NOTE (mutation check, 2026-09-13): withdraw_a_set_nobody_signed drops
    // the check. The status assertion failed with 200, the box read
    // `presented` with its collection verdicts intact, and the next box from
    // the same presenter then presented where it had been refused.
    //
    // Question 43. Withdrawing removes a commitment, which is why this route
    // needs no signature; where the household signed nothing there is none to
    // remove. What the route did instead was hide the box from the
    // household's own list, refuse its signature as out of state, and lift
    // §6.5's block, so a presenter that withdrew the box left the consumed
    // goods charged to nobody.
    const created = await call("POST", "/offers", physicalOffer());
    const offer = created.body as { id: string; candidates: { id: string }[] };
    await call("POST", `/offers/${offer.id}/present`, {});
    const [used, ...rest] = offer.candidates;
    await delivered(offer.id);
    await call("POST", `/offers/${offer.id}/recovery`, {
      returned: rest.map((c) => c.id),
      consumed: [used!.id],
    });
    const read = await call("GET", `/offers/${offer.id}`);
    expect((read.body as { state: string }).state).toBe("decided");

    const taken = await call("DELETE", `/offers/${offer.id}/decisions`);
    expect(taken.status).toBe(409);
    expect((taken.body as { error: string }).error).toBe("not_withdrawable");
    // And it is still the box it was, so the household can still sign it.
    expect((await call("GET", `/offers/${offer.id}`)).body).toMatchObject({ state: "decided" });
    expect((await settleSigned(offer.id)).status).toBe(200);
  });
});

describe.if(HAS_PHYSICAL)("binding: a signature is an application, and applying twice is not asking twice (§6.5)", () => {
  test("a signature over a box that already settled is refused, not answered with the first settlement", async () => {
    // NOTE (mutation check, 2026-09-12): settle_answers_a_second_signature
    // returns the recorded settlement to a signed second attempt. The status
    // assertion failed with 200, and the settlement that came back carried
    // `disputed_amount: 0` while the household had just disputed a line.
    //
    // Two tabs of one statement. The first confirms everything and settles.
    // The second disputes a line and signs after it, and was handed the first
    // settlement with a 200: the screen read as signed, named a charge that
    // included the disputed line, and the dispute was recorded nowhere.
    // **Settling is idempotent for a caller that only asks for it**, which a
    // presenter retrying after a timeout is, and a household sending a
    // signature is not asking but applying. Found by a refutation pass over
    // the reference hub.
    const created = await call("POST", "/offers", physicalOffer());
    const offer = created.body as { id: string; candidates: { id: string }[] };
    await call("POST", `/offers/${offer.id}/present`, {});
    const [used, ...rest] = offer.candidates;
    await delivered(offer.id);
    await call("POST", `/offers/${offer.id}/recovery`, {
      returned: rest.map((c) => c.id),
      consumed: [used!.id],
    });
    const first = await settleSigned(offer.id);
    expect(first.status).toBe(200);
    expect((first.body as { disputed_amount: number }).disputed_amount).toBe(0);

    const second = await settleSigned(offer.id, [used!.id]);
    expect(second.status).toBe(409);
    expect((second.body as { error: string }).error).toBe("already_settled");
    // And the settlement that stands is the first one, untouched.
    const read = await call("GET", `/offers/${offer.id}/settlement`);
    expect((read.body as { disputed_amount: number }).disputed_amount).toBe(0);
    // A caller that only asks still gets what stands.
    const asked = await call("POST", `/offers/${offer.id}/settle`, {});
    expect(asked.status).toBe(200);
    expect((asked.body as { receipt: string }).receipt).toBe((first.body as { receipt: string }).receipt);
  });
});
