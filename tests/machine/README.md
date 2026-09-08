# machine

**Specification §2.1, and §13 condition 1.**

The transitions the other suites do not reach: `withdraw`, a partial decision,
and the rule that `settled` is terminal.

## Why it exists separately

`silence/` covers expiry and `binding/` covers settlement, and between them
condition 1 was still partial: four transitions had no probe. They are not
prohibitions the constitution makes, which is why they were the last to be
written and why they are easy to leave out.

They matter anyway. An offer that can be decided after it settles has a receipt
that means nothing. One that cannot be decided twice forces a household to
answer for everything at once, which is the opposite of what clause 33's one
tap is for.

## What a failure means

The implementation has a state machine that is not this one, and the guarantees
the other suites check sit on top of it. A `withdraw` that leaves candidates
undecided leaves a household holding an offer nobody will settle; a `settled`
that is not terminal means a presenter can reopen a closed transaction.

## What it does not check

Nothing here reads the ledger. Whether a withdrawn offer released its hold is
in the engine's own tests, because the released hold is not visible on any
surface the specification defines.
