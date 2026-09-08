# binding

**Specification §3.2, §6.2 and §11, and §13 condition 8.**

A household is never billed for goods that were lost, and a candidate that was
consumed while being tried settles at cost rather than at price.

## Why it is a suite of its own

Both `lost` and `consumed` exist only in the physical binding. Every other
suite here runs the digital one, where there are no goods in a household's
hands to lose, so nothing in them could ever have reached condition 8.

An implementation that offers only the digital binding cannot fail these
clauses, and that is a real answer rather than an untested one. The deployment
declares what it implements in `VALENCE_BINDINGS`, and the suite runs the
physical probes or the absence probes accordingly. Neither branch is skipped.

## What a failure means

**Billing for `lost`** turns a loss rate into a receivable. §3.2 puts loss on
whoever holds stock risk, and the trust model is the point: a household that
can be charged for a parcel it never received has been made to insure the
merchant's logistics.

**Settling `consumed` at price** makes trying the same as buying. §6.2 exists so
that trying is neither free nor full price, and clause 18 requires sampling
before giving. An implementation that charges the price has removed the middle
term.

## The probe that was missing

The first version checked the three amounts a settlement reports and passed
against an implementation that added `lost_amount` to what the ledger committed.
Everything it reported was true; the bill was not the breakdown.

That is why §6 of the specification now names a `charged` amount, required to
equal `kept_amount + consumed_amount`, and why a probe here checks the identity
rather than the parts. A receipt a household cannot reconcile against its own
charge is not a receipt.
