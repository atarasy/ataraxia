# floor

**Clause 30, and specification §5.**

An offer below the exploration floor is refused with `422`, no configuration
bypasses the check, and the rate cannot reach zero.

## What a failure means

The implementation can be made to sell out. Clause 30 exists because an engine
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
