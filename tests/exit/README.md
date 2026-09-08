# exit

**Clauses 43, 52 and 53.**

A household exports what it holds, moves its node to another host intact, and
recovery is a power separate from reading.

## It needs two hosts, and that is the point

The suite talks to `VALENCE_BASE_URL` and to `VALENCE_SECOND_HOST_URL`, and the
second is empty of the household's node when the probes begin.

With one host the strongest question available is whether a file was produced,
which is the weakest reading of clause 43. Fullness is not a field list: a
surface added later can be missing from the export while the export still
matches its own schema. So the question here is whether the second host answers
the same questions the same way, and the probes ask each surface rather than
comparing documents.

That distinction earned itself immediately. A mutation that dropped settlements
from the export passed the equivalence probe, because no route read a
settlement back and so nothing asked. §9 of the specification gained
`GET /offers/{id}/settlement` as a result: a receipt a household cannot ask for
again is one it can lose by closing a tab.

## What a failure means

**Export**: the member cannot leave. Clause 43 is what makes the default host
replaceable in practice rather than in principle, and an export that omits
something quietly is worse than none, because it looks like a way out.

**Move**: the node is not the member's. If lineage stops resolving after a
move, the network has become a function of who hosts whom, which is what
clause 22 forbids in the other direction.

**Recovery**: a recoverer who can read is not a recoverer. The probe that
matters most here is the one about notification channels: a recoverer holding
the only channel can recover in silence, and clause 53's requirement to notify
the person becomes decorative.

## What it does not reach

The host is meant to be blind (clause 52), and these probes cannot see whether
it is. Blindness is a property of what the host stores, and a black-box probe
against the host's own API is asking the wrong party. Checking it needs the
storage, not the interface.

The export format's stability across versions is not checked either. The
probes assert that a format is named and that an unknown one is refused, which
is the part that is checkable today.
