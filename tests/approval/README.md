# approval

**Clauses 6, 38, 39, 40, 63, 67 and 68, and specification §10.**

The screen a household is asked to sign, drawn by a party to no transaction.

## What makes it different from the other suites

Every other suite here checks something an implementation must not do. This one
checks three things it must: carry the alternatives a proposal was chosen
against, carry the argument against taking it, and say why anything was left
out.

The fourth probe is what makes the first three mean anything. Clause 63 says
the approval screen is drawn by a party to no transaction, and a contract
through which a merchant can pass markup, a style, an image or an ordering
directive is a screen the merchant draws, whatever else it carries. So the
suite walks the response for presentation fields under any spelling, and reads
the raw text for tags in case a field named innocently carries one.

## What a failure means

**No alternatives, no argument against**: the household's tap is a formality.
An agent that proposes without saying what else it considered has asked for
assent rather than a decision, and clause 68 exists so that it is a decision.

**No reason for an exclusion**: clause 40 is the only place the specification
reports what did not happen. Nothing else on any surface tells a person why the
thing they expected is absent.

**Presentation in the contract**: clause 63 is false. Not weakened, false.

**A standing mandate with no lapse**: the blanket consent clause 41 removes
from the settings screen has arrived by another door. Clause 67 says a standing
mandate lapses unless renewed, and a mandate recorded without a lapse never
does.

## What it does not reach

Clause 63 asks that the screen be drawn by a party to no transaction, and these
probes can only check that the data carries no drawing. Who actually renders it
is not visible to an HTTP probe.

The obligation in the vault's surfaces specification that opening the screen
must not be observable by the merchant is not checked here either. It is a
property of when a hub fetches, and a probe that asks the hub cannot see what
the hub told the merchant.
