# silence

**Clauses 36 and 37, and specification §2.2.**

An undecided digital offer creates no order at expiry, no configuration turns
silence into consent, and at most one reminder is sent.

## What a failure means

An order is a debt. An implementation that creates one because a household said
nothing has made not answering expensive, which is the arrangement clause 36
exists to forbid.

## The probes wait

They let a real expiry pass rather than asking the implementation to pretend
one happened. An implementation that only expires an offer when the presenter
asks it to has left the default in the presenter's hands, and a probe that
nudges it would not notice.

The cost is that this suite takes a few seconds where the others take
milliseconds. That is the right trade: the mutation that makes silence into
consent is caught by three probes here and by nothing in the other two suites.

## Reminders

The second reminder is refused, and refused again a second later. Clause 37 is
a count, not a rate limit, and an implementation that returns a retry-after has
turned a prohibition into a delay.
