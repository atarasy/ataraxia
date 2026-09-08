# binding

**Specification §3.2, §6.2 and §11, and §13 condition 8.**

A household is never billed for goods that were lost, and a candidate that was
consumed while being tried is bought at the merchant's price, unless it was
given, and a gift is never billed to the person who received it. There is no
cost of goods anywhere a household can read (clause 10, §6.2).

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

**Billing a gift, or settling other used goods at a fraction of the price**, is the cost basis coming back. §6.2 had a middle term until
2026-09-09, when charging a household the presenter's cost was judged to price
the same goods two ways and to put a number in a receipt that is the maker's
business. Two bases remain and no third.

## The probe that was missing

The first version checked the three amounts a settlement reports and passed
against an implementation that added `lost_amount` to what the ledger committed.
Everything it reported was true; the bill was not the breakdown.

That is why §6 of the specification now names a `charged` amount, required to
equal `kept_amount + consumed_amount`, and why a probe here checks the identity
rather than the parts. A receipt a household cannot reconcile against its own
charge is not a receipt.


## Recovery, added 2026-09-09

The rest of §11, built when the Stage 0 replenishment customer was decided as a
type whose decision criterion is recovery in item count.

The rule these probes exist for is that **silence means different things in the
two bindings**. §2.2 makes an undecided digital candidate `returned` at expiry,
because an order is a debt and none should be created by silence. A physical
candidate cannot follow that rule: the goods are in someone's home, nobody has
looked at them, and recording them as returned is a claim about the world.

So only two things resolve an undecided physical candidate. The collection says
what came back unopened and what was used, and the deadline says the rest is
lost. `physical_expiry_returns` is the mutation that applies the digital rule to
the physical binding, and it is the one worth understanding before changing
anything here.

The loss probe runs only where the deployment declares a grace of zero days. A
probe that waited a fixed interval against a three-day grace would never reach
the deadline and would report that the rule works.
