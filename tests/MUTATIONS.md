# Mutation ledger

A test that cannot fail is not a test. Every probe in these suites was run
against a reference implementation that had been deliberately broken, and this
file records which break each one caught.

The mutations live with the reference implementation, in
`valence-engine/scripts/mutations/`, and are applied and reverted by
`scripts/mutate.sh`. Rerunning them is one command per row.

Measured 2026-09-08 against the Valence reference engine at commit `3d46435`,
running the digital binding with an exploration rate of 0.2, and again at 0.6
for the two rows that say so.

| Mutation | What it changed | Probes that failed |
|---|---|---|
| `route-discounts` | Registered `POST /discounts`, returning 201 | 1 |
| `route_get_segments` | Registered `GET /segments`, returning 200 | 1 |
| `strict-drops-unknown` | The body check discards unknown fields instead of refusing them | 5 |
| `accepts-unit-price` | `unit_price` accepted from the request and stored on the candidate | 1 |
| `leak_field_offer_view` | Added `rating: 4` to the candidate serialisation | 1 |
| `leak_field_settlement` | Added `tracking_id` to the settlement record | 1 |
| `list_total` | Added `total` beside `offers` in the household's list | 1 |
| `lineage_acts_total` | Added `network_size` beside `acts` | 1 |
| `balance_route` | Registered `GET /households/{id}/balance` returning 0 | 1 |
| `invent_product` | A missing catalogue entry falls back to a price of 1000 | 1 |
| `no_floor` | The exploration floor check disabled | 5 |
| `floor_bypass_field` | `exploration_floor_met` accepted from the request and honoured | 1 |
| `floor_too_strict` | Comparison tightened to `marked <= required` | 1 |
| `floor_off_by_one` | Comparison weakened to `marked < required - 1` | 5, and 2 more at rate 0.6 |
| `silence_is_consent` | An undecided digital candidate becomes `kept` at expiry | 3 |
| `many_reminders` | The reminder limit raised from one to five | 2 |
| `decide_after_expiry` | Decisions accepted on an expired offer | 1 |
| `no_reserve_ceiling` | The ledger accepts a commit above the reserved amount | 1, in the engine's own tests |

## What this exercise found

**A suite can be wholly green and still miss the mutation it exists for.**
`floor_too_strict` survived the first version of these suites. Every floor
probe asked whether an offer *below* the floor is refused, and the conforming
offer they compared against carried five exploration candidates where the
deployment's floor was one. An implementation demanding twice the declared rate
would have passed. The two boundary probes were added for that, and the
deployment now declares its rate to the suite so the formula in §5 can be
checked from both sides.

**Two probes that look redundant are not.** The forbidden-field walk runs
separately over an offer and over a settlement because they are built in
different layers: `leak_field_offer_view` shows in one and `leak_field_settlement`
in the other, and neither shows in both.

**One row here is not an HTTP probe.** The reserve ceiling (§6.4) is checked in
the engine's own tests rather than over the wire, because a settlement above
the reserve is refused before any response is shaped and the failure a
household would see is indistinguishable from an ordinary decline. Testing it
from outside needs a ledger the probe can read, which is a fixture the
specification does not describe. This is a gap, and it is named rather than
papered over: an implementation could satisfy every probe here and still let a
settlement exceed what the household authorised.
