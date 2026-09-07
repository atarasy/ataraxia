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
