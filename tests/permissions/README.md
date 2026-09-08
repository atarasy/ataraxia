# permissions

**Clauses 37 to 42, and clause 20, and specification §7.4.**

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

## What it does not reach

Whether a grantee actually respects its scope. These probes check the shape of
the ledger, and enforcement lives wherever the data is read. Checking that
needs a grantee to impersonate and a read to attempt, which is a suite against
an implementation that authenticates.
