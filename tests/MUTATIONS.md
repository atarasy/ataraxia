# Mutation ledger

A test that cannot fail is not a test. Every probe in these suites was run
against a reference implementation that had been deliberately broken, and this
file records which break each one caught.

The mutations are one Python script each, and applying and reverting them is
one command per row:

```
./scripts/mutate.sh no_floor python3 scripts/mutations/no_floor.py
```

Measured 2026-09-08 against the Valence reference engine, running the digital
binding at an exploration rate of 0.2, and again at 0.6 for the two rows that
say so. See "Where the engine is" at the end: it is not published yet, which
makes this ledger a record rather than something a reader can rerun today.

| Mutation | What it changed | Probes that failed |
|---|---|---|
| `route_discounts` | Registered `POST /discounts`, returning 201 | 1 |
| `route_get_segments` | Registered `GET /segments`, returning 200 | 1 |
| `strict_drops_unknown` | The body check discards unknown fields instead of refusing them | 5 |
| `accepts_unit_price` | `unit_price` accepted from the request and stored on the candidate | 1 |
| `leak_field_offer_view` | Added `rating: 4` to the candidate serialisation | 1 |
| `leak_field_settlement` | Added `tracking_id` to the settlement record | 1 |
| `list_total` | Added `total` beside `offers` in the household's list | 1 |
| `lineage_acts_total` | Added `network_size` beside `acts` | 1 |
| `balance_route` | Registered `GET /households/{id}/balance` returning 0 | 1 |
| `invent_product` | A missing catalogue entry falls back to a price of 1000 | 1 |
| `hide_presenter` | Dropped `presenter` from the offer serialisation | 1 |
| `no_floor` | The exploration floor check disabled | 5 |
| `pad_the_floor` | The check that a marked candidate qualifies as exploration removed, leaving the count | 1 |
| `floor_bypass_field` | `exploration_floor_met` accepted from the request and honoured | 1 |
| `floor_too_strict` | Comparison tightened to `marked <= required` | 1 |
| `floor_off_by_one` | Comparison weakened to `marked < required - 1` | 5, and 2 more at rate 0.6 |
| `hide_exploration` | Dropped `is_exploration` from the candidate serialisation | 1 |
| `silence_is_consent` | An undecided digital candidate becomes `kept` at expiry | 3 |
| `unredeemed_revenue` | The ceremonial branch removed, so nothing is defaulted at expiry | 1 |
| `many_reminders` | The reminder limit raised from one to five | 2 |
| `decide_after_expiry` | Decisions accepted on an expired offer | 1 |
| `reject_foreign_client` | Lineage edges refused unless the user-agent is the reference hub's | 3 |
| `accept_any_signature` | Signature verification removed from lineage acceptance | 1 |
| `hide_merchant` | Blanked `merchant` on the accepted edge | 1 |
| `profile_from_receipt` | Added a `preference` to each receipt row, derived from the product | 1 |
| `history_from_receipt` | Added the product to each receipt row | 1 |
| `no_reserve_ceiling` | The ledger accepts a commit above the reserved amount | 1, in the engine's own tests |
| `settle_at_current_price` | Settlement reads the live catalogue instead of the frozen version | **0. See below.** |

Every probe in the four suites appears in the "probes that failed" column of at
least one row, except the one named under `settle_at_current_price`.

## What this exercise found

**The floor was satisfiable by relabelling, and the specification allowed it.**
§5.1 said a candidate *may* be marked as exploration when it is below the
threshold or unknown to the household. That is a permission on the presenter
and it forbade nothing: an implementation could accept a candidate the model
fully expects to be kept, count it toward the floor, and pass every reading of
§5. Clause 30 would then cost nothing to obey. The specification was corrected
to forbid counting such a candidate, and `pad_the_floor` is the mutation that
now catches it.

**A suite can be wholly green and still miss the mutation it exists for.**
`floor_too_strict` survived the first version of these suites. Every floor
probe asked whether an offer *below* the floor is refused, and the conforming
offer they compared against carried five exploration candidates where the
deployment's floor was one. An implementation demanding twice the declared rate
would have passed. The deployment now declares its rate to the suite so the
formula in §5 can be checked from both sides.

**One mutation is recorded as caught by nothing.** `settle_at_current_price`
makes the settlement read the presenter's live catalogue instead of the version
frozen on the offer, which is a direct breach of §6.3. Against a single
catalogue version the two agree, so no probe sees it. Catching it needs a
second catalogue version at a changed price, which is a fixture the suite does
not yet ask for. The row stays in this table because a mutation that survives
is the most useful thing in it.

**Two probes that look redundant are not.** The forbidden-field walk runs
separately over an offer and over a settlement because they are built in
different layers: `leak_field_settlement` shows in one and
`leak_field_offer_view` in the other, and neither shows in both.

**One row here is not an HTTP probe.** The reserve ceiling (§6.4) is checked in
the engine's own tests, because a settlement above the reserve is refused
before any response is shaped and the failure a household would see is
indistinguishable from an ordinary decline. Testing it from outside needs a
ledger the probe can read, which is a fixture the specification does not
describe.

## What §13 actually gates

§13 lists eight conditions and says passing the tests is what entitles an
implementation to the mark. Three are covered, three partially, two not at all.
Counted against the probes, not asserted.

| §13 condition | Gated? | By what, or why not |
|---|---|---|
| 1 state machine and expiry defaults | partial | The digital and ceremonial rows of §2.2 are probed. The physical row, `withdraw`, partial decide, and "settled is terminal" are not |
| 2 exploration floor, no bypass | yes | Eleven probes, both sides of the formula, six bypass shapes, and padding |
| 3 no §9.1 route, no §3.3 field | yes | Ten route probes, three refusal probes, and a key walk over four documents. The walk does not cover every response shape |
| 4 no recipient inaction disclosed | **no** | Needs a giver's response surface and inference probes. This is `opacity/`, unwritten |
| 5 no household balance | partial | Two route shapes and six field names. The positive half of §6.1, that a trial is deducted rather than credited, is not exercised |
| 6 terms frozen at `config_version` | partial | A settlement is checked against the offer's own prices. Varying the catalogue between offer and settlement is not, and `settle_at_current_price` survives because of it |
| 7 lineage edges accepted regardless of client | yes | Three probes in `lineage/`, including two different clients and a tampered signature |
| 8 no household billed for `lost` | **no** | `lost` exists only in the physical binding and every probe runs the digital one |

An implementation that reprices a settlement against a newer catalogue, leaks
recipient inaction, and bills households for lost goods passes all 45 probes.
That is the honest state of the gate, and the two unwritten suites are where
two of the three gaps close.

## Where the engine is

The reference engine is a local repository with no remote. This ledger names
its mutations by file so they can be read alongside the probes, but a reader of
the public repository cannot rerun them today. Either the engine is published
or these rows stay a record of what was done rather than an invitation to
repeat it. The suites themselves have no such problem: they run against any
implementation, and the six variables in the README are all they need.
