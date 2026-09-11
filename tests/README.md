# Conformance tests

An implementation that passes these may use the Ataraxia mark. One that stops passing loses it. That is the only sanction, and it is deliberately the only one.

Anyone can run them, against anyone's implementation, including ours. There is no private suite and no certification body to apply to.

## What is testable, and what is not

Most of the constitution is not mechanically checkable. Whether a foundation sells governance seats, whether a brand bought a slot, whether the founder kept a promise — none of that is decided by a test run.

What *is* checkable is a specific and useful subset: **capabilities that must be absent, and behaviours that must be refused.** A clause that says a field does not exist can be checked by looking for the field. A clause that says an order is never created by silence can be checked by staying silent.

So these tests are not a certificate of good conduct. They check the parts of the constitution that were deliberately written to be structural rather than promissory, which is the reason the constitution was written that way.

## Suites

All ten are written. Three were not in the original scoping and came from
reading the clause list inward rather than outward from the probes, which is
the direction that finds what nothing checks: `lineage/` for clause 22,
`binding/` because `lost` is reachable only through the physical binding, and
`machine/` for the four transitions no other suite touched.

| Suite | Clauses | What it checks | Written |
|---|---|---|---|
| [`absence/`](absence/) | 1, 2, 3, 8, 9, 11, 12, 27 to 30, 49, and §3.3, §6, §7.7, §9.1 of the spec | Capabilities that must not exist: discount objects, ratings, urgency fields, per-person event stores, tracking sockets, broadcast and segment routes | yes |
| [`floor/`](floor/) | 26, and spec §5 | An offer below the exploration floor is refused with `422`, no configuration bypasses the check, and the rate cannot reach zero | yes |
| [`silence/`](silence/) | 23, 25, 32, 33, and spec §2.2 and §12 | An undecided digital offer creates no order at expiry; no configuration makes silence into consent; at most one reminder is sent | yes |
| [`opacity/`](opacity/) | 16, 18, 19, 20, 21, and spec §7.2, §7.6, §7.7 | No response surface discloses or permits inference of recipient inaction; reciprocation is never prompted; a recipient's record holds nothing but the fact of receipt | yes |
| [`binding/`](binding/) | spec §3.2, §6.2, §11 | A household is never billed for goods that were lost, what was used is bought at the merchant's own price, and a gift is never billed to the person who received it | yes |
| [`lineage/`](lineage/) | 2, 19, 22, and spec §7.1, §7.6 | An edge is accepted on its signature and never on the client that sent it; a recipient's record holds the fact of receipt and nothing else | yes |
| [`machine/`](machine/) | spec §2.1 | Withdraw, partial deciding, and that `settled` is terminal | yes |
| [`approval/`](approval/) | 6, 34, 35, 36, 54, 58, 59, and spec §10 | The screen carries the alternatives, the argument against and the reason for an exclusion, and carries no presentation | yes |
| [`permissions/`](permissions/) | 9, 20, 37 to 42, 46, 47, 58, and spec §7.4, §7.5, §16 to §16.6 | Asked at the moment of use, time-limited, always visible, revoked one at a time, and never priced. Since 2026-09-10 also the mandate's thresholds: a daily ceiling across presenters, the categories that need a second signature, a cooling window with a route to take a signed set back, and a refusal that names which of them refused | yes |
| [`registry/`](registry/) | 1, 6, 13, 55, and spec §17 | The endpoint registry resolves and does not rank: key order, no score, no query by intent, the same answer to every caller, and the mark never a gate | yes |
| [`roles/`](roles/) | 1, 8, 43, and spec §13.1, §13.2 | An implementation answers for the surface it presents, and the answer has something behind it: an engine alone does not answer for the household's surface, a hub alone does not answer for the presenter's, delivery is the hub's and deciding is the engine's, the registry is answered by either, and a settlement made on one party reaches the person's own copy on the other | yes |
| [`exit/`](exit/) | 43, 52, 53, and 5 and 43 for the shop's own export (§14.1) | Full export in a documented format; a node moves host intact; recovery and routine reading are separate powers and recovery is logged | yes |
| [`merchant-exit/`](merchant-exit/) | 5, 43, and spec §14.1 | A shop leaves with its ledgers: the catalogue, its own offers, how each settled, its recovery rows, no other presenter's offers, no private line and no delivery | yes |

Every probe in the three written suites carries a note recording the mutation
it was shown to catch, and [`MUTATIONS.md`](MUTATIONS.md) holds the ledger with
what each mutation changed and what it found.

## Two things worth knowing before writing a test here

**Absence is harder to test than presence.** A field that is not in the response may still be inferable from what is. `opacity/` in particular has to probe for inference — response timing, array lengths, the presence or absence of an optional object — not merely for a named field. Tests that check only for field names give false assurance.

**A test that cannot fail is not a test.** Each test here carries a note recording how it was shown to fail: what was changed in a reference implementation to break it, and that the test caught it. A test added without that note is not counted.

## Running

The probes talk to an implementation over HTTP and import nothing from it, so
the implementation may be written in any language. Everything they need arrives
as twenty environment variables:

| Variable | What it is |
|---|---|
| `VALENCE_BASE_URL` | where the implementation is listening |
| `VALENCE_CONFIG_VERSION` | a presenter catalogue version that already exists |
| `VALENCE_PRODUCTS` | at least three product references in that catalogue, comma separated |
| `VALENCE_HOUSEHOLD` | a household the offers are placed with |
| `VALENCE_MANDATE` | a mandate reference the implementation will accept |
| `VALENCE_MANDATE_KEY` | the private half of the key registered for that mandate, base64 of a PKCS#8 PEM, so the probes can sign a decided set (§10.5) |
| `VALENCE_MANDATE_STATE` | base64 of the seeded mandate as JSON, with `co_signer_key`, so the probes can sign a change and see which signatures a loosening needs (§16) |
| `VALENCE_EXPLORATION_RATE` | the rate this deployment runs at |
| `VALENCE_LINEAGE_EDGE` | a well-formed, signed lineage edge as JSON, which this implementation will accept |
| `VALENCE_UNATTESTED_EDGE` | a well-formed, signed edge whose giver's key no identity root endorsed (§7.1) |
| `VALENCE_PRICES` | the merchant's own price for each of those products, as JSON |
| `VALENCE_CONFIG_VERSION_LATER` | a catalogue version registered after the first, with at least one product repriced |
| `VALENCE_CONFIG_VERSION_NARROW` | a catalogue version under the same presenter naming only a subset of the products (§5: the floor counts what the presenter still has across every catalogue) |
| `VALENCE_CONFIG_VERSION_UNROOTED` | a catalogue version of a presenter whose key no identity root endorsed (§5.2) |
| `VALENCE_PRODUCTS_UNROOTED` | products in that catalogue, comma separated |
| `VALENCE_PRICES_LATER` | the prices in that later catalogue, as JSON |
| `VALENCE_BINDINGS` | which bindings this deployment implements, comma separated |
| `VALENCE_RECOVERY_GRACE_DAYS` | days after the recovery deadline before an uncollected candidate is lost |
| `VALENCE_RP_ID` | the name a member's device signs for, which the deployment declares for itself (§10.5, §14b). The probes build assertions for it, and an implementation that compared some other name would accept what no member's device made |
| `VALENCE_SECOND_HOST_URL` | a second host of the same implementation, for the move in `exit/` |

Seeding a catalogue and attesting a key are deployment plumbing the
specification does not describe, so the suite refuses to guess at routes for
them and asks for the results instead. None of the thirteen is optional: a probe
that skips when its fixture is missing is a probe an implementation passes by
omission.

```
VALENCE_BASE_URL=http://localhost:8788 \
VALENCE_CONFIG_VERSION=... VALENCE_PRODUCTS=... VALENCE_HOUSEHOLD=... \
VALENCE_MANDATE=... VALENCE_EXPLORATION_RATE=0.2 \
VALENCE_LINEAGE_EDGE='{"from":"...","to":"...","product":"...","merchant":"...","kind":"gift","occasion":"...","receipt":"...","signature":"..."}' \
VALENCE_PRICES='{"tea-a":1200,"tea-b":900}' \
  bun test absence floor silence lineage approval permissions registry
```

`VALENCE_EXPLORATION_RATE` is there because §5 publishes no recommended rate. Without it
the suite could only check that an offer below the floor is refused, and an
implementation demanding far more exploration than its deployment declared
would pass. That is not hypothetical: it survived the first version of these
suites, and `MUTATIONS.md` records how it was found.

## What passing does and does not mean

Read [`MUTATIONS.md`](MUTATIONS.md) before quoting a pass. It counts the eight
conformance conditions in the specification's §13 against the probes that exist:
all eight are gated. What no probe reaches is named in the ledger and in each
suite's README rather than left to be discovered, because §13 sends the reader
to these tests as the thing that entitles an implementation to the mark, and a
gate that overstates itself is worse than one that does not exist.

## Status

September 2026. All thirteen suites are written and pass against the reference
engine. **Last measured in full on 2026-09-11, midday: 231 probes at runtime
from 218 declarations, against 198 deliberate breaks** listed in the ledger, and
**225 have been shown to fail** under at least one break that does not stop
every offer. **No break survives and none is inert**, and one aborts before a
probe runs, which is the one that always has.

**Five probes had not been shown to fail in that run**, and they are the
standing five: two are proven only by breaks excluded for stopping every offer,
two are properties of this deployment rather than weak probes, and one is a
boundary case reached by another break first. The sixth of the previous run was
the probe written beside the passkey's assertion with no break beside it; it has
one now, and this run shows it failing.

**Twenty-two breaks were added after that run and are not in its figures.** They are second ones for the probes the sweep found resting on a single break, in the three suites where a person's own protections are: `mandates`, `exit` and `permissions`. Each was run alone against the whole corpus and watched failing the probe it was written for, which is evidence about each break and not a sweep, so no ratio is quoted for them. The corpus stands at 220.

**Two of them found a probe rather than an engine.** One registered the ledger's listing under the grantee instead of the household and nothing went red, because the probe asked for a single path; one put a price on the answer a person is shown when they grant, and the probe walked the stored ledger only. Both probes were widened and both breaks kept. **A break that survives because a probe asked too narrow a question is a finding about the probe**, and this is the second kind of hole these suites have: not a probe that cannot fail, but a probe that can only fail one way.

**How much each proof rests on is a separate question from whether it exists.**
Of the 227 probes with a catch, counting the excluded breaks too, **70 rest on a
single break**: the corpus proves them, and one drifted anchor would stop
proving them without anything turning red. `scripts/fragility.py` in the
reference engine's repository names them, and it is worth running beside any
figure quoted from here.

Two of the breaks stop any offer being created, so probes
that fail only in their setup are not counted as shown-to-fail; `coverage.sh`
excludes those two by name, reports any mutation that changed nothing, reports
any that never reached a probe, and measures which probe each break caught
rather than taking the notes on trust.

`opacity/` and `exit/` were the last two written, and later than the rest for a
reason that was not schedule. Both test a hub rather than an offer engine:
`exit/` needs a node that can be exported and moved between hosts, and
`opacity/` has to probe for inference on a giver's response surface, which
means having a surface. Both waited until the hub surfaces were specified, so
that neither would fix the wrong interface.
