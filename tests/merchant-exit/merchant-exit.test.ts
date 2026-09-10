import { describe, expect, test } from "bun:test";
import { call, createConformingOffer, decide, freshHousehold, presenter } from "../lib/probe.js";

/**
 * Clauses 5 and 43, and specification §14.1.
 *
 * A shop leaves with its ledgers. This was one part of `exit/` until
 * 2026-09-11, when §13.1 gave an implementation two roles it may present: the
 * shop's export is the **engine's** surface and the household's move is the
 * **hub's**, and a suite that asked for both could not be pointed at either
 * role alone. Splitting the file is what lets each be asked of the party that
 * answers for it.
 *
 * The two halves are the same sentence read from opposite sides. Leaving is
 * possible and complete, for a person and for a shop, and neither is a promise
 * anyone has to take on trust.
 */

/**
 * The two probes that write a note need a household to write as. `exit/` had
 * one in a `beforeEach`; here each probe that needs one takes its own, which
 * is what the rest of the file already does.
 */
const household = () => freshHousehold();

/**
 * An offer taken all the way to a settlement, which is what the export has to
 * carry. `exit/` holds a copy of this for the household's side; the two are the
 * same sequence asked of different parties, and duplicating it is cheaper than
 * a shared helper that both suites would have to agree about.
 */
async function seedSomethingToMove() {
  const who = household();
  const offer = await createConformingOffer({ household: who });
  await call("POST", `/offers/${offer.id}/present`, {});
  await call("POST", `/candidates/${offer.candidates[0]!.id}/note`, {
    author: who,
    text: "kept for the smell",
    shared_with: [],
  });
  await decide(offer.id, {
    decisions: offer.candidates.map((c, i) => ({
      candidate: c.id,
      valence: i === 0 ? "kept" : "returned",
      ...(i === 0 ? { kept_as: "self" } : {}),
    })),
  });
  return offer;
}

describe("merchant-exit: a shop leaves with its ledgers (clauses 5, 43, §14.1)", () => {
  /**
   * Two clauses promised a merchant-side export and no route provided one
   * until 2026-09-09. What a shop cannot rebuild if it is left behind is the
   * catalogue: prices, makers, carriers and eligibility, version by version.
   */
  test("the export names its format and carries the catalogue and the offers", async () => {
    // NOTE (mutation check, 2026-09-09): merchant_export_drops_configs left
    // the catalogue out. This assertion failed. A shop that leaves without
    // its catalogue leaves without the half it cannot reconstruct.
    const who = await presenter();
    await createConformingOffer();
    const exported = await call("GET", `/presenters/${encodeURIComponent(who)}/export`);
    expect(exported.status).toBe(200);
    const shop = exported.body as {
      format: string;
      presenter: string;
      configs: { version: string; presenter: string }[];
      offers: { presenter: string }[];
      settlements: unknown[];
      notes: unknown[];
    };
    expect(shop.format).toBe("valence-merchant/1");
    expect(shop.presenter).toBe(who);
    expect(shop.configs.length).toBeGreaterThan(0);
    expect(shop.offers.length).toBeGreaterThan(0);
  });

  test("it carries no other presenter's offers", async () => {
    // NOTE (mutation check, 2026-09-09): merchant_export_leaks_others
    // exported every offer in the engine. This assertion failed. Clause 8:
    // a merchant holds what was declined to it and nothing declined elsewhere.
    const who = await presenter();
    const exported = await call("GET", `/presenters/${encodeURIComponent(who)}/export`);
    const shop = exported.body as {
      configs: { presenter: string }[];
      offers: { presenter: string }[];
    };
    for (const o of shop.offers) expect(o.presenter).toBe(who);
    for (const c of shop.configs) expect(c.presenter).toBe(who);
  });

  test("the export carries how each offer settled, and the shop's recovery rows", async () => {
    // NOTE (mutation check, 2026-09-10): merchant_export_drops_settlements and
    // merchant_export_drops_recoveries each empty one array. Both survived
    // before this probe existed: the three probes here asserted the format,
    // that configs and offers are non-empty, and that neither belongs to
    // another presenter, and nothing asserted the other two arrays at all.
    // §14.1 says what this specification owes the shop is that leaving is
    // possible and complete, and "complete" was resting on nothing.
    const who = await presenter();
    const offer = await seedSomethingToMove();
    const settled = await call("POST", `/offers/${offer.id}/settle`, {});
    expect(settled.status).toBe(200);

    // A digital offer produces no recovery row, so asserting only that the
    // array exists let merchant_export_drops_recoveries survive. The shop's
    // recovery rows are the half of §14.1 that only the physical binding
    // writes, so one is placed and collected here.
    // A fresh household: the one above has been offered every product, and a
    // presenter with nothing new for a household makes it no offer (§5.1).
    // The export is the presenter's, so a second household belongs in it.
    const placed = await createConformingOffer({
      household: freshHousehold(),
      binding: "physical",
    });
    await call("POST", `/offers/${placed.id}/present`, {});
    const [head, ...tail] = placed.candidates;
    const collected = await call("POST", `/offers/${placed.id}/recovery`, {
      returned: tail.map((c) => c.id),
      consumed: [head!.id],
    });
    expect(collected.status).toBe(200);

    const exported = await call("GET", `/presenters/${encodeURIComponent(who)}/export`);
    expect(exported.status).toBe(200);
    const shop = exported.body as {
      offers: { id: string }[];
      settlements: { offer: string }[];
      recoveries: unknown[];
    };
    expect(shop.recoveries.length).toBeGreaterThan(0);
    // Every offer that settled is answered for in the export.
    expect(shop.settlements.length).toBeGreaterThan(0);
    expect(shop.settlements.some((s) => s.offer === offer.id)).toBe(true);
  });

  test("it carries only the lines a household shared with the merchant", async () => {
    // NOTE (mutation check, 2026-09-09): merchant_export_leaks_notes put
    // every line on the shop's candidates into its export. This assertion
    // failed, finding the private one. Clause 27: a line reaches the
    // merchant only when the writer shared it.
    const who = await presenter();
    const offer = await createConformingOffer();
    const [a, b] = offer.candidates;
    await call("POST", `/candidates/${a!.id}/note`, {
      author: household(),
      text: "a line the maker may read",
      shared_with: ["merchant"],
    });
    await call("POST", `/candidates/${b!.id}/note`, {
      author: household(),
      text: "a line kept to myself",
      shared_with: [],
    });
    const exported = await call("GET", `/presenters/${encodeURIComponent(who)}/export`);
    const notes = (exported.body as { notes: { text: string }[] }).notes;
    const texts = notes.map((n) => n.text);
    expect(texts).toContain("a line the maker may read");
    expect(texts).not.toContain("a line kept to myself");
  });
});
