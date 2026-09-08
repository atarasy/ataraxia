# Mutation ledger

A test that cannot fail is not a test. Every probe in these suites was run
against a reference implementation that had been deliberately broken, and this
file records which break each one caught.

The mutations are one Python script each, in
[`atarasy/valence`](https://github.com/atarasy/valence) under
`engine/scripts/mutations/`. Applying and reverting one is a single command:

```
cd engine
./scripts/mutate.sh no_floor python3 scripts/mutations/no_floor.py
```

Measured 2026-09-08 against that engine, running the digital binding at an
exploration rate of 0.2, and again at 0.6 for the two rows that say so. Anyone
can repeat any row.

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
| `camel_tracking` | Four forbidden fields reintroduced in camelCase: `trackingId`, `stockRemaining`, `expiresInSeconds`, `starRating` | 2 |
| `coupon_and_surcharge` | A `surcharge` accepted on a candidate and added to the price, and a `coupon` accepted and stored | 1 |
| `per_person_events` | A per-person event store on `/analytics` and a pixel socket on `/px` | 1 |
| `reminder_rate_limit` | The reminder refusal turned into a five-second backoff | 1 |
| `silence_consent_non_exploration` | Ordinary candidates kept at expiry, exploration candidates returned | 3 |
| `no_reserve_ceiling` | The in-memory ledger accepts a commit above the reserved amount | 1, in the engine's own tests |
| `adapter_trusts_the_ledger` | The Meter adapter delegates the reserve ceiling to Meter | 1, in the engine's own tests |
| `sent_list_on_giver_surface` | The giver's own gifts added to the acts stream | 1 |
| `period_on_acts` | A `from` and `to` window framing the acts response | 1 |
| `nudge_route` | `POST /lineage/nudge` registered | 1 |
| `receipt_ref_resolves` | The edge id put back on the receipt, and a route that resolves it | 1 |
| `date_on_own_edges` | The date and product kept on the viewer's own lineage edges | 1 |
| `second_degree_circle` | The circle walked one hop further out | 1 |
| `bill_the_household_for_lost` | `lost_amount` added to what the ledger commits | 2 |
| `consumed_at_price` | A consumed candidate settled at price rather than cost | 1 |
| `credit_the_trial` | What was consumed accrued as a balance and taken off the next settlement | 1 |
| `withdraw_keeps_decided` | Withdrawing left the undecided candidates as `offered` | 1 |
| `decide_all_or_nothing` | A decision naming fewer than every candidate refused | 3 |
| `settled_is_not_terminal` | A withdraw accepted after settlement | 2 |
| `export_only_what_surfaces_show` | The export built from the giver's surface instead of the record | 2 |
| `export_drops_settlements` | Settlements left out of the export | 2 |
| `recoverer_owns_every_channel` | The requirement for a channel outside the recoverer's control removed | 1 |
| `anyone_can_recover` | The check that the caller is a named recoverer removed | 1 |
| `approval_without_deliberation` | The approval rendered from the offer alone, with no alternatives and no argument against | 1 |
| `drop_excluded_reasons` | The excluded list emptied on the way to the screen | 1 |
| `presentation_on_approval` | A banner and a rank added to every approval candidate | 1 |
| `standing_never_lapses` | A standing mandate accepted with no lapse | 1 |
| `grant_without_an_action` | A permission granted without a live action to point at | 1 |
| `permission_never_expires` | An expiry in the past accepted and treated as unlimited | 1 |
| `own_agent_is_a_grantee` | The household allowed to appear in its own permission ledger | 1 |
| `revoke_deletes_the_row` | Revoking removes the permission instead of stamping it | 2 |
| `compensation_on_permission` | A compensation figure added to each permission | 1 |
| `model_on_permission` | The model recorded on each permission | 1 |
| `empty_alternatives` | The check that a deliberation says anything removed, keeping only the check that it exists | 1 |
| `markup_in_argument` | The argument against wrapped in a div | 1 |
| `mandate_scope_blank` | The mandate's scope emptied | 1 |
| `reminded_never_true` | `reminded` always false, and a count of reminders left added | 1 |
| `refuse_every_grant` | Every permission grant refused | 2 |
| `empty_scope_ok` | A permission accepted with a scope naming nothing | 1 |
| `revoke_revokes_everything` | Revoking one permission stamps them all | 1 |
| `global_permissions_route` | `GET /permissions` registered, listing them to anyone | 1 |
| `no_recovery_on_present` | Presenting a physical offer opens no recovery | 2 |
| `collect_ignores_consumed` | The consumed list dropped from a collection | 2 |
| `physical_expiry_returns` | The digital expiry rule applied to the physical binding | 2 |
| `never_lost` | The loss deadline removed, so uncollected candidates stay undecided | 1 |
| `place_anything` | The eligibility check removed, and an unknown product given a price | 2 |
| `collect_twice` | A second collection accepted for one offer | 1 |
| `returned_and_consumed_ok` | A candidate accepted as both returned and consumed | 1 |
| `search_route` | `GET /search` registered, returning a ranked list | 1 |
| `registry_by_registration` | The registry listed in registration order rather than key order | 1 |
| `registry_featured` | A `featured` flag added to marked entries | 1 |
| `registry_search` | `?q=` accepted and matched against endpoint URLs | 1 |
| `registry_personalised` | The entry matching the caller's key put first | 1 |
| `registry_requires_mark` | Unmarked entries dropped from every list | 2 |
| `registry_resolve_404` | Every resolution by key returns 404 | 1 |
| `registry_accepts_sort` | `?sort=`, `?order=` and `?orderBy=` let through the parameter check | 1 |
| `registry_products_on_entry` | Two product references put on each entry | 1 |
| `registry_echoes_caller` | The caller's household echoed in the response | 2 |
| `registry_ignores_mark_filter` | `?mark=true` ignored | 1 |
| `signup_route` | `POST /signup` registered, returning a freshly generated key pair | 1 |
| `name_the_model` | `model: "gpt-5"` put on the offer serialisation | 1 |
| `name_the_model_settlement` | `model: "gpt-5"` put on the settlement record, which is built in the engine and not in the view | 1 |
| `free_text_reason` | The check that an exclusion's reason names a published rule removed | 1 |
| `registry_names_platform` | `platform: "atarasy-hosted"` put on every registry entry | 1 |
| `vertical_view_not_vertical` | The presenter filter dropped from the household list, which is what the engine did until 2026-09-09 | 1 |
| `presenter_optional` | The list served without a presenter named, as an empty view rather than a refusal | 1 |
| `platform_reinfers` | Each prediction scaled by the return rate of the same product across every household seen | 1 |
| `hide_merchant_on_candidate` | `merchant` and `ships` dropped from the candidate serialisation | 1 |
| `settlement_lines_without_merchant` | The receipt's lines kept, with the merchant blanked on each | 1 |
| `cost_on_candidate` | A cost put on every candidate in the offer view | 1 |
| `deadline_on_receipt` | A due date put on each receipt | 1 |
| `decide_after_withdraw` | Decisions accepted on a withdrawn offer | 1 |
| `decide_before_present` | Decisions accepted on a drafted offer | 1 |
| `decide_twice_overwrites` | A second decision allowed to overwrite the first | 1 |
| `discount_after_trial` | A tenth off the price for a household that had consumed something | 1 |
| `export_no_format` | The export's format string blanked | 3 |
| `ignore_config_version` | The first catalogue resolved whatever version the offer named | 1 |
| `import_accepts_anything` | An import accepted in any format | 1 |
| `inaction_field_on_acts` | A `responded` field added to every act | 2 |
| `present_expired` | An offer presented after its expiry | 1 |
| `present_twice` | A drafted offer presented twice | 1 |
| `recovery_not_logged` | The recovery log not written | 2 |
| `refuse_the_physical_binding` | Physical offers refused while the deployment declares them | 8 |
| `slow_when_there_are_acts` | 120ms spent when the acts stream has something in it | 1 |
| `unknown_giver_404` | A 404 for a giver with no acts | 1 |
| `unknown_giver_differs` | A 404 for an unattested key and a 200 for a quiet giver | 1 |
| `withdraw_is_not_final` | Withdraw leaves candidates open, and a withdrawn offer can be decided | 3 |
| `withdraw_twice` | An offer withdrawn twice | 1 |
| `settle_at_latest_config` | Settlement resolves the presenter's newest catalogue rather than the version stamped on the offer | 4 |

**Measured, not asserted.** `engine/scripts/coverage.sh` applies every mutation
in turn and collects the probes that failed, and the notes in the suites are
written from its output rather than from intent. Of 133 probes, 130 have been
shown to fail under at least one of the 115 mutations. The three that have not
say so in their own notes and are counted as unproven:

- one runs only against a deployment with no physical binding, which the
  reference engine is not
- one compares a recoverer's view with a stranger's, and the reference engine
  authenticates nothing, so they are identical for the wrong reason
- one is covered only when the suite runs at an exploration rate above 0.5,
  which was done and is recorded

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

**A mutation that survives is not always a hole in the probes.** For four
versions of this ledger, `settle_at_current_price` was recorded as a breach of
§6.3 that no probe caught, and it was treated as the suite's most useful row.
Reading it again showed why nothing caught it: the code it substituted resolved
the *frozen* config by another route and computed the same amount. It was not a
breach at all, and no probe could have failed on it.

The real breach is `settle_at_latest_config`, which resolves the presenter's
newest catalogue instead. Catching that needs a second catalogue version at a
changed price, which the suite now asks for as `VALENCE_CONFIG_VERSION_LATER`.
Four probes fail under it.

The lesson is not about §6.3. **A surviving mutation says either that the
probes are weak or that the mutation is inert, and telling those apart means
reading the substituted code rather than trusting the label on it.**

**Five mutations passed the suite before it was finished, and each named a
different way to obey the letter.** They came from an adversarial pass on
2026-09-08 that was asked to break the probes rather than the engine, and every
one of them worked on the first attempt.

- **A forbidden field in another spelling.** `trackingId` is `tracking_id`, and
  a key list compared as exact lower-case strings catches one of them. The
  comparison now collapses case and punctuation.
- **A price raised under another name.** The suite refused a `unit_price` field
  and read the price of an ordinary offer. A `surcharge` field passed both. The
  probe now pushes nine plausible names at the endpoint and asserts the served
  price does not move, which makes the field's name irrelevant.
- **An offer made entirely of one kind of candidate.** Every silence probe used
  an all-exploration offer, so a rule that kept the ordinary candidates at
  expiry and returned only the exploration ones was invisible. The silence
  probes use a mixed offer now.
- **A refusal that is really a delay.** The probe waited 1.1 seconds and a
  five-second backoff passed straight through it. It waits longer and reads the
  refusal for the vocabulary of a promise. This one cannot be closed: an
  implementation that backs off for an hour still passes, and no probe outlasts
  an arbitrary delay.
- **A capability on a route nobody listed.** §9.1 names five routes and
  `/analytics` was not one of them. The probe now tries ten plausible names.
  This one cannot be closed either. Enumerating the routes an implementation
  does not have is not possible from outside, and clause 33 forbids the
  capability rather than the path.

The first three were defects in the probes and are fixed. The last two are
limits of black-box conformance testing, and they are stated here rather than
left for someone to discover by exploiting them.

**The one clause whose review changed the constitution twice.** Clause 1 was
first narrowed, when "and no structure that could acquire them" turned out to
name nothing a probe could reach. Reviewing it then produced a proposal that
went past its wording: a registry of commerce information queried by agents,
so that conformance to the protocols becomes what optimising for search once
was. That is the intent layer, and it is the seat the preamble predicts the
founder will be asked to sell. The line that let it close is between resolving
and ranking, and `registry/` is that line as five probes. The clause now names
it: the infrastructure resolves and does not rank.

**A harness that runs one suite measures one suite.** For most of this ledger
`mutate.sh` ran only the conformance probes, which talk HTTP and never reach a
ledger adapter. It reported "0 fail" for a mutation that removed the reserve
ceiling from the Meter adapter, which is the single requirement that adapter
exists to satisfy. It runs both suites now and says so explicitly when nothing
failed.

**A restore only restores what git tracks.** `mutate.sh` reverts with
`git checkout -- src`, and a mutation applied to an untracked new file survives
it. That happened to `meter-ledger.ts` before it was committed, and every run
afterwards was measuring a mutated engine while reporting on a clean one. The
harness now refuses to start when `src` holds an untracked file, for the same
reason it refuses when `src` is dirty.

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
implementation to the mark. All eight are covered.
Counted against the probes, not asserted.

| §13 condition | Gated? | By what, or why not |
|---|---|---|
| 1 state machine and expiry defaults | yes | `silence/` covers the three rows of §2.2 and `machine/` covers `withdraw`, partial deciding, and that `settled` is terminal |
| 2 exploration floor, no bypass | yes | Eleven probes, both sides of the formula, six bypass shapes, and padding |
| 3 no §9.1 route, no §3.3 field | yes | Ten route probes, three refusal probes, and a key walk over four documents. The walk does not cover every response shape |
| 4 no recipient inaction disclosed | yes | Ten probes in `opacity/`: giving changes nothing on the giver's surface, no period frames an empty response, no route prompts reciprocation, a receipt resolves to nothing, and the viewer's own lineage edges carry no date |
| 5 no household balance | yes | Two route shapes and six field names in any spelling, and `binding/` settles a trial and then a purchase to check that nothing carried forward |
| 6 terms frozen at `config_version` | yes | The deployment declares a second, later catalogue with one product repriced, and a settlement against the earlier one is checked to charge the earlier price |
| 7 lineage edges accepted regardless of client | yes | Three probes in `lineage/`, including two different clients and a tampered signature |
| 8 no household billed for `lost` | yes | `binding/` runs the physical binding where the deployment declares it, and checks that what is charged equals the breakdown |

Clauses 47, 61 and 62 are outside §13 and are covered by `exit/`, which runs
against two hosts and asks each surface whether the second answers as the first
did.

What no probe here reaches is stated in the suite READMEs rather than left to be
found: the host's blindness is a property of what it stores rather than of its
API, a reminder refusal that is really an hour-long backoff outlasts any probe,
the routes an implementation does not have cannot be enumerated from outside,
and the lineage circle differenced against the acts stream still yields a
dateless form of inaction that nothing removes.

## Where the engine is

`engine/` in the specification's repository, published on 2026-09-08. It went
there rather than into a repository of its own because the constitution's
README and clause table both already said the engine is published at
`atarasy/valence`.

The engine is one subject, not the subject. These suites run against any
implementation and import nothing from this one; the eight variables in the
README are all they need. What the engine gives the ledger is a place where
every row can be reproduced, which is the difference between a claim that the
probes can fail and evidence of it.
