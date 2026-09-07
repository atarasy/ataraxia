# Conformance tests

An implementation that passes these may use the Ataraxia mark. One that stops passing loses it. That is the only sanction, and it is deliberately the only one.

Anyone can run them, against anyone's implementation, including ours. There is no private suite and no certification body to apply to.

## What is testable, and what is not

Most of the constitution is not mechanically checkable. Whether a foundation sells governance seats, whether a brand bought a slot, whether the founder kept a promise — none of that is decided by a test run.

What *is* checkable is a specific and useful subset: **capabilities that must be absent, and behaviours that must be refused.** A clause that says a field does not exist can be checked by looking for the field. A clause that says an order is never created by silence can be checked by staying silent.

So these tests are not a certificate of good conduct. They check the parts of the constitution that were deliberately written to be structural rather than promissory, which is the reason the constitution was written that way.

## Suites

| Suite | Clauses | What it checks |
|---|---|---|
| [`absence/`](absence/) | 31, 32, 33, 34, and §9.1 of the spec | Capabilities that must not exist: discount objects, ratings, urgency fields, per-person event stores, tracking sockets, broadcast and segment routes |
| [`floor/`](floor/) | 30 | An offer below the exploration floor is refused with `422`, no configuration bypasses the check, and the rate cannot reach zero |
| [`silence/`](silence/) | 36, 37, and spec §2.2 | An undecided digital offer creates no order at expiry; no configuration makes silence into consent; at most one reminder is sent |
| [`opacity/`](opacity/) | 19, 21, 22 | No response surface discloses or permits inference of recipient inaction; reciprocation is never prompted; a recipient's record holds nothing but the fact of receipt |
| [`exit/`](exit/) | 47, 61, 62 | Full export in a documented format; a node moves host intact; recovery and routine reading are separate powers and recovery is logged |

Each suite has its own README stating exactly what it probes and what a failure means.

## Two things worth knowing before writing a test here

**Absence is harder to test than presence.** A field that is not in the response may still be inferable from what is. `opacity/` in particular has to probe for inference — response timing, array lengths, the presence or absence of an optional object — not merely for a named field. Tests that check only for field names give false assurance.

**A test that cannot fail is not a test.** Each test here carries a note recording how it was shown to fail: what was changed in a reference implementation to break it, and that the test caught it. A test added without that note is not counted.

## Running

No harness yet. The reference implementation does not exist, and writing a runner before there is anything to run against would fix the wrong interface.

The first suites will be written against the [Valence](https://github.com/atarasy/valence) specification's §13 conformance list, as HTTP-level probes with no dependency on any particular language or framework.

## Status

Scaffold, September 2026. The suites above are named and scoped; none is written. This directory exists because the README promises it, and an unkept promise in a repository about not making unkeepable promises is worse than an empty directory.
