# floor

**Clause 26, and specification §5.**

An offer below the exploration floor is refused with `422`, no configuration
bypasses the check, and the rate cannot reach zero. Since 2026-09-09 an
exploration candidate is one this household has never been offered by this
presenter; a low prediction on a known product no longer qualifies. A
presenter with nothing new for a household makes it no offer at all, rather
than an offer with no exploration: a cap of that shape was written and
withdrawn the same day, because it made selling out reachable for any small
catalogue.

## What a failure means

The implementation can be made to sell out. Clause 26 exists because an engine
that maximises the kept ratio stops exploring, removes the household's freedom
to decline, and destroys the only output that cannot be obtained elsewhere.
Selling out is meant not to be an achievable state, and a failure here means it
is one.

## Both sides of the formula

`floor(n) = max(1, ceil(n * rate))`, and an implementation can be wrong in
either direction. One short of the floor takes the choice from the household.
More than the floor takes it from whoever set the rate, by running at a rate
higher than the deployment declared.

The suite therefore asks the deployment for its rate rather than assuming one,
and checks the boundary from both sides. The first version of this suite did
not, and a mutation that demanded twice the declared rate passed it. See
`../MUTATIONS.md`.

## Bypasses probed

A request field claiming the floor is met, a per-offer rate, a skip flag, a
floor of zero, and two headers. All are refused, and the refusal is a `422` or
a `400` rather than a silently ignored field.
