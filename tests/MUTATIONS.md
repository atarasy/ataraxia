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
| `unknown_field_refusal_renamed` | Kept status 400 but renamed the section 3.3 error to unknown_field | 1; isolated HTTP-handler run on 2026-09-13, not a full sweep |
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
| `giver_surface_names_the_offer` | Each act on `/lineage/acts` names the offer it came from (§7.2, question 41). The schema of these surfaces was already clean, and what kept a giver off `GET /offers/{id}/statement` and `/approval` was that nothing handed a giver an offer id, which was assumed rather than written until 2026-09-13 | 1 |
| `giver_circle_names_the_offer` | The same on `/lineage/circle`. Second break beside the row above, written because the probe asserts over two surfaces and only one had been shown to fail: a circle edge carries the merchant and the product already, so an offer id beside them is the whole reference | 1 |
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
| `collect_ignores_consumed` | The consumed list dropped and the returned/consumed overlap guard removed. In the original 299 run, 3 conformance assertions directly check the collection or exported list; 19 other conformance failures and 14 unit failures lose a prerequisite of their separate properties | 22 conformance failure names and 14 unit failure names; reviewed separately from direct catches |
| `physical_expiry_returns` | The digital expiry rule applied to the physical binding. Re-targeted on 2026-09-13: the previous first match was identical to no_recovery_on_present | Isolated corrected mutation: 4 conformance failures and 1 unit failure |
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
| `approval_hides_maker` | Merchant, carrier and band dropped from the rendered approval. **Re-anchored twice on 2026-09-12**, as the surface gained a maker and then a giver under the lines it had named; it now anchors the four-line merchant, maker, giver and carrier block and removes two of them. Re-measured the same evening | 2 |
| `consumed_at_a_fraction` | Used goods settled at a fraction of the merchant price. Re-targeted to the consumed branch on 2026-09-13: the previous first-match replacement changed kept goods instead | Isolated corrected mutation: 3 conformance failures and 4 unit failures; not a full-sweep count |
| `gift_is_billed` | A used gift billed to its recipient. Re-targeted to the consumed branch on 2026-09-13: the previous first match duplicated the kept-gift break | Isolated corrected mutation: 1 conformance failure and 1 unit failure |
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
| `absent_daily_ceiling_is_zero` | A missing daily ceiling read as zero. The completed mutation in the 2026-09-13 run produces 29 conformance failures. Only the no-daily-ceiling probe directly proves this rule; the other 28 are prevented from testing their different settlement properties. A failed assertion alone does not make a catch relevant to its probe's stated rule | 29 failure names; 1 direct catch |
| `co_sign_category_ignored` | The category check dropped, so a set the person said needs two signatures goes through on one (§16.4) | 1 | **Retired 2026-09-12** with §16.4: the check it dropped no longer exists.
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
| `assertion_challenge_unchecked` | A passkey's assertion accepted without checking that its challenge is what was agreed to, a decided set or, since later on 2026-09-11, a mandate. Re-anchored when the check moved into the general verifier. What is left proves a person was present, which is what a random challenge gives; clause 35 asks what they agreed to, and this confirms a set they never saw (§10.5) | 1, and 2 unit tests |
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
| `mandate_form_is_malleable` | **Re-anchored 2026-09-12 onto the co-signer list**, the category list having left with §16.4. The mandate's lists joined without escaping their items, so `["coffee","tea"]` and `["coffee,tea"]` are the same bytes and **a relay can drop a protection under a signature that still verifies**. Found by the third adversarial round | 1 |
| `cosignature_refuses_assertion` | A co-signature takes a string alone, so a family whose co-signer holds a passkey can name a category needing a second signature and then have no way to give one | 1 | **Retired 2026-09-12** with §16.4: the co-signature on a decided set no longer exists. The same defect on the mandate change, which does still exist, is `mandate_refuses_assertion` above.
| `recovery_leaves_no_moment` | A physical collection decides an offer without recording when, so the window never starts and **the record of what a household used can be reverted at any time, by anyone holding the offer id, with no signature** | 1 |
| `both_shapes_accepted` | A decided set carrying a signature and an assertion both is taken, and the engine reads the signature. **The probe for this was written on 2026-09-11 with no mutation beside it** and was one of the six never shown to fail; the mutation was written the same day | 1 |
| `raising_is_not_loosening` | A raised ceiling stops counting as a loosening, so the co-signer requirement is never reached for the one change clause 46 names. Second break beside `loosening_without_cosigner`, which removes the requirement rather than the reason to apply it | 1 |
| `dropping_a_cosigner_is_not_loosening` | Removing a co-signer stops counting as a loosening, so the people a person named while they had capacity can be removed one at a time by that person alone | 4 |
| `every_change_loosens` | Every change counts as a loosening, so lowering a ceiling waits on whoever the person named. A protection a person cannot tighten by themselves is not theirs | 9 |
| `version_may_go_backwards` | Only versions from the future are refused, so an old version and its old signature are replayed onto a record that has moved past them. Second break beside `mandate_any_version` | 1 |
| `categories_outside_the_signed_form` | The categories needing a second signature leave the signed bytes, so a relay adds or drops one without touching the signature. Second break beside `mandate_form_is_malleable`, which makes the same list malleable instead | 3 | **Retired 2026-09-12** with §16.4: the list it took out of the signed form no longer exists.
| `recovery_log_names_nobody` | The recovery is logged and the name of whoever did it is empty. Second break beside `recovery_not_logged`: a log that cannot say who acted answers no question clause 53 asks | 2 |
| `export_drops_recoveries` | The recovery log is written and left behind on a move, so a member arrives at a new host with no record of who recovered their access | 2 |
| `everyone_is_a_recoverer` | The membership check is kept and answered with the caller, so it passes for whoever asks. Second break beside `anyone_can_recover`, which removes the guard rather than corrupting what it reads | 1 |
| `a_channel_is_enough` | Naming a recoverer asks only that some channel exists rather than that one is outside the recoverer's control, so a recoverer holding every channel can recover in silence | 1 |
| `export_format_has_no_version` | The export keeps its format's name and drops its version, so a receiving host knows the shape's name and not which shape | 1 |
| `lineage_export_drops_the_giver` | The engine returns only the edges pointing at a household, which is what the giver's surface shows, so a member who moves loses their own record of what they gave. **Placed in the engine rather than in the export** so that it cannot drift with `export_only_what_surfaces_show`, which breaks the same probe one line away | 2 |
| `import_reads_a_format_it_does_not_know` | The import asks that a document name a format and not that the name be one this host knows, so an export written for another implementation is read field by field and whatever cannot be parsed is dropped in silence | 1 |
| `an_action_never_matches_its_household` | The live action is found and judged to belong to another household. The completed mutation in the 2026-09-13 run produces 9 conformance failures: the live-action acceptance probe directly catches this, while 8 others cannot exercise their permission, query or export properties after grant creation fails | 9 failure names; 1 direct catch |
| `the_route_opens_the_action_it_needs` | The route opens a live action of its own and grants against that, so a request naming none, or naming one that expired, is accepted. The ledger's check is untouched and answers a question the route has already arranged | 1 |
| `the_route_repairs_an_expiry` | An expiry in the past or at zero is moved a year forward by the route, so the ledger's refusal never fires and a permission meant to be brief outlasts anything the person agreed to | 1 |
| `an_empty_scope_becomes_everything` | A scope naming nothing is filled with a wildcard by the route, so the ledger sees one field and accepts it | 1 |
| `the_route_renames_the_household` | A grantee equal to the household is renamed rather than refused, so the person's own agent enters the ledger under another name and the row that can be revoked is the one the hub depends on | 1 |
| `the_route_drops_a_result_form` | A result form sent with a party grant is dropped instead of refused, so the request is accepted and the person is told nothing about the field they sent | 1 |
| `the_route_names_a_model` | The ledger holds no model and the list adds one on the way out, which is where a field arrives when the record is guarded and the response is not | 1 |
| `the_grant_response_prices_it` | The answer a person is shown when they grant carries a price for the grant, which is where a market in permissions appears before anything is stored. **The probe was walking the stored ledger only and saw nothing; it now walks this answer too** | 1 |
| `a_grantee_can_list_what_it_holds` | The same listing registered under the grantee rather than the household, which is the capability arriving from the other end. **The probe asked for one path and saw nothing; clause 39 is about the capability and not the spelling, so it now asks for four** | 1 |
| `a_gifts_route` | A route named for gifts rather than for receipts, enumerating what a household has been given. The clause is about the capability and not the word, and this is the word somebody reaches for second | 2 |

| `a_reciprocate_field_on_the_circle` | Clause 18, second break beside nudge_route and deadline_on_receipt. No route is added and no deadline is set: the circle's rows carry an invitation to reciprocate, which is the prompt arriving as a field rather than as a push. **Survived the first run.** No list in this repository held a word for prompting: clause 18’s deadline half was checked on receipts alone. The circle probe now sweeps for both. | caught, and named in the probe |
| `acts_carry_a_rank` | Section 7.7, second break beside lineage_acts_total. No total is added and each act is ranked instead, which is the same display arriving as an order rather than as a sum. The clause names totals and ranking together for this reason. **Survived the first run.** The acts surface was swept for the words of inaction and never for ordering, which lives in another suite’s list. Both lists now reach it. | caught, and named in the probe |
| `acts_include_gifts_not_answered` | Clause 16 and section 7.2, second break beside inaction_field_on_acts. No field is added and the gifts themselves are put on the giver's surface, so what is missing from the list is what was not reciprocated. Absence carries the signal the clause forbids returning. **Survived the first run**, because the existing probe posts an edge the giver sent and `actsVisibleToGiver` filters on `edge.to` before it looks at the kind, so the scenario never reached the line. A probe asking from the recipient’s end was added. | caught, and named in the probe |
| `an_accounts_route` | Clause 2, second break beside signup_route. A route under accounts rather than under signup, minting and returning an identifier. Nothing here issues an identity, and the clause is about the issuing and not about the word on the door. | caught, and named in the probe |
| `attest_replaces_the_key` | Section 17.1, second break beside attest_overwrites. The refusal is kept and the key is written before it fires, so the second caller's key is the one stored and the conflict is reported afterwards. Whoever could replace an attested key could speak for that merchant. **Survived the first run.** The probe read the 409 and never the effect of it. Presenting the original key again is idempotent, so one more call reads the stored key back without a route that returns keys. | caught, and named in the probe |
| `attest_returns_the_key_it_stored` | Clause 2, second break beside attest_returns_private_key. Attestation answers with the key it recorded, which is what turns recording a key somebody brought into issuing one: a caller who reads a key back from this route can believe the registry is where keys come from. **Rewritten 2026-09-11.** The first version changed only a return type, which bun strips, so nothing at runtime differed and the run reported SURVIVED for a mutation with nothing to catch. The route now answers with the key, and a probe reads the body. | caught, and named in the probe |
| `balance_on_the_household_list` | Section 6.1, second break beside balance_route. No route returns a balance and the household's own list carries one, which is where a stored value arrives when the route for it was refused and the idea was kept. **Survived the first run.** Two probes guard that list and each carries a different key list; the balance words were in the one applied to a single offer and to a settled one, never to the list. The hole was the cell between two lists. | caught, and named in the probe |
| `decide_writes_as_it_validates` | Section 10.5, second break beside decide_writes_on_refusal. The plan is kept and each line is applied as it is checked rather than after every line has been, so a set whose second line is refused has already changed the first. Nothing is written on refusal is the property, and a loop that writes as it goes breaks it without removing a single check. | caught, and named in the probe |
| `discovery_routes_registered` | Clause 1, second break beside routes_all_registered and narrower than it. Only the intent-layer routes are registered, which is the shape clause 1 is about: the infrastructure resolving becomes the infrastructure ranking, and it arrives under the name of a convenience rather than as a policy change. | caught, and named in the probe |
| `kept_needs_nothing_else` | Section 10.5, second break beside decide_writes_on_refusal, reaching the same probe from the other end: the line that makes a set bad stops being bad. A kept candidate with no kept_as is accepted, so the set the probe sends is written rather than refused and there is nothing to leave as it was. What the probe asserts is that a refusal changes nothing; this removes the refusal. | caught, and named in the probe |
| `notes_carry_a_count` | Clause 27, second break beside notes_summary_route. The lines stay where they are and the response counts them, which turns what one person wrote to another into a number about a product. A count is the smallest possible summary and the one nobody argues about adding. | caught, and named in the probe |
| `receipt_names_its_product` | Clause 19 and section 7.6, second break beside history_from_receipt, in the engine rather than on the route. A receipt keeps the product it was for, so a recipient's record becomes a purchase history: the clause says a recipient's profile starts empty beyond the fact of receipt. | caught, and named in the probe |
| `registry_answers_with_the_caller` | Section 17.2, second break beside registry_echoes_caller. The list names who asked, on the response rather than on each entry. The same answer to every caller is the property, and a field that varies by caller breaks it wherever it sits. | caught, and named in the probe |
| `registry_entry_carries_a_catalogue` | Section 17.2, second break beside registry_products_on_entry, in the record rather than on the response. An entry gains what a merchant sells, which turns a directory that resolves into one that can be browsed, and browsing is ranking with the order left implicit. | caught, and named in the probe |
| `registry_hides_the_unmarked_by_default` | Clause 55 and section 17.2. A caller who does not ask about the mark sees only the marked, which is the mark becoming a gate through a default rather than through a rule. Nobody writes that down as a policy; it arrives as the sense of a parameter. **Rewritten 2026-09-11.** The first version assumed `markOnly` could arrive undefined; the route computes it as `get("mark") === "true"`, so both branches behaved identically. The default now lives where it really lives, in the sense of the parameter. | caught, and named in the probe |
| `registry_resolve_needs_the_mark` | Clause 55, second break beside registry_resolve_404. An entry resolves only when it carries the mark, so the directory answers for some merchants and not others. The mark attaches to software and hosts and gates nothing, and a resolver that consults it has made it a condition of being found. **Survived the first run**: the listing probes read both entries and every resolve in the file resolved a merchant that happens to carry the mark. Being listed and being reachable are two gates. | caught, and named in the probe |
| `registry_sorts_by_the_mark` | Clause 55 and section 17.2, second break beside registry_featured and registry_accepts_sort. No flag is added and no parameter is accepted: the one order the registry has is changed so that marked entries come first. Key order is the only order that says nothing, and this is what it looks like when something is said quietly. **Survived the first run because of the fixture, not the probe.** The seeded entries were `a-merchant-marked` and `b-merchant-no-mark`, so mark-first order and key order were the same list. The names were swapped so that three orders disagree. | caught, and named in the probe |
| `registry_takes_a_query_parameter` | Section 17.2, second break beside registry_search. The parameter guard is widened by one name rather than removed, which is how a query by intent arrives: not as a search route but as one more allowed word. | caught, and named in the probe |
| `the_challenge_is_any_set` | Section 10.5. The challenge is compared against the empty bytes rather than against the decided set's, so no correct assertion verifies and the one shape a member with a passkey can send stops working. The probe this catches asserts the good case, which is the half of the pair that says the comparison is to the set: its neighbours assert refusals, and a check that refuses everything passes all of those. | caught, and named in the probe |
| `the_circle_counts_itself` | Section 7.7, second break beside lineage_acts_total, and on the circle rather than on the acts list. Each row carries how many edges the other party has, which is the network's size arriving one row at a time rather than as a total. **Rewritten 2026-09-11.** The first version built a degree map and never used it, so no response changed. `mutate.sh` asks only whether the text of src changed, which dead code satisfies. | caught, and named in the probe |
| `the_circle_row_carries_a_degree` | Clause 21 and section 7.7. The row gains the count the mutation beside it computed, which is the second half of the same break and is kept separate so that each anchor stands alone. | caught, and named in the probe |
| `the_hub_answers_for_offers` | Section 13.1, second break beside roles_are_swapped. The roles are not exchanged and the gate is widened: a role that owns a route also answers for one it does not own, so a deployment presenting the person's side alone answers for the presenter's too. A deployment is judged on the surface it presents, and a surface it may quietly extend is not one. | caught, and named in the probe |
| `the_list_is_the_households_union` | Clause 8, second break beside presenter_optional. The presenter is still required and then ignored, so the list a presenter reads is every offer the household holds. The other mutation makes the parameter optional; this one keeps it and answers a different question. | caught, and named in the probe |
| `the_registry_is_the_engines` | Clause 1 and section 17, second break beside registry_needs_both_roles. The registry stops belonging to neither role and becomes the engine's, so a hub alone cannot resolve a merchant and a deployment that presents the person's side has to hold a presenter's surface to look one up. A directory that belongs to a side is a directory that side can shape. | caught, and named in the probe |
| `unknown_route_answers_200` | Section 9.1 and clause 1, second break beside routes_all_registered, which carries thirteen probes on one anchor. This one leaves every handler alone and turns the router's own default from a refusal into an empty success, so a forbidden route answers 200 without anybody registering it. A default that says yes is how a route nobody wrote comes to exist. | caught, and named in the probe |

| `maker_is_the_merchant` | The candidate's maker is the merchant's own name again, which is what this field held until 2026-09-12: the specification answered clause 12's "names who made it" with the seller's name, under the gloss "who made it: the merchant of record". **It survived the first probe written for it**, which asked only that the field be a non-empty string. The deployment now declares who made each product, as it already declares the prices, and the probe compares | caught, and named in the probe |
| `receipt_line_without_maker` | The maker blanked on every line of a receipt, keeping the merchant, which is a receipt that says who took the money and not who made the goods (clause 12) | caught, and named in the probe |
| `hide_maker_on_edge` | The maker dropped from a stored lineage edge, so a gift travels with the seller's name and without the name of whoever made the thing. Clause 12 ends "every lineage edge names who made it" | caught by two probes |
| `catalogue_form_is_malleable` | The catalogue's parts joined without escaping them, which is what the form did until 2026-09-12. A merchant named `a:b` with a maker of `c` then makes the same bytes as a merchant `a` with a maker `b:c`, so whoever relays a catalogue can move the boundary between who sold a product and who made it, and the presenter's signature still verifies. **The mandate's form and the edge's had both been escaped for this reason on 2026-09-11; the catalogue was the third place with the same defect**, found by writing the unit test for the maker being in those bytes at all. Caught by the engine's own tests rather than by a probe, for the reason the retired row below gives. **The first version of that unit test did not catch it either**: it compared a merchant of `shop-1` with a maker of `made-by-tea` against a merchant of `shop-1:made-by-tea` with an empty maker, and an empty field still emits its separator, so the two differed by one colon under the very join the test was written to refuse. The pair has to keep the same number of parts | caught by the engine's tests |
| ~~`maker_outside_the_signed_catalogue`~~ | **Retired 2026-09-12 on the day it was written.** It took the maker out of the catalogue's signed form, and the seed signs with it, so registration failed and the suite never started: it reported ABORTED rather than failing a probe. **The conformance probes talk HTTP and cannot present a catalogue signed one way and read another**, so the property is not reachable from them. It moved to `engine/test/catalogue-bytes.test.ts`, where the function can be called directly | retired, not reachable by a probe |

| `disclosure_not_carried` | An offer carries no disclosure, so a person signs without seeing what the seller had to say (§10a.4). **Its first version was a no-op**: it prepended an empty map to the spread, which adds nothing and leaves the real one, so it changed the text of `src` and no behaviour. **Rewritten, it breaks the shared fixture**: every decided set names a merchant, so no decision in any suite succeeds and 28 probes fail in their setup. It is the third name in `coverage.sh`'s exclusion list, and the probe that proves §10a.4 is the one named beside it, which fails on its assertion | caught, and excluded from the count |
| `disclosure_items_reordered` | The items come back sorted by label rather than in the merchant's order (§10a.2). **Order is composition**: a surface that decides which of a seller's statements a person reads first has composed the notice it was rendering, and nothing about the text itself has to change for that | caught, and named in the probe |
| `decide_without_disclosure` | The decision check dropped (§10a.3). Re-targeted on 2026-09-13: the old first-match anchor changed presentation instead. The corrected mutation survived the existing 279 conformance and 116 unit tests. An added unit test imports an already presented offer without disclosures, checks the named refusal and unchanged state, and accepts a complete import | Isolated corrected mutation: 0 conformance failures and 1 new unit failure; 117 unit tests run |
| `disclosure_from_the_request` | The request that creates an offer carries the disclosures and the engine takes them from there (§10a.1). **A field through which a caller writes a seller's legal text is the same defect as one through which a caller writes a price** | caught, and named in the probe |

| `disclosure_not_on_the_approval_screen` | The disclosures left off the approval render, which is the screen a person signs from. **This is the shape the requirement arrived in**: when §10a was written the block reached `GET /offers/{id}` and stopped there, so the requirement was satisfied on a surface no member's hub reads, and the probe written for it was looking at the wrong one | caught, and named in the probe |
| `disclosure_unchecked_at_presentation` | An offer whose candidates name a merchant with no disclosure is presented. The household then reads a candidate it can never buy, decides on it, signs, and the whole set is refused at the decision, because a decided set is all-or-nothing. **§10a refused only at the decision when it was written**, on reasoning a refutation pass showed backwards | caught, and named in the probe |
| `disclosure_signature_unchecked` | The block on an offer trusted without verifying it. A block this host recorded always verifies, so the loss is invisible until §14.2's import carries blocks signed by keys this host may never have held. **Caught by the engine's own tests rather than by a probe**, for the reason the retired catalogue mutation could not be reached | caught by the engine's tests |
| `approval_quantity_is_one` | Every candidate on the approval screen shown at a quantity of one, whatever the offer holds (§10a.5). A screen that shows the block and a price and the wrong quantity has shown standing terms and not this sale | 1 |
| `approval_price_blank` | The unit price blanked on the approval screen, the offer still holding it (§10a.5). The same defect from the other side: the person signs against a block with no amount beside it | 1 |
| `approval_without_carriage` | The carriage left off the approval screen while the hub holds a delivery record for the offer (§10a.5, §7.5b). The one fact of the sale the offer does not carry, and the one a merchant must not | 1 |
| `approval_maker_is_merchant` | The approval screen fills `maker` with the merchant's name again (clause 12). A probe that checked the field was present passed it; the probe compares against who the deployment says made it | 1 |
| `approval_hides_giver` | `given_by` dropped from the approval screen, so a gift and a purchase look the same on the one surface a person signs from (clause 10, §6.2). Found by a refutation pass on 2026-09-12 | 1 |
| `settle_without_statement` | A physical box with goods used is charged on the collection's record when no signature arrives (§6.5). **This is what the reference did until the evening of 2026-09-12**: a debt made by a third party's record, with no act of the household on any device | 1, and 1 unit test |
| `settle_ignores_dispute` | The signature over a statement marking a line disputed verifies, and the line is charged anyway (§6.5). A dispute that changes nothing is a note on a receipt, not a line leaving the rail | 1, and 1 unit test |
| `present_despite_unsigned_statement` | The next physical box is presented while the last one's statement stands unsigned (§6.5, §11.2). Nothing then presses a household to sign, and the merchant accrues a claim the rail cannot collect and the household never confirmed | 1, and 1 unit test |
| `disclosure_product_unsigned` | The product left out of the bytes a merchant signs, so a block signed for one product verifies re-filed under another or under the merchant as a whole (§10a.5). **Caught by the engine's own tests and by no probe**: the suites hold no merchant key and cannot re-file a block, so the property is proven where the canonical form lives | caught by the engine's tests |
| `product_block_not_carried` | A merchant's block for one product never attached to an offer holding that product; only the standing text travels (§10a.5). The household is shown the general terms against a product whose terms differ, which is the misleading display the product key exists to prevent | 2, and 1 unit test |
| `withdraw_resets_the_collection` | The cooling window resets the collection's own verdicts, so a household inside the window signs `returned` over goods it ate and settles at zero on a receipt saying they came back unopened (§16.5, §11.2). **This is what the route did**, and it was found by a refutation pass hours after §6.5 was written to close the same hole from the other side. **Caught by the engine's own tests and by no probe**: reaching it needs a mandate with a cooling window, and the conformance suites share one mandate, so a probe that set one would take the corpus down with it (the permissions suite records fifteen probes lost that way on 2026-09-11) | caught by the engine's tests |
| `line_names_the_wrong_block` | Every line of the approval names the merchant's standing text as the block that governs it, whatever the offer carries for that product (§10a.5). A household reading a product's line is pointed at the general terms, which is the misleading display the product key exists to prevent, arriving through the join rather than through the block | 1 |
| `statement_line_without_its_block` | The statement's lines carry no block at all, so the screen a household signs a physical settlement from shows several merchants' blocks and nothing saying which governs which line | 1 |
| `gift_eligible_per_household` | The offer view carries a gift eligibility for the household (§7.6b). **An eligibility a maker can set for one household is one it can set for the household that wrote about the last gift**, which is 令和5年内閣府告示第19号's inference written into the protocol rather than left to a merchant's own conduct | 1 |
| `exclusion_rule_for_silence` | The published list of reasons an agent may exclude a candidate gains one about what a household wrote (§7.6b, §10). An agent may then drop a household that said nothing, and the reason is one a person can read and cannot refuse | 1 |
| `ceremonial_may_be_physical` | A ceremonial offer is accepted in the physical binding, where clause 25 charges the giver and §6.5 asks the household to sign the settlement statement: the party charged takes no act and the party that acts pays nothing, which is the premise §6.5 rests on. The statement cannot be handed to the giver instead, because it lists what the recipient used (clauses 24, 16) | 1 |
| `settle_without_a_delivery` | A physical box with goods used settles with no delivery recorded, so the statement the household signed showed `carriage: null`. 法11条1号 asks for the carriage beside the price where the price does not include it: a merchant whose price includes it records `0`, and `null` is an implementation that never recorded what it did | 1 |
| `engine_reads_its_own_deliveries` | A split deployment points the engine at its own empty register instead of the hub's, so both screens rendered under an offer's path show `carriage: null` while the hub holds a delivery (§13.1, §7.5b). **Caught by `roles/` alone**, since a deployment presenting both roles reads one register either way | 1 |
| `commit_before_the_ceiling` | The ledger commits before the daily ceiling is asked, so a refusal leaves the reservation committed while no settlement exists and the offer stays `decided` (§6, §16.3). `commit` is idempotent, so a retry returns the committed row and cannot undo it: on an adapter that moves money the household has been charged for a settlement that is not there. **"Nothing is written on refusal" was false at the ledger** | caught by the engine's tests |
| `export_drops_collections` | The node export leaves out what the route found in each physical box, so a move lifts §6.5's block: the offers arrive with their `consumed` valences, the receiving host has no record of a collection and presents the next box freely, and the sending host holds a block over a household that has left. **It survived its first run**, because the unit tests written with it reached the recovery ledger and the engine directly and never went through `exportNode`; the probe that catches it uses the two hosts | 1 |
| `product_block_signature_unchecked` | The check at the decision verifies one block per candidate, which is the merchant's standing text, so a product block carried by a §14.2 import reaches the approval and the settlement statement unverified: signed for another product, or by nobody, and rendered as the merchant's word. **Caught by the engine's own tests and by no probe**, for the same reason `disclosure_signature_unchecked` is: the suites cannot present a block signed by a key the host lacks without importing an offer | caught by the engine's tests |
| `block_counts_unsettleable` | The unsigned-statement block counts a box nobody can settle: one still `presented` after a partial collection, where `settle` is a `409`, and one a presenter withdrew, which can never settle at all. Either makes a household unofferable by every presenter on that engine with no act available to it that would lift the block | 1, and 2 unit tests |
| ~~`refusal_names_the_offer`~~ | **Retired 2026-09-12, the evening it was written.** It put the waiting box's id back in the refusal, to show that naming it handed one presenter another's offer id. The founder then narrowed the block to the presenter's own boxes, so the only offer that can be named is one that presenter sent itself and there is nothing left to leak. The property is structural now, and the row below tests it |
| `block_spans_presenters` | The unsigned-statement block counts every presenter's boxes, so one presenter's unsettled statement stops another's delivery and the refusal is computed from a cross-presenter union. **Clause 8 gives that union to the person and to nobody else**, and §16.3 records the same objection against an engine computing a household's daily total. On a split deployment the wide version also reaches nothing, since each engine holds its own offers, so it promises a pressure it cannot apply | 1, and 1 unit test |
| `collect_accepts_strangers` | A collection names candidate ids belonging to no candidate of the offer. Nothing is resolved and the offer still reads as collected with goods used, so §6.5's block holds over that household with no line for it to sign | 1 |
| `statement_drops_lines` | The statement screen shows no lines, so a household signs a document naming nothing while the engine charges the collection's record. What is signed and what is shown come apart, which is the one thing the statement exists to hold together | 10 |
| `statement_without_carriage` | The statement never shows the carriage though the hub holds a delivery record (§7.5b). 法11条1号 wants it on the screen where the application is made | 1 |
| `canonical_form_without_carriage` | Carriage leaves the engine's canonical statement. In the completed mutation of the 2026-09-13 run, the independent conformance signer cannot produce an accepted valid signature; the unit signer uses the mutated form and its wrong-carriage signature is accepted. These are different assertions, and not every failed conformance property is a direct carriage check | 13 conformance failure names and 1 unit failure; see binding probe note |
| `statement_without_expiry` | The statement drops the offer's expiry, which the approval carries and which a merchant's stated application period is measured against. **The field was missing entirely** until a sufficiency pass asked what the period was measured against | 1 |
| `statement_bills_a_gift` | The statement proposes a gift at its catalogue price, so the household signs for goods that arrive at their price and are never billed (clause 10, §6.2). The settlement still charges zero, so the signature covers a document the receipt contradicts | 1 |
| `statement_domain_dropped` | The domain tag leaves the statement's canonical bytes, so a statement and a decided set are signed over the same prefix in the same four-field shape, told apart only by the type of one field | 8, and 1 unit test |
| `dispute_any_line` | A household may dispute a line it kept, so the set it signed at the decision is unpicked line by line at settlement and it chooses after the fact what it pays for (§11.2) | 1, and 1 unit test |
| `statement_signature_unchecked` | The statement's signature is taken on faith: anything in the body settles the box. Distinct from `settle_without_statement`, which removes the whole requirement | 1, and 1 unit test |
| `settlement_hides_the_confirmation` | The settlement records no confirmation, so what proves the household applied for the consumed lines is absent from the one durable record of the sale. The charge is right and the evidence is gone | 1, and 1 unit test |
| `settlement_hides_the_dispute` | A disputed line is left out of the settlement's own account of itself: `disputed_amount` reads zero and the line says `disputed: false`. The money is right and the record says the household confirmed what it refused | 1, and 1 unit test |
| `product_block_replaces_standing_text` | A product block filed under the merchant's own key, so registering one replaces the standing text and every other product of that merchant is shown one product's terms as the whole disclosure (§10a.5). **It breaks the fixture**: the merchant's standing block is gone, so no decision naming that merchant succeeds and every suite that decides anything goes red. Caught, and the shape is the one `fragility.py` flags rather than a corpus that reaches it | 70, and 1 unit test |
| `kept_gift_is_billed` | A gift the household **kept** is charged at its price, while a gift it **used** stays free. §6.5's statement puts 0 on a gift whatever its valence, so a household signed a document reading 0 and the ledger committed the price: measured at ¥3,300 committed against a screen reading ¥900. **Every test until that night consumed the gift and none kept one** | 1, and 2 unit tests |
| `approval_hides_the_valence` | The approval renders every candidate identically, with nothing to say which lines a collection or an earlier decision has already resolved (§10 step 3c). A physical box is collected line by line and the offer stays `presented`, so a hub that asks for a choice on every candidate posts a set naming a consumed one and can never confirm the lines still the household's | 1 |
| `delivery_carriage_overwritten` | A second delivery record overwrites the carriage as well as the status (§7.5b, 法11条1号). The figure is what the approval and the statement put in front of the household before it signed | 1, and 1 unit test |
| `settle_answers_a_second_signature` | A household's signature over a box that has already settled is answered with the settlement that stands (§6.5). Two tabs of one statement, the second disputing a line: the second read as signed, was told the first settlement's charge, and its dispute was recorded nowhere. Re-anchored 2026-09-13 when the branch gained the comparison below | 1, and 2 unit tests |
| `settle_refuses_its_own_signature` | The comparison alone: a household re-sending the bytes that settled its box is told the signature "was not what settled it", when the engine holds those bytes and could say otherwise. A member whose answer was lost is charged and told nothing was recorded | 0, and 1 unit test |
| `cooling_bars_a_statement` | A cooling window bars the household's signature over a settlement statement (§16.5, question 42). A collection stamps the window's start, so a box nobody answered sat inside one and a member who set a day lost a day of deliveries after every swap with anything used | 1 |
| `withdraw_a_set_nobody_signed` | A set the household never signed can be taken back (§16.5, question 43). The box returns to `presented` with the collection's verdicts intact, reaches no section of the household's list, and §6.5's block lifts, so a withdrawal can leave consumed goods charged to nobody | 2, and 1 unit test |
| `reserve_holds_a_gift` | The reserve taken at presentation holds a gift's price (§6.2, clause 10). Nothing is charged by it, which is why it outlived by three days the settlement rule it contradicts; on an adapter that authorises, the authorisation covers money that can never be taken | 0, and 1 unit test |
| `import_rewrites_the_carriage` | The household import route overwrites a recorded carriage (§7.5b), bypassing the rule `record` enforces, so the guard written the day before was true of one door and false of the other | 1 |

**Seven were written on 2026-09-12 with §10a**, the merchant's disclosure. **Three of them exist because a refutation pass over that day's own work found the requirement satisfied on a surface nobody signs from, the refusal placed where it costs a household most, and a second signature check no probe could reach.** One of the first four is the fourth no-op of the day: a return type, a map nobody read, a branch the route cannot reach, and now an empty spread. **The common cause is writing the break as the smallest textual insertion rather than as the behaviour it should remove**, and `mutate.sh` cannot tell the two apart because it asks only whether the text of `src` changed.

**Five more were written on 2026-09-12 with the `maker` field**, which answers clause 12's "names who made it" with a party of its own rather than with the merchant's name. One of the five was retired the same day and one of the others found a defect in a third signed form.

**Twenty-five more were written on the evening of 2026-09-11 and ten of them survived the first time they were run.** That is by far the worst result the corpus has had, and none of the ten was an engine defect. **Four were probes that guarded a route and not the surface beside it**, or read a refusal's status and not its effect. **Two were the fixture**: the two seeded registry entries were named so that mark-first order and key order were the same list, and every resolve in the suite resolved a merchant that happens to carry the mark. **Three were not mutations at all** and are recorded as rewritten above: a return type that bun strips, a map that was built and never used, and a branch that could not be reached because the route always supplies a boolean. `mutate.sh` asks whether the text of `src` changed, which all three satisfied, so each was reported as SURVIVED when there was nothing to catch. **The tenth is the one worth keeping in mind**: `acts_include_gifts_not_answered` removed a line the existing probe's scenario could not reach, because the function filters on the edge's recipient before it looks at the kind.

**So there is a third kind of hole, beside a probe that cannot fail and a probe that can only fail one way: a probe that guards one response and not its neighbours.** The suites hold nine key lists, each defined inside one suite and applied to a handful of routes in it, and the words that mattered here fell between them. `balance` was in a list that never reached the household's list; `rank` was in three lists and in none that reached the acts surface; nothing anywhere held a word for prompting.

**Twenty-two of these were written on 2026-09-11 to thicken the thinnest part of the corpus**, after `fragility.py` measured 70 of 227 probes resting on a single mutation. They are second breaks for the `mandates`, `exit` and `permissions` probes, which are where a person's own protections are: the co-signers, the ceilings, the recovery log, what leaves with a node, and what anyone else was ever allowed to read. **The permissions ten sit in the route rather than in the ledger**, because all ten of the existing breaks remove a check inside the ledger and a second break in the same place would drift with the first: these let the route arrange the answer before the ledger's check is asked. A probe caught by one mutation loses its proof the moment that script's anchor drifts, and four anchors have drifted here already. Where a second break could sit in a different file from the first it was put there, because two anchors on one line drift together.

**One probe could not be given a second break, and the reason is worth more than the mutation would have been.** `an assertion for one version does not record another (§16.1)` rests on the challenge check in `verifyAssertion`, and every other way of admitting a wrong assertion also rejects the right ones: the suites compute the canonical form themselves, so weakening the form in the engine stops the seed rather than a probe, and weakening the challenge derivation rejects every assertion the suites make. **That probe rests on one mutation because it rests on one check**, which is a fact about the design and not a gap in the corpus. Two mutations written for it were measured, found to break the fixture or to miss, and discarded rather than kept as ledger rows nobody could reproduce.

**Swept in full on 2026-09-12 over the 242 the corpus now holds: 241 caught, one aborting, none surviving and none inert**, at valence `34b6538` and ataraxia `0b92e8c`. `fragility.py` against the same logs reads 227 probes with a catch and **20 resting on a single break**, against 48 at 220 and 70 at 198.

**Eighteen were run again on the evening of 2026-09-12, on a branch and not in the sweep**, because questions 35 and 36 were decided and built after that sweep began and the sweep's own checkout could not be touched. Six are new: three for the household's signature over a physical settlement statement (§6.5) and three for the product key on a disclosure (§10a.5). Six are the approval-screen breaks written earlier the same day, measured here for the first time. Six had drifted under the new lines and were re-anchored, and each was re-measured rather than assumed: `decide_without_disclosure` 1 probe and 1 unit test, `disclosure_not_carried` 70 and 27, `disclosure_not_on_the_approval_screen` 2, `disclosure_unchecked_at_presentation` 1 and 1, `receipt_line_without_maker` 1, `settlement_lines_without_merchant` 1. **All eighteen were caught, none survived, none was inert and none aborted.** **The corpus is 264 scripts and `anchors.py` reports 0 drifted.** Measured clean on the branch the same evening: **251 tests across 14 files, 250 passing and one skipped**, against the 231 the sweep of that morning ran. Neither 264 nor 251 is a swept figure until a full run measures them together, and the eighteen verdicts above are a batch of single runs rather than a sweep.

**Then two independent passes over that evening's own work returned ten errors nobody had listed, and the fourteen mutations below were written for what they found.** The one that matters most for this ledger is not an engine defect. **`hub/statement.ts`, the screen a household signs a physical settlement from, had no mutation at all**, and neither did `not_disputable`, the statement's own `bad_signature`, the assertion path, `confirmation` or `disputed_amount`. The probe that read the statement asserted `disclosures.length > 0`, which is the defect §10a.2 exists against by name. **Eighteen mutations had been run against that surface's neighbours and reported all caught, and the surface itself was unmeasured.** The rule this project already had, that a field, a route or a surface arrives with its probe and its mutation in the same change, was followed for the engine's side of §6.5 and not for the hub's.

**All fifteen were run the same night, one at a time, and all fifteen were caught; none survived, none was inert, none aborted.** Three of the fifteen are caught by the engine's own tests and by no probe, and each says why in its row.

**Two things that had lived in prose alone were then made checkable.** §10a.5's rule that a merchant's block belongs beside that merchant's own lines was an instruction about layout, so no probe could reach it and a hub could pair any block with any line; each line names its block now. And §7.6b was written for 令和5年内閣府告示第19号, whose 運用基準 asks whether a display was the third party's own and counts as consideration 「対価性を有する一切のもの」, which the next gift is: the specification carries none of the three levers a note could be bought with, and says plainly what it cannot reach.

**Before them, all six open defects were fixed, three of them on a decision the founder took the same night: a ceremonial offer is digital, the carriage crosses the role split through a fourth thing on §13.1's interface, and a physical box with goods used does not settle without a delivery recorded.** Requiring the delivery took ten probes and seven unit tests red, because the physical probes had never recorded one; a helper now records one wherever a probe collects a box. **Before them, two fixes needed no decision**: the ledger now commits past every refusal, and the node export carries `collections` with the format at `valence-node/4`. `export_drops_collections` is the reminder the ledger keeps repeating: **it survived its first run because the tests written beside it went around the surface it breaks.**

**The founder also took the two decisions the build had settled without being asked**, and a mutation came with them: the block narrowed to the presenter's own boxes (clause 8), `refusal_names_the_offer` retired with the leak it existed to show, and `block_spans_presenters` written for the new rule. Both branches merged afterwards. **Measured on merged main: 257 tests across 14 files with one skipped, 105 unit tests, and `anchors.py` reading 278 scripts with 0 drifted.** None of it is a sweep.

**Measured, not asserted.** `engine/scripts/coverage.sh` applies every mutation
in turn and collects the probes that failed, and the notes in the suites are
written from its output rather than from intent. **Re-measured in full on
2026-09-11**, after the two conformance roles, the store, and the passkey's
assertion, at an exploration rate of 0.2.

| | 2026-09-09 | 2026-09-10 | 2026-09-11 | 2026-09-11, seed fixed | 2026-09-11, midday |
|---|---|---|---|---|---|
| mutations | 167 | 173 | 184 (182 counted) | 192 (190 counted, 2 excluded for breaking the shared fixture) | **198** (196 counted, the same 2 excluded) |
| declarations | 183 | 188 | 202 | 210 | **218** |
| probes at runtime | 197 | 202 | 216, one skipped | 223, one skipped | **231**, one skipped |
| shown to fail | 191 | 197 | 206 | 217 | **225** |
| not shown to fail | 6 | 5 | 10 | 6 | **5** |
| surviving | 0 | 0 | 0 | 0 | **0** |
| inert | 0 | 1, found and fixed | 0 | 0 | **0** |
| aborting before a probe runs | 1 | 1 | 3 | 1 | **1** |

**The fourth column is valence `125b5bc` and ataraxia `a3952e3`**, measured after the role-split seed was made non-fatal. The three role-table mutations that aborted in the column before it are caught by name: `roles_are_swapped` by nine probes, `registry_needs_both_roles` by four, `identities_need_both_roles` by three. Of the 217 probes with a catch, 110 rested on a single mutation. The raw logs of that run were lost to a reboot of the machine before they were archived, so nothing below it is regenerated from them; the figures were computed from those logs before the reboot and recorded in the session that ran it.

**The last column is valence `21be218` and ataraxia `0a1c935`**, swept between 10:05 and 12:47 on 2026-09-11, and it is the first run whose raw logs were kept: they are archived outside `/tmp`, which is where `coverage.sh` writes them and where the reboot found the last set. It covers the six mutations the column before it did not reach, which are the assertion shape on a mandate change and on a co-signature, the import rule, the escaped canonical form, the collection's moment, and one for the probe that had none.

**What was added after that run is not in it.** Twenty-two mutations on 2026-09-11, each run alone against the whole corpus, which leaves the corpus at **220** and the last swept figure at 198. Every one was watched failing the probe it was written for, and what each caught is in its row. Two more were written, measured, and discarded: one stopped the seed instead of a probe, and one was refused by the probe it was meant to slip past. **Two of the twenty-two found a probe rather than a defect**: they broke what a clause forbids in a shape the probe was not looking at, so the probes were widened and the mutations kept. A mutation that survives because the probe asked too narrow a question is a finding about the probe. **A mutation nobody can reproduce is not a ledger row**, so they are named here and not in the table.

**How to read the two ratios, which are not the same number.** Of 231 probes declared and run, one skips and 225 have been shown to fail, counting only the 196 mutations that do not break the shared fixture; counting the other two as well makes it 227. So **five runnable probes have no proof from this run**. The engine's own unit tests are a separate population and are not in that ratio: 78 run, and 40 of them failed under at least one mutation. **Of the 227 probes with a catch, 70 rest on a single mutation**, which is where this corpus is thinnest, and seven rest only on a mutation that spans nine or more suites, which is the shape of one that breaks the fixture rather than one the corpus catches. `scripts/fragility.py` in the valence repository names all of them.

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

**The six never shown to fail in the run after the seed fix**, each named rather than counted. The four role probes and the registry probe that the seed had cost are proven again, and one more, the both-shapes probe, gained its mutation the same day and waits on the next sweep:

| Probe | Why |
|---|---|
| `approval` > an offer is accepted from another client as it is from the reference hub | Its mutation is `reject_foreign_offer_client`, which is excluded for breaking the fixture across fourteen suites |
| `registry` > an offer names a merchant the registry does not list, and is created | Its mutation is `require_registered_merchant`, which aborts the setup |
| `binding` > consumed and lost cannot be reached from the digital binding | Needs a deployment with no physical binding, which this one is not. **It is the one probe the run reports as skipped**, so it is unproven twice over: not shown to fail, and not run |
| `exit` > recovering does not make the recoverer able to read | The reference authenticates nobody, so a recoverer's view and a stranger's are the same view. The probe says so in its own note |
| `floor` > one short of the floor is refused | The boundary case. `floor_off_by_one` moves the floor and is caught elsewhere before this probe sees it |
| `approval` > a set carries a signature or an assertion, and not both | Written on 2026-09-11 with the passkey's assertion, and no mutation was written beside it. The recurring failure of this project, in its plainest form **Its mutation, `both_shapes_accepted`, was written later on 2026-09-11** and fails this probe and no other; the run that would count it has not happened |
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

§13 listed eight conditions when this table was written and lists sixteen
since 2026-09-12; it says passing the tests is what entitles an
implementation to the mark. The eight are covered, and the two added on
2026-09-12 are below them.
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
| 15 the merchant's disclosure, as composed, beside the sale | yes | `disclosure/` compares the block on the offer and on the approval screen against the one the deployment registered, checks the quantity, the price, the expiry and the carriage beside it, and since 2026-09-12 that a product's block travels only where its product is and never in the standing text's place |
| 16 a physical box with goods used settles on the household's signature | yes | Nine probes in `binding/`: the statement, the empty settle refused, a signature over other lines or by another key refused, the assertion shape accepted, a disputed line off the charge, dispute limited to consumed lines, the next box withheld while a statement stands unsigned, and no statement where nothing was used |

Clauses 43, 52 and 53 are outside §13 and are covered by `exit/`, which runs
against two hosts and asks each surface whether the second answers as the first
did.

What no probe here reaches is stated in the suite READMEs rather than left to be
found: the host's blindness is a property of what it stores rather than of its
API, a reminder refusal that is really an hour-long backoff outlasts any probe,
the routes an implementation does not have cannot be enumerated from outside,
and the lineage circle differenced against the acts stream still yields a
dateless form of inaction that nothing removes.

## A survivor that was not one, and the check written for it

**The sweep of 291 on 2026-09-12 reported one survivor, `settle_at_latest_config`, and it was not a survivor.** The script has two replacements: select the presenter's newest catalogue instead of the version stamped on the offer, and price from it. The second named a line the kept-gift fix had rewritten hours earlier, so the pricing half silently did nothing while the first went on choosing a config and using it for nothing.

**`mutate.sh` asks only whether `src` changed**, which it had, so the run reported a rule no probe covers. **A partly applied mutation is worse than an inert one**: inert is reported, and this is not, and a false survivor sends somebody looking for a probe that already exists. Repaired and measured: 17 probes and one unit test catch it.

**`anchors.py` could not see it either**, because it detects drift by running each script and watching it raise, and only about sixty of these scripts assert anything. It now also reads every anchor statically, whether or not the script asserts it, and was measured against the script as it stood during the sweep: it names it. **It then caught two more within minutes of landing**, both drifted under the same day's changes, one of which asserts nothing and would have gone silent in the next sweep.

**What this costs the figures on this page.** The run of 291 measured a corpus in which one script had stopped testing its rule, so its row here rested on nothing from 2026-09-12 until it was repaired.

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
