# opacity

**Clauses 19, 21, 22 and 24, and specification §7.2, §7.4 and §7.5.**

No surface discloses that a recipient did not act, reciprocation is never
prompted, and a recipient's record holds the fact of receipt and nothing else.

## Why it was the last of the original five to be written

Absence is harder to test than presence, and this is where that bites. A
response that names no forbidden field can still report inaction through an
array's length, an optional object appearing, a timestamp, an identifier that
resolves, or a second surface a reader can difference against the first.

Probing for that needs surfaces to probe, and the reference work was an offer
engine with none. The surfaces were specified first, in the vault's
`04b_Spec_Hub_Surfaces.md`, and this suite follows that document's inference
tables rather than its field lists.

## What a failure means

A person acquired something by being given something: a profile, a record of
what they were given, or a place in someone else's list of people who have not
yet answered. Clause 19 is not about tact. A layer that reports silence back to
the giver has made not answering expensive, and the gift stops being a gift.

## The channels, and which ones close

| Channel | In this suite |
|---|---|
| A named field | Probed by name, in any spelling |
| Array length | Giving is checked to change nothing on the giver's surface |
| A period framing an empty response | The response is required to carry the acts key and nothing else |
| An identifier that resolves | Every string on a receipt is tried against two routes |
| Empty versus 404 | An unknown giver and a quiet one must answer alike |
| Response timing | Probed loosely, and the looseness is stated below |
| Two surfaces differenced | **Not closed.** See below |

## What this suite does not reach

**The circle and the acts stream can be differenced.** Clause 24 requires the
viewer's own circle to be shown, and clause 20 permits acts to be shown, so
both exist and a reader who holds both can subtract. Dropping the date and the
product from the viewer's own edges reduces what that yields to "A is in my
circle and has never acted", and nothing removes it.

**A giver's own memory is outside the system.** A giver knows who they gave to.
No design prevents them noticing that someone never wrote back.

**Timing is probed at a ratio of twenty.** That catches an implementation that
only queries a store when there is something to return. It cannot catch a
difference smaller than the noise on a loopback connection, and a probe that
tried would fail at random instead.
