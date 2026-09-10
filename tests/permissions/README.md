# permissions

**Clauses 9, 20, 37 to 42, 46, 47, 39 and 58, and specification §7.4, §7.5 and §16.**

Permission is asked at the moment of use, scoped and time-limited. The list is
always visible and each entry is revoked on its own.

## The ledger is a list of exceptions

Clause 38 makes the person's own agent the default recipient of their data,
which is not a permission. So the household never appears in its own ledger,
and a probe here tries to put it there. An entry for the person themselves
would be revocable, and revoking it would switch the hub off on its owner.

## What a failure means

**A grant with no live action**: blanket consent has returned wearing the shape
of a permission. Clause 37 removes it from the settings screen, and a ledger
that accepts a grant pointing at nothing has put it back.

**A permission with no expiry**: the same defect through a null. If an empty
field means unlimited, then unlimited is expressible, and clause 37's time
limit is a convention rather than a structure.

**A revocation that removes the row**: clause 40 says the list is always
visible, and a list that forgets what was revoked is not visible about the
past. A person cannot audit what they once gave away.

**A price on a permission**: clause 39 says no capability to sell data is
built. One column is the capability.

**A model named on a row**: clause 41 says changing the model behind an agent
moves neither the ledger nor the records. A ledger that records the model is
one that follows it.

## The mandate's thresholds (§16.3 to §16.6, added 2026-09-10)

Five probes here are not about permissions at all. They are about the other
thing clause 47 names, which is the protections a person sets while they have
capacity, and they live in this suite because the mandate does.

A person can set a daily ceiling across every presenter, name the merchant's
own categories that need a second signature on a decided set, and hold a signed
set for a cooling window with a route to take it back. **Each probe sets its
protection, uses it, and puts the mandate back.** A protection left on the
shared fixture would fail every suite that settles afterwards, which is the
shape of a mutation that breaks the fixture rather than one the corpus catches,
and it would be this suite's fault rather than the implementation's.

**Two of the five are about the shape of the rules rather than their effect.**
One asserts that an absent daily ceiling is not a ceiling of zero: "the person
set no limit" and "the person set one that refuses everything" are different
states and an implementation that confuses them refuses every settlement. The
other asserts the direction of change, that adding a category is the person's
alone and removing one waits on the co-signer. **A protection a person can
remove by themselves is not one, and a protection they cannot add by themselves
is a guardian.**

**A refusal must name itself.** Four refusals in §16 share a status code, and a
probe asserts the name each carries. This is the defect that let
`novelty_from_this_catalogue` survive every probe on an earlier run: two
different refusals sharing a status code and nothing else, so no probe and no
person could tell them apart.

## What it does not reach

Whether a grantee actually respects its scope. These probes check the shape of
the ledger, and enforcement lives wherever the data is read. Checking that
needs a grantee to impersonate and a read to attempt, which is a suite against
an implementation that authenticates.
