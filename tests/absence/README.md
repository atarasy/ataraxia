# absence

**Clauses 1, 2, 3, 8, 9, 11, 12, 27, 28, 29, 30, 49, and specification §3.3, §6, §7.5, §9.1.**

Capabilities that must not exist. A discount object, a star rating, an urgency
field, a per-person tracking identifier, a tracking socket, and the routes that
would carry segments and broadcasts. Since the clause review of 2026-09-09,
also the three structural clauses at the head of the constitution: no search,
ranking or discovery route (clause 1), no route that issues an identity
(clause 2), and no document that names a part the member could replace, the
model, the manager or a provider (clause 3). And clause 8: a presenter's view
of a household is its own offers and nothing declined to anyone else, and no
list can be asked for without naming a presenter. And clause 9: the
prediction that comes back is the prediction that was sent, so the platform
ran no model across nodes. And clause 27: a line reaches the merchant only
when the writer shared it, nothing turns lines into a number, and a line
cannot be shared with anyone but the recipient and the merchant.

## What a failure means

A field or a route the constitution says has no implementation has one. Clause
29 and clause 30 are claims about structure, not promises about conduct, so a
failure here is not a policy lapse to be corrected by an operator. It is the
clause being false.

## What these probes do that a field-name check does not

They walk the whole response document for a forbidden key at any depth, rather
than asserting on the fields the author of the probe happened to think of. A
capability that must not exist is easiest to reintroduce somewhere the reader
was not looking, and the mutation `leak_field_settlement` was caught by exactly
this and by nothing else.

They also check that a forbidden field is **refused** rather than ignored. An
implementation that accepts a body containing a discount, drops it, and returns
201 has told the caller the field exists. Five probes fail under the mutation
that makes the body check permissive, which is the largest blast radius of any
single break in the ledger.

## What they do not reach

Inference. A response that names no forbidden field can still disclose one
through timing, an array length, or the presence of an optional object. That is
the `opacity/` suite's subject and it is not written.
