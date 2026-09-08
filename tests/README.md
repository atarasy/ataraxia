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
| [`absence/`](absence/) | 31, 32, 33, 34, and §9.1 of the spec | Capabilities that must not exist: discount objects, ratings, urgency fields, per-person event stores, tracking sockets, broadcast and segment routes | yes |
| [`floor/`](floor/) | 30 | An offer below the exploration floor is refused with `422`, no configuration bypasses the check, and the rate cannot reach zero | yes |
| [`silence/`](silence/) | 36, 37, and spec §2.2 | An undecided digital offer creates no order at expiry; no configuration makes silence into consent; at most one reminder is sent | yes |
| [`opacity/`](opacity/) | 19, 21, 22, 24 | No response surface discloses or permits inference of recipient inaction; reciprocation is never prompted; a recipient's record holds nothing but the fact of receipt | yes |
| [`binding/`](binding/) | spec §3.2, §6.2, §11 | A household is never billed for goods that were lost, and consumed settles at cost | yes |
| [`lineage/`](lineage/) | 22, 25, and spec §7.1, §7.6 | An edge is accepted on its signature and never on the client that sent it; a recipient's record holds the fact of receipt and nothing else | yes |
| [`machine/`](machine/) | spec §2.1 | Withdraw, partial deciding, and that `settled` is terminal | yes |
| [`approval/`](approval/) | 40, 63, 67, 68 | The screen carries the alternatives, the argument against and the reason for an exclusion, and carries no presentation | yes |
| [`permissions/`](permissions/) | 41 to 46 | Asked at the moment of use, time-limited, always visible, revoked one at a time, and never priced | yes |
| [`registry/`](registry/) | 1, 64, and spec §17 | The endpoint registry resolves and does not rank: key order, no score, no query by intent, the same answer to every caller, and the mark never a gate | yes |
| [`exit/`](exit/) | 47, 61, 62 | Full export in a documented format; a node moves host intact; recovery and routine reading are separate powers and recovery is logged | yes |

Every probe in the three written suites carries a note recording the mutation
it was shown to catch, and [`MUTATIONS.md`](MUTATIONS.md) holds the ledger with
what each mutation changed and what it found.

## Two things worth knowing before writing a test here

**Absence is harder to test than presence.** A field that is not in the response may still be inferable from what is. `opacity/` in particular has to probe for inference — response timing, array lengths, the presence or absence of an optional object — not merely for a named field. Tests that check only for field names give false assurance.

**A test that cannot fail is not a test.** Each test here carries a note recording how it was shown to fail: what was changed in a reference implementation to break it, and that the test caught it. A test added without that note is not counted.

## Running

The probes talk to an implementation over HTTP and import nothing from it, so
the implementation may be written in any language. Everything they need arrives
as thirteen environment variables:

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

September 2026. All eleven suites are written and pass against the reference
engine: 192 probes at runtime from 178 declarations, against 156 deliberate
breaks listed in the ledger, and all but five have been shown to fail under
at least one break. The five that have not say so in their own notes and the
ledger says why. Two of the breaks stop any offer being created, so probes
that fail only in their setup are not counted as shown-to-fail; `coverage.sh`
excludes those two by name, reports any mutation that changed nothing, and
measures which probe each break caught rather than taking the notes on trust.

`opacity/` and `exit/` were the last two written, and later than the rest for a
reason that was not schedule. Both test a hub rather than an offer engine:
`exit/` needs a node that can be exported and moved between hosts, and
`opacity/` has to probe for inference on a giver's response surface, which
means having a surface. Both waited until the hub surfaces were specified, so
that neither would fix the wrong interface.
