import { describe, expect, test } from "bun:test";
import {
  call,
  conformingOffer,
  createConformingOffer,
  decide,
  sleep,
  soon,
} from "../lib/probe.js";

/**
 * Specification §2.1, and §13 condition 1.
 *
 * The transitions the other suites do not reach. `silence/` covers expiry and
 * `binding/` covers settlement, and between them they leave `withdraw`, a
 * partial decision, and the rule that `settled` is terminal.
 *
 * None of these is a prohibition the constitution makes. They are the shape of
 * the machine, and an implementation that gets them wrong is not doing
 * something forbidden so much as failing to do something required: an offer
 * that can be decided after it settles has no settlement, and one that cannot
 * be decided twice forces a household to answer everything at once.
 */

describe("machine: withdraw (§2.1)", () => {
  test("withdrawing returns every undecided candidate and charges nothing", async () => {
    // NOTE (mutation check, 2026-09-09): withdraw_keeps_decided left the
    // undecided candidates as `offered` and settled the kept one. This
    // assertion failed on the valences. A presenter that revokes an offer
    // cannot leave a household holding candidates in an undecided state, and
    // cannot charge for the revocation.
    const offer = await createConformingOffer();
    await call("POST", `/offers/${offer.id}/present`, {});

    const withdrawn = await call("POST", `/offers/${offer.id}/withdraw`, {});
    expect(withdrawn.status).toBe(200);
    const body = withdrawn.body as {
      state: string;
      candidates: { valence: string }[];
    };
    expect(body.state).toBe("withdrawn");
    expect(body.candidates.every((c) => c.valence === "returned")).toBe(true);
  });

  test("a withdrawn offer cannot be decided or settled", async () => {
    // NOTE (mutation check, 2026-09-09): withdraw_is_not_final left the
    // candidates open and allowed a decision afterwards. Either alone is
    // caught by another rule; together they are the state a presenter
    // needs to reopen an offer it revoked. This assertion failed.
    const offer = await createConformingOffer();
    await call("POST", `/offers/${offer.id}/present`, {});
    await call("POST", `/offers/${offer.id}/withdraw`, {});

    const decided = await decide(offer.id, {
      decisions: [
        { candidate: offer.candidates[0]!.id, valence: "kept", kept_as: "self" },
      ],
    });
    expect(decided.status).toBe(409);

    const settled = await call("POST", `/offers/${offer.id}/settle`, {});
    expect(settled.status).toBe(409);
  });

  test("a signed decision cannot be withdrawn from under the household", async () => {
    // NOTE (mutation check, 2026-09-09): withdraw_after_decision let a
    // presenter withdraw a decided offer. This assertion failed with 200:
    // the household's signed keep was voided and the settle that followed
    // was refused. §2.1 lets withdraw leave from drafted or presented only.
    const offer = await createConformingOffer();
    await call("POST", `/offers/${offer.id}/present`, {});
    await decide(offer.id, {
      decisions: offer.candidates.map((c, i) => ({
        candidate: c.id,
        valence: i === 0 ? "kept" : "returned",
        ...(i === 0 ? { kept_as: "self" } : {}),
      })),
    });
    const withdrawn = await call("POST", `/offers/${offer.id}/withdraw`, {});
    expect(withdrawn.status).toBe(409);
    const settled = await call("POST", `/offers/${offer.id}/settle`, {});
    expect(settled.status).toBe(200);
  });

  test("withdrawing twice is refused", async () => {
    // NOTE (mutation check, 2026-09-09): withdraw_twice allowed it. A
    // second withdrawal of an offer already withdrawn is a presenter
    // losing track of its own state. This assertion failed.
    const offer = await createConformingOffer();
    await call("POST", `/offers/${offer.id}/present`, {});
    expect((await call("POST", `/offers/${offer.id}/withdraw`, {})).status).toBe(200);
    expect((await call("POST", `/offers/${offer.id}/withdraw`, {})).status).toBe(409);
  });
});

describe("machine: an offer may be decided partially (§2.1)", () => {
  test("a subset can be decided, and the rest decided later", async () => {
    // NOTE (mutation check, 2026-09-09): decide_all_or_nothing refused a
    // decision that did not name every candidate. This assertion failed on the
    // first call. §2.1 permits a partial decision explicitly, and an
    // implementation that demands all of them makes a household answer for
    // items it has not looked at yet.
    const offer = await createConformingOffer();
    await call("POST", `/offers/${offer.id}/present`, {});

    const [first, ...rest] = offer.candidates;
    const partial = await decide(offer.id, {
      decisions: [{ candidate: first!.id, valence: "returned" }],
    });
    expect(partial.status).toBe(200);
    expect((partial.body as { state: string }).state).toBe("presented");

    const remainder = await decide(offer.id, {
      decisions: rest.map((c) => ({ candidate: c.id, valence: "returned" })),
    });
    expect(remainder.status).toBe(200);
    expect((remainder.body as { state: string }).state).toBe("decided");
  });

  test("deciding the same candidate twice is refused", async () => {
    // NOTE (mutation check, 2026-09-09): decide_twice_overwrites let a
    // second decision overwrite the first. A presenter could then ask
    // again until it got the answer it wanted. This assertion failed.
    // The other half of partial deciding. If a second decision overwrote the
    // first, a presenter could ask again until it got the answer it wanted.
    const offer = await createConformingOffer();
    await call("POST", `/offers/${offer.id}/present`, {});
    const first = offer.candidates[0]!;

    await decide(offer.id, {
      decisions: [{ candidate: first.id, valence: "returned" }],
    });
    const again = await decide(offer.id, {
      decisions: [{ candidate: first.id, valence: "kept", kept_as: "self" }],
    });
    expect(again.status).toBe(409);
  });
});

describe("machine: settled is terminal (§2.1)", () => {
  test("an offer nobody has decided cannot be settled (clause 31)", async () => {
    // NOTE (mutation check, 2026-09-09): settle_anything let an offer be
    // settled in any state. Both assertions failed with 200: a drafted
    // offer and a presented one were closed before the household had
    // decided anything, which is a terminal action the agent took alone.
    const drafted = await createConformingOffer();
    const early = await call("POST", `/offers/${drafted.id}/settle`, {});
    expect(early.status).toBe(409);

    const presented = await createConformingOffer();
    await call("POST", `/offers/${presented.id}/present`, {});
    const undecided = await call("POST", `/offers/${presented.id}/settle`, {});
    expect(undecided.status).toBe(409);
  });

  test("nothing moves an offer out of settled", async () => {
    // NOTE (mutation check, 2026-09-09): settled_is_not_terminal allowed a
    // withdraw after settlement. This assertion failed. §2.1 says corrections
    // are new offers, and an offer that can leave `settled` has a receipt that
    // means nothing.
    const offer = await createConformingOffer();
    await call("POST", `/offers/${offer.id}/present`, {});
    await decide(offer.id, {
      decisions: offer.candidates.map((c, i) => ({
        candidate: c.id,
        valence: i === 0 ? "kept" : "returned",
        ...(i === 0 ? { kept_as: "self" } : {}),
      })),
    });
    const settled = await call("POST", `/offers/${offer.id}/settle`, {});
    expect(settled.status).toBe(200);

    for (const action of ["present", "withdraw", "remind"]) {
      const after = await call("POST", `/offers/${offer.id}/${action}`, {});
      expect(after.status).toBe(409);
    }
    const decided = await decide(offer.id, {
      decisions: [{ candidate: offer.candidates[0]!.id, valence: "returned" }],
    });
    expect(decided.status).toBe(409);
  });

  test("settling twice returns the same settlement rather than charging again", async () => {
    // NOTE (mutation check, 2026-09-09): settled_is_not_terminal let an
    // offer leave the settled state, which is the same defect from the
    // other side. This assertion failed.
    const offer = await createConformingOffer();
    await call("POST", `/offers/${offer.id}/present`, {});
    await decide(offer.id, {
      decisions: offer.candidates.map((c, i) => ({
        candidate: c.id,
        valence: i === 0 ? "kept" : "returned",
        ...(i === 0 ? { kept_as: "self" } : {}),
      })),
    });
    const first = await call("POST", `/offers/${offer.id}/settle`, {});
    const second = await call("POST", `/offers/${offer.id}/settle`, {});
    expect(second.status).toBe(200);
    expect((second.body as { receipt: string }).receipt).toBe(
      (first.body as { receipt: string }).receipt
    );
  });
});

describe("machine: an offer cannot be presented twice or out of order", () => {
  test("presenting a drafted offer twice is refused", async () => {
    // NOTE (mutation check, 2026-09-09): present_twice allowed it, which
    // reserves twice against the same household for one offer. This
    // assertion failed.
    const offer = await createConformingOffer();
    expect((await call("POST", `/offers/${offer.id}/present`, {})).status).toBe(200);
    expect((await call("POST", `/offers/${offer.id}/present`, {})).status).toBe(409);
  });

  test("a drafted offer cannot be decided before it is presented", async () => {
    // NOTE (mutation check, 2026-09-09): decide_before_present allowed it.
    // Deciding what has not been shown is a decision the household did not
    // make. This assertion failed.
    const offer = await createConformingOffer();
    const decided = await decide(offer.id, {
      decisions: [{ candidate: offer.candidates[0]!.id, valence: "returned" }],
    });
    expect(decided.status).toBe(409);
  });

  test("an offer that has already expired cannot be presented", async () => {
    // NOTE (mutation check, 2026-09-09): present_expired removed the
    // check. An offer presented after its expiry is one whose default has
    // already fired. This assertion failed.
    const created = await call(
      "POST",
      "/offers",
      conformingOffer({ expires_at: Date.now() - 1000 })
    );
    if (created.status !== 201) {
      // Refusing to create it at all is the stronger answer.
      expect([400, 422]).toContain(created.status);
      return;
    }
    const offer = created.body as { id: string };
    const presented = await call("POST", `/offers/${offer.id}/present`, {});
    expect([409, 422]).toContain(presented.status);
  });
});
