# opacity

**Clauses 19, 21 and 22.** Not written.

No response surface discloses or permits inference of recipient inaction;
reciprocation is never prompted; a recipient's record holds nothing but the
fact of receipt.

## Why it is not written

Absence is harder to test than presence, and this suite is where that bites. A
field that is not in the response may still be inferable from what is: response
timing, an array's length, whether an optional object appears at all. Probing
for a named field would give false assurance, and probing for inference needs a
giver's response surface to probe against.

The reference work so far is an offer engine, not a hub, and it has no such
surface. Writing this suite against the engine would fix the wrong interface,
which is the objection the parent README started with.

## What it will need

A hub with a giver's surface, and probes that compare two households whose only
difference is that one recipient acted and one did not. Anything that differs
between the two responses is a disclosure, whatever it is called.
