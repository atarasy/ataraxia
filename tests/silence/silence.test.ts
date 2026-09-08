import { describe, expect, test } from "bun:test";
import {
  call,
  conformingOffer,
  createConformingOffer,
  sleep,
  soon,
} from "../lib/probe.js";

/**
 * Clauses 36, 37 and specification §2.2.
 *
 * An undecided digital offer creates no order at expiry, no configuration
 * makes silence into consent, and at most one reminder is sent.
 *
 * The probes wait out a real expiry rather than asking the implementation to
 * pretend one happened. An implementation that only expires on a nudge from
 * the presenter has left the default in the presenter's hands, which is the
 * arrangement clause 36 exists to forbid.
 */

const EXPIRY_MS = 2_000;

describe("silence: expiry", () => {
  test("an undecided digital offer settles at zero", async () => {
    // NOTE (mutation check, 2026-09-08): silence_is_consent made an
    // undecided candidate `kept` with kept_as `order` at expiry. This
    // assertion failed with a kept_amount of 5400.
    const offer = await createConformingOffer({ expires_at: soon(EXPIRY_MS) });
    const presented = await call("POST", `/offers/${offer.id}/present`, {});
    expect(presented.status).toBe(200);

    await sleep(EXPIRY_MS + 500);

    const settled = await call("POST", `/offers/${offer.id}/settle`, {});
    expect(settled.status).toBe(200);
    const settlement = settled.body as {
      kept_amount: number;
      consumed_amount: number;
    };
    expect(settlement.kept_amount).toBe(0);
    expect(settlement.consumed_amount).toBe(0);
  });

  test("every undecided candidate becomes returned, none kept", async () => {
    // NOTE (mutation check, 2026-09-08): silence_is_consent, as above.
    // This assertion failed on the valence of every candidate.
    const offer = await createConformingOffer({ expires_at: soon(EXPIRY_MS) });
    await call("POST", `/offers/${offer.id}/present`, {});
    await sleep(EXPIRY_MS + 500);

    const read = await call("GET", `/offers/${offer.id}`);
    expect(read.status).toBe(200);
    const body = read.body as {
      state: string;
      candidates: { valence: string }[];
    };
    expect(body.state).toBe("expired");
    expect(body.candidates.every((c) => c.valence === "returned")).toBe(true);
  });

  test("an expired offer cannot be decided", async () => {
    // NOTE (mutation check, 2026-09-08): decide_after_expiry allowed a
    // decision on an expired offer. This assertion failed with 200: an offer
    // that can still be decided after expiry has no expiry.
    const offer = await createConformingOffer({ expires_at: soon(EXPIRY_MS) });
    await call("POST", `/offers/${offer.id}/present`, {});
    await sleep(EXPIRY_MS + 500);

    const decided = await call("POST", `/offers/${offer.id}/decisions`, {
      decisions: [
        { candidate: offer.candidates[0]!.id, valence: "kept", kept_as: "self" },
      ],
    });
    expect(decided.status).toBe(409);
  });
});

describe("silence: no configuration makes it consent", () => {
  test("an offer cannot declare a default of kept", async () => {
    // NOTE (mutation check, 2026-09-08): strict-drops-unknown. All four
    // shapes returned 201 with the field discarded, and this assertion failed.
    for (const bypass of [
      { default_valence: "kept" },
      { on_expiry: "keep" },
      { auto_confirm: true },
      { silence_is_consent: true },
    ]) {
      const created = await call("POST", "/offers", conformingOffer(bypass));
      expect(created.status).toBe(400);
    }
  });

  test("a header does not turn silence into an order", async () => {
    // NOTE (mutation check, 2026-09-08): silence_is_consent, as above.
    // The headers are inert either way; what this probe catches is an expiry
    // default that was changed anywhere at all.
    const offer = await createConformingOffer({ expires_at: soon(EXPIRY_MS) });
    await call("POST", `/offers/${offer.id}/present`, {});
    await sleep(EXPIRY_MS + 500);

    const settled = await call(
      "POST",
      `/offers/${offer.id}/settle`,
      {},
      { "x-on-expiry": "keep", "x-auto-confirm": "true" }
    );
    expect(settled.status).toBe(200);
    expect((settled.body as { kept_amount: number }).kept_amount).toBe(0);
  });
});

describe("silence: reminders (clause 37)", () => {
  test("the second reminder is refused", async () => {
    // NOTE (mutation check, 2026-09-08): many_reminders raised the
    // limit to five. This assertion failed with 200 on the second call.
    const offer = await createConformingOffer();
    await call("POST", `/offers/${offer.id}/present`, {});
    const first = await call("POST", `/offers/${offer.id}/remind`, {});
    expect(first.status).toBe(200);
    const second = await call("POST", `/offers/${offer.id}/remind`, {});
    expect(second.status).toBe(409);
  });

  test("the refusal is not a rate limit a caller waits out", async () => {
    // NOTE (mutation check, 2026-09-08): many_reminders, as above.
    // This assertion failed on the same call a second later.
    const offer = await createConformingOffer();
    await call("POST", `/offers/${offer.id}/present`, {});
    await call("POST", `/offers/${offer.id}/remind`, {});
    await sleep(1_100);
    const again = await call("POST", `/offers/${offer.id}/remind`, {});
    expect(again.status).toBe(409);
    expect(again.text.toLowerCase()).not.toContain("retry");
  });
});

describe("silence: the ceremonial default (clause 28, §2.2, §12)", () => {
  /**
   * The third row of the §2.2 table, and the only one where expiry ships
   * something. A recipient who chooses nothing still receives, because the
   * giver has already paid a price band and clause 28 forbids earning
   * anything from an offer nobody redeemed.
   *
   * This is also the row where an implementation can be quietly profitable by
   * doing nothing, which is why it is worth a probe of its own.
   */
  test("exactly one candidate is defaulted and the rest returned", async () => {
    // NOTE (mutation check, 2026-09-08): unredeemed_revenue removed the
    // ceremonial branch, so every candidate expired as `returned`. This
    // assertion failed: nothing was defaulted, and the giver's price band was
    // kept by the presenter.
    const offer = await createConformingOffer({
      purpose: "ceremonial",
      expires_at: soon(EXPIRY_MS),
    });
    await call("POST", `/offers/${offer.id}/present`, {});
    await sleep(EXPIRY_MS + 500);

    const read = await call("GET", `/offers/${offer.id}`);
    expect(read.status).toBe(200);
    const body = read.body as {
      candidates: { valence: string; unit_price: number; quantity: number }[];
    };
    const defaulted = body.candidates.filter((c) => c.valence === "defaulted");
    expect(defaulted.length).toBe(1);
    expect(
      body.candidates.filter((c) => c.valence === "returned").length
    ).toBe(body.candidates.length - 1);

    const settled = await call("POST", `/offers/${offer.id}/settle`, {});
    expect(settled.status).toBe(200);
    const settlement = settled.body as { kept_amount: number };
    // Charged for the one that shipped, and for nothing else.
    expect(settlement.kept_amount).toBe(
      defaulted[0]!.unit_price * defaulted[0]!.quantity
    );
  });
});

describe("settlement: the offer's own prices (§6.3, §3.1)", () => {
  test("a settlement charges the prices frozen on the offer", async () => {
    // NOTE (mutation check, 2026-09-08): settle_at_current_price made the
    // settlement read the presenter's live catalogue instead of the version
    // stamped on the offer. Against a single catalogue version the amounts
    // agree, so this probe did NOT catch it, and the note says so rather than
    // claiming a catch it did not make. What it does catch is a settlement
    // that charges anything other than the candidate prices the household was
    // shown, which `leak_field_offer_view` and `accepts-unit-price` approach
    // from the other side.
    const offer = await createConformingOffer();
    await call("POST", `/offers/${offer.id}/present`, {});
    const read = await call("GET", `/offers/${offer.id}`);
    const candidates = (read.body as {
      candidates: { id: string; unit_price: number; quantity: number }[];
    }).candidates;

    await call("POST", `/offers/${offer.id}/decisions`, {
      decisions: candidates.map((c, i) => ({
        candidate: c.id,
        valence: i === 0 ? "kept" : "returned",
        ...(i === 0 ? { kept_as: "self" } : {}),
      })),
    });
    const settled = await call("POST", `/offers/${offer.id}/settle`, {});
    expect(settled.status).toBe(200);
    expect((settled.body as { kept_amount: number }).kept_amount).toBe(
      candidates[0]!.unit_price * candidates[0]!.quantity
    );
  });
});
