# absence

**Clauses 31, 32, 33, 34, and specification §3.3, §7.5, §9.1.**

Capabilities that must not exist. A discount object, a star rating, an urgency
field, a per-person tracking identifier, a tracking socket, and the routes that
would carry segments and broadcasts.

## What a failure means

A field or a route the constitution says has no implementation has one. Clause
33 and clause 34 are claims about structure, not promises about conduct, so a
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
