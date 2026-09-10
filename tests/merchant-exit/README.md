# merchant-exit

**Clauses 5 and 43, and specification §14.1.**

A shop leaves with its ledgers: the catalogue version by version, its own
offers, how each settled, and the recovery rows the physical binding wrote.

## Why it is not part of `exit/`

It was, until 2026-09-11. §13.1 then gave an implementation two roles it may
present, and the two halves of "leaving is possible and complete" turned out to
sit on opposite sides of that line: **a person's node move is the hub's surface
and a shop's export is the engine's.** A suite that asked for both could not be
pointed at either role alone, which is the thing the roles were named for.

The two suites are the same sentence read from opposite sides, and neither is a
promise anyone has to take on trust.

## What a failure means

**An export whose `settlements` or `recoveries` are empty**: "complete" is
resting on nothing. Both arrays went unasserted until 2026-09-10, and a
mutation emptying either survived, which is how the gap was found rather than
argued.

**An export carrying another presenter's offers**: the shop is leaving with
somebody else's ledger, and clause 8's vertical view has been widened by the
route that was supposed to end the relationship.

**An export carrying a household's private line**: clause 27 lets a writer say
who sees a line, and an export that ignores that has made the merchant a reader
the writer did not choose.

**An export carrying a delivery**: §7.5b keeps the code on the person's side, and
a platform move would otherwise hand the receiving platform every household's
tracking number.

## What it does not reach

Whether the shop can actually load what it exported anywhere else. The format is
`valence-merchant/1` and the probe asks that the fields are there and are the
shop's own. A second implementation to import it into is what would close that,
and there is one implementation.
