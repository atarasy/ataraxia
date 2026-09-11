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
| `strict_drops_unknown` | The body check discards unknown fields instead of refusing them | 6 |
| `accepts_unit_price` | `unit_price` accepted from the request and stored on the candidate | 1 |
| `leak_field_offer_view` | Added `rating: 4` to the candidate serialisation | 2 |
| `leak_field_settlement` | Added `tracking_id` to the settlement record | 1 |
| `list_total` | Added `total` beside `offers` in the household's list. Re-anchored 2026-09-09 after the list gained a presenter; it had gone silently inert, which is why every script now asserts its anchor | 1 |
| `lineage_acts_total` | Added `network_size` beside `acts` | 2 |
| `balance_route` | Registered `GET /households/{id}/balance` returning 0 | 1 |
| `invent_product` | A missing catalogue entry falls back to a price of 1000 | 1 |
| `hide_presenter` | Dropped `presenter` from the offer serialisation | 10 |
| `no_floor` | The exploration floor check disabled | 6, and 1 unit test |
| `pad_the_floor` | The check that a marked candidate qualifies as exploration removed, leaving the count. Re-measured 2026-09-09 after exploration became what the household has never been offered; still caught by the padding probe | 1, and 1 unit test |
| `floor_bypass_field` | `exploration_floor_met` accepted from the request and honoured | 1 |
| `floor_too_strict` | Comparison tightened to `marked <= required` | 11, and 18 unit tests |
| `floor_off_by_one` | Comparison weakened to `marked < required - 1` | 6, and 1 unit test |
| `hide_exploration` | Dropped `is_exploration` from the candidate serialisation | 2 |
| `silence_is_consent` | An undecided digital candidate becomes `kept` at expiry | 5, and 3 unit tests |
| `unredeemed_revenue` | The ceremonial branch removed, so nothing is defaulted at expiry | 1, and 1 unit test |
| `many_reminders` | The reminder limit raised from one to five | 2, and 1 unit test |
| `decide_after_expiry` | Decisions accepted on an expired offer | 1 |
| `reject_foreign_client` | Lineage edges refused unless the user-agent is the reference hub's | 10 |
| `accept_any_signature` | Signature verification removed from lineage acceptance | 1, and 1 unit test |
| `hide_merchant` | Blanked `merchant` on the accepted edge | 3 |
| `profile_from_receipt` | Added a `preference` to each receipt row, derived from the product | 1 |
| `history_from_receipt` | Added the product to each receipt row | 2 |
| `camel_tracking` | Four forbidden fields reintroduced in camelCase: `trackingId`, `stockRemaining`, `expiresInSeconds`, `starRating` | 2 |
| `coupon_and_surcharge` (re-anchored 2026-09-09) | A `surcharge` accepted on a candidate and added to the price, and a `coupon` accepted and stored | 1 |
| `per_person_events` | A per-person event store on `/analytics` and a pixel socket on `/px` | 1 |
| `reminder_rate_limit` | The reminder refusal turned into a five-second backoff | 1, and 1 unit test |
| `silence_consent_non_exploration` | Ordinary candidates kept at expiry, exploration candidates returned | 3, and 3 unit tests |
| `no_reserve_ceiling` | The in-memory ledger accepts a commit above the reserved amount | 1 unit test |
| `adapter_trusts_the_ledger` | The Meter adapter delegates the reserve ceiling to Meter | 1 unit test |
| `sent_list_on_giver_surface` | The giver's own gifts added to the acts stream | 1, and 1 unit test |
| `period_on_acts` | A `from` and `to` window framing the acts response | 1 |
| `nudge_route` | `POST /lineage/nudge` registered | 1 |
| `receipt_ref_resolves` | The edge id put back on the receipt, and a route that resolves it | 1 |
| `date_on_own_edges` | The date and product kept on the viewer's own lineage edges | 1 |
| `second_degree_circle` | The circle walked one hop further out | 1 |
| `bill_the_household_for_lost` | `lost_amount` added to what the ledger commits | 3, and 1 unit test |
| `credit_the_trial` | What was consumed accrued as a balance and taken off the next settlement. Re-measured 2026-09-09 after every offer took a fresh household, which had made a per-household balance invisible; the probe now names one household | 1 |
| `withdraw_keeps_decided` | Withdrawing left the undecided candidates as `offered` | 1 |
| `decide_all_or_nothing` | A decision naming fewer than every candidate refused | 2, and 1 unit test |
| `settled_is_not_terminal` | A withdraw accepted after settlement | 1, and 1 unit test |
| `export_only_what_surfaces_show` | The export built from the giver's surface instead of the record | 2 |
| `export_drops_settlements` | Settlements left out of the export | 2 |
| `export_drops_permissions` | The permission ledger and the query log dropped from the node export, which is the state every version before 2026-09-09 shipped: the ledger was built that day and nothing connected it to the export, so a member who moved host lost every permission they had granted | 1 |
| `import_drops_recoveries` | The receiving host discards the recovery log the export carried. It was carried and silently dropped until 2026-09-09 | 1 |
| `recoverer_owns_every_channel` | The requirement for a channel outside the recoverer's control removed | 1 |
| `anyone_can_recover` | The check that the caller is a named recoverer removed | 1 |
| `approval_without_deliberation` | The approval rendered from the offer alone, with no alternatives and no argument against | 2 |
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
| `refuse_every_grant` | Every permission grant refused | 8 |
| `empty_scope_ok` | A permission accepted with a scope naming nothing | 1 |
| `revoke_revokes_everything` | Revoking one permission stamps them all | 1 |
| `global_permissions_route` | `GET /permissions` registered, listing them to anyone | 1 |
| `no_recovery_on_present` | Presenting a physical offer opens no recovery | 11, and 2 unit tests |
| `collect_ignores_consumed` | The consumed list dropped from a collection | 5, and 1 unit test |
| `physical_expiry_returns` | The digital expiry rule applied to the physical binding | 11, and 2 unit tests |
| `never_lost` | The loss deadline removed, so uncollected candidates stay undecided | 3, and 1 unit test |
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
| `require_registered_merchant` | An offer refused when its candidates name a merchant the registry does not list | 0 |
| `received_route` | `GET /households/{id}/received` registered, returning the products behind the household's gifts | 2 |
| `ignore_band` | The band kept on a ceremonial offer and candidates no longer checked against it | 2 |
| `merchant_sees_every_note` | Every note returned to whoever asks as the merchant | 3 |
| `notes_summary_route` | `GET /notes/summary?product=` registered, returning a count and a sentiment | 1 |
| `any_party_note` | Any party name accepted in a note's `shared_with` | 1 |
| `settle_anything` | The state guard on settlement removed, so an offer settles in any state | 2 |
| `accept_unsigned_decisions` | The signature check on a decided set skipped | 1 |
| `reject_foreign_offer_client` | `POST /offers` refused unless the user-agent is the reference hub's | 112 |
| `address_on_offer` | A delivery address put on the offer serialisation | 1 |
| `attest_returns_private_key` | The attestation route generates a key pair and returns the private half | 1 |
| `floor_ignores_exhaustion` | An offer let through with no exploration to a household that has seen everything, which is the sell-out a cap on the floor would license. Rewritten 2026-09-09 when the cap itself was withdrawn | 1, and 1 unit test |
| `household_declares_consumed` | A household allowed to decide `consumed` and `lost` in the physical binding | 1, and 1 unit test |
| `decide_writes_on_refusal` | Each decision line written as it is checked, so a refused set leaves earlier lines written | 22, and 4 unit tests |
| `withdraw_after_decision` | Withdraw allowed after a signed decision | 1 |
| `charge_the_recipient` | A ceremonial offer reserved and committed against the household on the offer, the recipient | 1 |
| `default_beside_kept` | A default shipped at expiry beside a candidate the recipient had kept | 1 |
| `band_on_unit` | The band checked against the unit price rather than the line | 1 |
| `allow_duplicate_products` | The same product allowed on two lines of one offer | 1 |
| `novelty_from_this_catalogue` | What the presenter still has counted over the catalogue the offer names | 1 |
| `import_trusts_everything` | Import writes what it is handed: unverified edges, another household's offers | 1 |
| `notes_append` | A second line by the same author appended to a candidate | 1 |
| `attest_overwrites` | A merchant's attested key replaced by a later caller | 1 |
| `approval_hides_maker` | Merchant, carrier and band dropped from the rendered approval | 2 |
| `consumed_at_a_fraction` | Used goods settled at a fraction of the price, the cost basis under another name | 1, and 1 unit test |
| `gift_is_billed` | A used gift billed to the person who received it | 2, and 1 unit test |
| `note_default_nobody` | A note's `shared_with` defaulted to nobody, so a line written before giving reaches no one | 1 |
| `duplicate_check_without_grant` | The duplicate check answered without consulting the permission ledger | 1 |
| `duplicate_check_unlogged` | The duplicate check answered without writing the row into the recipient's record | 1 |
| `merchant_export_drops_configs` | A shop's export leaves its catalogue behind | 1 |
| `merchant_export_leaks_notes` | A shop's export carries every line on its candidates, not the shared ones | 1 |
| `merchant_export_drops_settlements` | The settlement rows emptied in the shop's export. Before 2026-09-10 the three probes on this export asserted the format and that two arrays were non-empty, nothing asserted settlements, and this mutation survived | 1 |
| `merchant_export_drops_recoveries` | The shop's own recovery rows emptied in its export, so a shop that ran the physical binding arrives at its new platform without any record of what it placed and got back | 1 |
| `merchant_export_leaks_delivery` | A delivery row added to the shop's export, which would hand a receiving platform every household's delivery code (§14.1, §7.5b) | 1 |
| `tightening_needs_cosigner` | Every mandate change made to need the co-signers, so a person cannot lower their own ceiling | 5 |
| `daily_ceiling_ignored` | The daily sum dropped at settlement, which is the state every version before 2026-09-10 shipped: the field did not exist and nothing bound a household's day across presenters (§16.3) | 1 |
| `absent_daily_ceiling_is_zero` | A missing daily ceiling read as a ceiling of zero, so every settlement is refused. **Its 17 probes are catches and not a broken fixture**: each fails on its own assertion, having asked for a settlement and been refused, rather than in its setup | 17 |
| `co_sign_category_ignored` | The category check dropped, so a set the person said needs two signatures goes through on one (§16.4) | 1 |
| `cooling_settles_immediately` | The cooling window dropped, so a decision the person could still take back is already money (§16.5) | 1 |
| `mandate_refusals_share_a_reason` | Every mandate refusal given the same name, which is the defect `novelty_from_this_catalogue` was: two different refusals sharing a status code and nothing else (§16.6) | 3 |
| `mandate_any_version` | Any mandate version accepted, so an old signature can be replayed onto a new record | 1 |
| `result_form_on_party_ok` | A result form accepted on a party grant | 1 |
| `computation_grant_without_form` | A grant to a computation accepted with no result form | 2 |
| `computation_grant_raw` | Raw data admitted as a computation's result form | 1 |
| `unsigned_catalogue` | A catalogue accepted without the presenter's signature | 1 |
| `presenter_always_attested` | Every presenter reported as root-endorsed. Failed no probe on its first run: the only presenter a probe read was the rooted one | 1 |
| `loosening_without_cosigner` | A mandate loosened on the person's signature alone | 4 |
| `ceiling_not_enforced` | An offer presented over the ceiling the person signed. Failed no probe on its first run: nothing placed one | 1 |
| `lapsed_mandate_still_works` | An offer presented on a mandate that had lapsed. Failed no probe on its first run: nothing used one | 1 |
| `unattested_counts_as_given` | An unattested edge counted as having been given, so a stranger who registers a key can empty a household's exploration floor | 1 |
| `edge_always_attested` | Every edge marked attested, so a rooted edge and a stranger's read alike | 2 |
| `merchant_export_leaks_others` | A shop's export carries every offer in the engine. Failed no probe on its first run, because the deployment had one presenter; the seed now registers a second | 1 |
| `cost_on_candidate` | A cost put on every candidate in the offer view | 1 |
| `deadline_on_receipt` | A due date put on each receipt | 1 |
| `decide_after_withdraw` | Decisions accepted on a withdrawn offer | 1 |
| `decide_before_present` | Decisions accepted on a drafted offer | 1 |
| `decide_twice_overwrites` | A second decision allowed to overwrite the first | 1 |
| `discount_after_trial` | A tenth off the price for a household that had consumed something. Re-measured 2026-09-09 for the same reason as `credit_the_trial`; the probe is now self-contained | 1 |
| `export_no_format` | The export's format string blanked | 5 |
| `ignore_config_version` (re-anchored 2026-09-09) | The first catalogue resolved whatever version the offer named | 8 |
| `import_accepts_anything` | An import accepted in any format | 1 |
| `no_delivery_route` | The household's own read of its delivery removed, so `GET /offers/{id}/delivery` answers 404. The wall around the merchant was proven from the first day and the surface the wall protects was not, which left the control probe unproven until this was written (2026-09-10) | 1 |
| `delivery_on_the_offer` | The delivery code and the carriage put on the offer view, where a merchant reads them (clause 49, §7.5b). The first version of this script changed the stored candidate and **survived**: `offerView` names every field it emits, so nothing reaches a response by being stored, and the mutation has to change the view | 1 |
| `inaction_field_on_acts` | A `responded` field added to every act | 1, and 1 unit test |
| `present_expired` | An offer presented after its expiry | 1 |
| `present_twice` | A drafted offer presented twice | 1 |
| `recovery_not_logged` | The recovery log not written | 3 |
| `refuse_the_physical_binding` | Physical offers refused while the deployment declares them | 17, and 2 unit tests |
| `slow_when_there_are_acts` | 120ms spent when the acts stream has something in it | 1 |
| `unknown_giver_404` | A 404 for a giver with no acts | 1 |
| `unknown_giver_differs` | A 404 for an unattested key and a 200 for a quiet giver | 1 |
| `withdraw_is_not_final` | Withdraw leaves candidates open, and a withdrawn offer can be decided | 3 |
| `withdraw_twice` | An offer withdrawn twice | 1 |
| `settle_at_latest_config` | Settlement resolves the presenter's newest catalogue rather than the version stamped on the offer | 17, and 1 unit test |
| `routes_all_registered` | Every forbidden and intent-layer route of §9.1 and clause 1 registered at once | 17 |
| `renders_empty_alternatives` | The clause 59 guard left intact and the alternatives emptied in the serialisation, so the screen renders with none | 1 |
| `resolve_first_config` | The presenter's earliest catalogue resolved whatever version the offer named (§6.3) | 1 |
| `roles_answer_for_everything` | Every surface answered whatever roles the deployment declares, which is the state before the split: one process, one set of routes, and no way for a probe to tell a hub from an engine (§13.1) | 3, and 2 unit tests |
| `delivery_belongs_to_the_engine` | The household's delivery surface put on the engine's side, where its path would put it. A merchant would then read a carrier's code, which resolves to an address, and clause 49's wall would be gone by a routing decision rather than by a field. **Renamed from `decisions_belong_to_the_engine` on 2026-09-11**, when deciding moved back to the engine: authority travels in the signature, and a hub that answered for deciding had no offer to decide on | 4, and 3 unit tests |
| `settlement_is_not_reported` | Settle without telling the person's own copy. The daily ceiling then measures nothing on a split deployment and the household's export loses the settlement. **Everything still answers**, which is why it needs a probe that reads one party after writing to the other | 1 |
| `decided_offer_is_not_reported` | Decide without telling the person's own copy what was offered. A hub presenting its role alone then exports a node with no offers in it, and what the household **declined** exists nowhere but in the presenter's own store, which is the half clause 8 puts in the person's node | 1 |
| `roles_are_swapped` | The two roles exchanged, so an engine answers for the person's surface and a hub for the presenter's. **Every route is still served somewhere**, which is the point: a corpus that only asked whether a route exists would see nothing wrong | 6, and 2 unit tests |
| `unreachable_hub_means_no_mandate` | A hub that cannot be reached read as a hub that holds no mandate. **Every protection then disappears the moment the network does** and the engine goes on placing offers with no ceiling. Caught by a unit test rather than a probe: the conformance corpus reaches implementations that answer, and an implementation that cannot reach its own hub is not a shape a probe over HTTP can arrange | 1 unit test |
| `registry_needs_both_roles` | The registry answerable only where both roles run, so a single-role deployment cannot resolve a key and resolution becomes a favour a full deployment does rather than neutral infrastructure (clause 1) | 1, and 1 unit test |
| `store_does_not_write_through` | The rows kept in memory and never written, which is what every version before 2026-09-11 did. **Everything answers and every probe passes**: the loss arrives at the next restart, and a suite that talks HTTP to a running process cannot outlive it. Caught by a unit test that reopens the file | 1 unit test |
| `state_change_is_not_committed` | A changed offer no longer put back in the map. **Everything answers and the whole corpus passes**, and a restart returns every offer in the state it was created in, because a map writes through on `set` and cannot see a field of a value it handed out being assigned. Found on 2026-09-11 by restarting a server against the same file, the day after the store landed and passed | 1 unit test |
| `assertion_challenge_unchecked` | A passkey's assertion accepted without checking that its challenge is what was agreed to, a decided set or, since the evening of 2026-09-11, a mandate. Re-anchored when the check moved into the general verifier. What is left proves a person was present, which is what a random challenge gives; clause 35 asks what they agreed to, and this confirms a set they never saw (§10.5) | 1, and 2 unit tests |
| `assertion_accepts_registration` | A registration ceremony accepted as a confirmation. `webauthn.create` proves a person made a key and agrees to nothing. **The probe for it was written on 2026-09-11**, when this mutation failed only a unit test: a requirement held by one engine's own tests is not held at the boundary the suites certify | 1, and 1 unit test |
| `assertion_ignores_user_verification` | The user-verified flag no longer read, so a device that signed without checking who was at it confirms a set. What is left proves a key was used; clause 35 asks that a person agreed | 1, and 1 unit test |
| `assertion_ignores_user_presence` | The user-present flag no longer read, so a device with nobody at it confirms a set | 1, and 1 unit test |
| `assertion_ed25519_only` | Every signature checked the way ed25519 is checked, whatever key it is checked against. This is what the reference did until 2026-09-11, and it refused the key most devices carry: a member who joined through a hub holds a P-256 passkey, and could register it, then confirm nothing with it, co-sign nothing and sign no change to their own mandate | 1, and 4 unit tests |
| `assertion_for_any_relying_party` | The relying party hash no longer compared, so an assertion a device made for another site confirms a set here | 1, and 2 unit tests |
| `confirmation_reusable` | The record of what has confirmed an offer dropped, so the bytes that confirmed a decided set stay good after the person takes it back. **Anything that saw the confirmation once could undo the withdrawal**, the hub that carried it included, which is the window §16.5 gives a person to change their mind. Found by an adversarial pass on 2026-09-11 and measured before it was closed: decide, withdraw, resend, and the offer read `decided` again | 1 |
| `confirmation_token_is_the_string` | A confirmation identified by the string that was posted rather than by what it decodes to. **`Buffer.from(x, "base64")` reads far more strings than one**: it ignores whitespace and padding and takes the base64url alphabet, so one signature has an unbounded number of spellings and a register of strings holds none of the others. An ECDSA signature has a second door of its own, a twin `(r, n - s)` that verifies alike and that anyone who saw the first can compute without the key. Found by a second adversarial round on 2026-09-11, against the fix the first round had asked for | 1, and 2 unit tests |
| `export_drops_confirmations` | The register left out of a node's export, so a household that moves arrives with its offers and none of what confirmed them, and the one-use rule resets at the new host (clause 52, §14.1) | 1 |
| `identities_need_both_roles` | `/_identities` given to the engine, so a hub presenting its role alone cannot take a key and holds nothing to verify a person's signature against (clause 2, §13.2). **It aborts rather than being caught**, and is excluded for it: the reference's own seed reads the role table, so under the mutation every key goes to the engine alone and the seed's first lineage edge to the hub is refused as unattested before any probe runs. A hub that cannot hold a key cannot be seeded | aborts |
| `mandate_refuses_assertion` | A mandate change takes a bare signature and nothing else, which is what the route did until 2026-09-11. A passkey cannot sign bytes a caller hands it, so a member of a hub **could record no ceiling, no cooling window and no co-signer**, and §16.5 went with it. Found by building the screen where a member sets their own protections | 2 |
| `import_overwrites_an_offer` | An import may change an offer the host already holds. **A node handed to a host said an offer was decided and every candidate kept, with no signature anywhere, and settling it charged 6,000.** Measured before the rule existed; verifying the decision instead was ruled out, because an assertion names the host it was made for | 1 |
| `mandate_form_is_malleable` | The mandate's two lists joined without escaping their items, so `["coffee","tea"]` and `["coffee,tea"]` are the same bytes and **a relay can drop a protection under a signature that still verifies**. Found by the third adversarial round | 1 |
| `cosignature_refuses_assertion` | A co-signature takes a string alone, so a family whose co-signer holds a passkey can name a category needing a second signature and then have no way to give one | 1 |
| `recovery_leaves_no_moment` | A physical collection decides an offer without recording when, so the window never starts and **the record of what a household used can be reverted at any time, by anyone holding the offer id, with no signature** | 1 |
| `both_shapes_accepted` | A decided set carrying a signature and an assertion both is taken, and the engine reads the signature. **The probe for this was written on 2026-09-11 with no mutation beside it** and was one of the six never shown to fail; the mutation was written the same evening | 1 |

**Measured, not asserted.** `engine/scripts/coverage.sh` applies every mutation
in turn and collects the probes that failed, and the notes in the suites are
written from its output rather than from intent. **Re-measured in full on
2026-09-11**, after the two conformance roles, the store, and the passkey's
assertion, at an exploration rate of 0.2.

| | 2026-09-09 | 2026-09-10 | 2026-09-11 | 2026-09-11, seed fixed |
|---|---|---|---|---|
| mutations | 167 | 173 | 184 (182 counted) | **192** (190 counted, 2 excluded for breaking the shared fixture) |
| declarations | 183 | 188 | 202 | **210** |
| probes at runtime | 197 | 202 | 216, one skipped | **223**, one skipped |
| shown to fail | 191 | 197 | 206 | **217** |
| not shown to fail | 6 | 5 | 10 | **6** |
| surviving | 0 | 0 | 0 | **0** |
| inert | 0 | 1, found and fixed | 0 | **0** |
| aborting before a probe runs | 1 | 1 | 3 | **1** |

**The last column is valence `125b5bc` and ataraxia `a3952e3`**, measured the same day after the role-split seed was made non-fatal. The three role-table mutations that aborted in the column before it are caught by name: `roles_are_swapped` by nine probes, `registry_needs_both_roles` by four, `identities_need_both_roles` by three. The engine's own unit tests are a separate population and are not in the ratio: 40 of them failed under at least one mutation. **Of the 217 probes with a catch, 110 rest on a single mutation.** The raw logs of this run were lost to a reboot of the machine before they were archived, so the per-row counts below it are not regenerated from them; the figures here were computed from those logs before the reboot and recorded in the session that ran it.

**What came after it has not been measured.** The same evening added the assertion shape to a mandate change and a co-signature, the import rule, the escaped canonical form, the collection's moment and a mutation for the one probe that had none, which leaves the corpus at 198 mutations and 231 probes at runtime (one skipped), all passing clean. Each of the six new mutations was run alone against the whole corpus and caught by the probe that names it. None of that is a sweep.

**The count of unproven probes went up, and the cause is in the harness rather
than in the suites.** Seeding the role-split pair was added on 2026-09-11 so the
`roles/` suite could read one party after writing to the other, and
`conformance.sh` runs under `set -e`. A mutation that breaks that seed therefore
kills the run before `bun test` starts. Three now do: `roles_are_swapped`,
`registry_needs_both_roles` and `require_registered_merchant`, each dying at
`scripts/seed.ts:73`. They are reported as ABORTED, which is honest, and the
cost is that **four `roles/` probes and one `registry/` probe that the previous
generation proved are now proven by nothing.** The fix is for the role-split
seed not to be fatal, so the probes fail with their own names; it is not made
here, because a change to `conformance.sh` means this whole table must be
measured again before it can be quoted.

**The engine's own unit tests are a separate population**: 62 at runtime, 30 of
them shown to fail. They are not added to the 206 above. `coverage.sh` prints
the union of both, which was 236 lines in this run, and dividing that by the
conformance count is the error corrected on 2026-09-10 and described below.

**`scripts/fragility.py` against the same run**: of 209 probes with a catch,
**66 rest on a single mutation**, and 8 rest only on a mutation that spans nine
or more suites, which is the shape of one breaking the shared fixture rather
than one the corpus catches.

**It was killed for memory twice**, at 86 and at 154 of 184, and neither kill
cost more than the mutation it landed on: `coverage.sh` had been taught the day
before to keep each verdict in a directory keyed by the content of `src`, the
scripts and the suites. Both kills left a mutation applied to `src`, once to
`offers.ts` and once to `http.ts`, which is the state the dirty-`src` guard
exists to refuse.

**The closing run was killed for memory at 155 of 173 and resumed**, which cost
two things worth recording. The kill left a mutation applied to `src`, and it
was restored only after reading the diff against the script that produced it.
And **the run's own summary never printed**, so the survivors and the inert
were reconstructed from the logs instead: a mutation whose logs hold no failing
probe either survived or aborted, and exactly one does, which is
`require_registered_merchant`, the one that aborts.

**The inert one was caused by this session's own change.**
`hide_merchant_on_candidate` anchored on `ships` running straight into
`predicted_conversion` in the candidate view, and §16.4's `category` was
inserted between them the same day. The script then changed nothing, reported
nothing, and would have passed for a mutation the corpus catches. It is
re-anchored on the two lines clause 12 is actually about, and catches its probe
again. **This is the third time an anchor has drifted under a new field**, and
each time the harness check is what found it. Two mutations are excluded from the count because they break the
shared fixture, and one of those, `require_registered_merchant`, aborts before
any probe runs. The run before it, on 2026-09-09, read 161 mutations, 179
declarations, 192 probes at runtime and 187 shown to fail; it is superseded and
kept here so the movement is legible.

**The six never shown to fail in the run after the seed fix**, each named rather than counted. The four role probes and the registry probe that the seed had cost are proven again, and one more, the both-shapes probe, gained its mutation the same evening and waits on the next sweep:

| Probe | Why |
|---|---|
| `approval` > an offer is accepted from another client as it is from the reference hub | Its mutation is `reject_foreign_offer_client`, which is excluded for breaking the fixture across fourteen suites |
| `registry` > an offer names a merchant the registry does not list, and is created | Its mutation is `require_registered_merchant`, which aborts the setup |
| `binding` > consumed and lost cannot be reached from the digital binding | Needs a deployment with no physical binding, which this one is not. **It is the one probe the run reports as skipped**, so it is unproven twice over: not shown to fail, and not run |
| `exit` > recovering does not make the recoverer able to read | The reference authenticates nobody, so a recoverer's view and a stranger's are the same view. The probe says so in its own note |
| `floor` > one short of the floor is refused | The boundary case. `floor_off_by_one` moves the floor and is caught elsewhere before this probe sees it |
| `approval` > a set carries a signature or an assertion, and not both | Written on 2026-09-11 with the passkey's assertion, and no mutation was written beside it. The recurring failure of this project, in its plainest form **Its mutation, `both_shapes_accepted`, was written on the evening of 2026-09-11** and fails this probe and no other; the run that would count it has not happened |
| ~~`roles` > a hub alone answers for the household and the mandate~~ | ~~`roles_are_swapped` proved it and now aborts in the seed~~ **Proven again** once the seed was made non-fatal |
| ~~`roles` > an engine alone answers for offers~~ | ~~Same~~ **Proven again** once the seed was made non-fatal |
| ~~`roles` > an engine alone answers for deciding, because authority travels in the signature~~ | ~~The probe written for the day's largest correction, and for a few hours it proved nothing.~~ **Proven again** once the seed was made non-fatal |
| ~~`roles` > both roles answer for the registry~~ | ~~`registry_needs_both_roles` proved it and aborted in the seed~~ **Proven again**, by four probes |
| ~~`roles` > both roles register a key~~ | ~~New on 2026-09-11 and unproven for the same reason~~ **Proven** by `identities_need_both_roles` once the seed was made non-fatal |
| ~~`absence` > a delivery is readable on the household's surface~~ | ~~New on 2026-09-10 and unproven from the first day.~~ **Proven the same day** by `no_delivery_route`, which removes the route the probe asserts. The gap was the ordinary one: the mutations written beside it moved the delivery to where a merchant reads it, and nothing asked whether the household's own surface worked at all |

**Read the numerator and the denominator over the same population.** The run of
2026-09-10 has a union of 212 lines, of which **191 are conformance probes and
21 are the reference engine's own unit tests**: `coverage.sh` greps both logs, and the
engine's tests reach the ledger adapters that the conformance probes, which
speak only HTTP, never see. An earlier version of this paragraph divided the
whole union by the conformance count and reported 189 of 192 with five
unproven. The true figure at that moment was 172 of 192 with twenty unproven,
and the difference was not measurement noise but two populations added
together.

The closing run reported no inert mutation, which is what the harness check
was for: 112 of the scripts had been repointed hours earlier when the
reference split into `engine/`, `hub/`, `shared/` and `common/`, and a stale
path would have been named rather than passing quietly. It did surface the
subtler form of the same defect, which the check cannot see: two mutations
that changed bytes and broke nothing, because their anchors had moved with
the day's new fields. Both are re-anchored and both now fail their probes.

**What "proven" counts, corrected the same day.** An adversarial pass found the
earlier number counting probes that failed in their setup rather than in their
assertion. Two mutations, `require_registered_merchant` and
`reject_foreign_offer_client`, break `POST /offers` for the whole suite, so
every probe that creates an offer fails under them whatever it asserts.
`coverage.sh` now names those two and leaves them out of the count; they are
still run, and what they catch is recorded in their own rows. Their own probes
are therefore among the unproven below, which is the honest consequence.

## What the corrected harness found, 2026-09-09

Until this date `conformance.sh` exited 1 on every clean run, so `mutate.sh`
could never print `SURVIVED` and a mutation caught by nothing looked exactly
like a mutation every probe caught. The first run after the fix found two
survivors, and both were real:

- `accepts_unit_price` had lost two of its three anchors when the gift model
  added `given_by` to the accepted-field list and a field to the request type.
  It changed bytes in `src`, so the INERT check passed, while the validation
  gate it was meant to open stayed shut. The ledger recorded it as caught by
  one probe and it was testing nothing. It is re-anchored, and all three
  replacements now assert. **53 of the 161 scripts still do not assert their
  anchors**, and this is what that costs.
- `novelty_from_this_catalogue` applied correctly. The probe asserted only the
  `422`, and the engine has two of them: the mutation swapped
  `exploration_floor` for `nothing_new` and the probe could not tell. It now
  asserts the reason. **No assertion on a mutation script would have caught
  this one**: the fault was in the probe.

Three mutations were added for probes that had never been shown to fail.
`routes_all_registered` registers all eleven forbidden and intent-layer routes
at once, which proves thirteen generated probes together; the router either
holds a route or it does not, so nothing is lost by doing it in one.
`renders_empty_alternatives` leaves the clause 59 guard intact and empties the
serialisation, which is the one shape that reaches the probe on the rendered
screen. `resolve_first_config` resolves the presenter's earliest catalogue,
which is what the guard probe in `silence/` describes and what
`ignore_config_version`, which resolves the newest, does not do.

Two probe notes named mutations that do not in fact catch them. Both now say
so. A note is a claim; only the measurement says whether it is still true.

**Five mutations were reported INERT by that run**, which is the check working:
`mutate.sh` exits 2 when a mutation changes nothing in `src`, so an anchor that
drifted is reported rather than passing quietly. `consumed_at_price`,
`ignore_band`, `settled_is_not_terminal`, `unredeemed_revenue` and
`withdraw_twice` had all drifted under the day's engine changes. Four are
re-anchored and each was re-measured against its own probe. `consumed_at_price`
is deleted: it charged a consumed candidate at price against a cost basis, and
the cost basis left the model, so the behaviour it broke is now the correct one.

The probes that have not been shown to fail say so in their own notes and are
counted as unproven. There are five:

- one runs only against a deployment with no physical binding, which the
  reference engine is not
- one compares a recoverer's view with a stranger's, and the reference engine
  authenticates nothing, so they are identical for the wrong reason
- one is covered only when the suite runs at an exploration rate above 0.5,
  which was done and is recorded
- two are the probes of the two excluded mutations, the registry as a gate and
  the endpoint that answers one client differently. Each was measured failing
  under its own mutation when that mutation was run on its own; what the count
  will not do is credit them for the setup failures those mutations cause
  everywhere else

## What the full re-measurement of 2026-09-09 found

`coverage.sh` was run over every mutation after the clause review, with no
edits pending. Two kinds of drift had crept in during the day and neither
showed in any single run:

- **A mutation gone silently inert.** `list_total` anchored on the household
  list's old signature; when the list gained a presenter the anchor stopped
  matching, the script's `replace` did nothing, and the suite stayed green
  against an unmutated engine. Scripts without an assert on their anchor
  cannot report this; every script now has one.
- **Probes weakened by a fixture change.** When every offer began taking a
  fresh household (needed once exploration became what a household has never
  been offered), the two probes that check nothing carries forward across a
  trial and a purchase were creating their two offers for two different
  households, so a balance or a discount keyed on the household could never
  be seen. `credit_the_trial` and `discount_after_trial` ran clean. Both
  probes now name one household, and the second offer carries no exploration
  marks, which is what the same change turned up next:
- **A rule the suite contradicted.** Under §5.1 a five-product catalogue had
  no exploration left after one offer, so a second offer to the same
  household was refused for lacking what could not exist. §5 now caps the
  floor at the novelty the presenter still holds, and `floor_ignores_exhaustion`
  is the mutation for it.

The lesson is the one this file opens with: a probe's note is a claim, and
only the measurement says whether it is still true.

## The reference split, 2026-09-09

The engine's source moved into four directories on the day the mandate layer
landed: `src/engine/` for the presenter's side (offers, decisions, settlement,
the physical binding, the billing ledger), `src/hub/` for the person's (the
approval surface, permissions, mandates, recovery, the node's export),
`src/shared/` for what is neither (the endpoint registry, the canonical forms
for an edge and a decided set), and `src/common/` for types, errors and the
strict body check.

Every mutation script names the file it breaks, so all 112 that pointed at the
old flat paths were repointed in the same commit. A script whose path went
stale would have been reported INERT by `mutate.sh` rather than passing, which
is the check that made this safe to do at all.

## What this exercise found

**The floor was satisfiable by relabelling, and the specification allowed it.**
§5.1 said a candidate *may* be marked as exploration when it is below the
threshold or unknown to the household. That is a permission on the presenter
and it forbade nothing: an implementation could accept a candidate the model
fully expects to be kept, count it toward the floor, and pass every reading of
§5. Clause 26 would then cost nothing to obey. The specification was corrected
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
  does not have is not possible from outside, and clause 29 forbids the
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

Clauses 43, 52 and 53 are outside §13 and are covered by `exit/`, which runs
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
