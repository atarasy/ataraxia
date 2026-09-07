# Conformance tests

An implementation that passes these may use the Ataraxia mark. One that stops passing loses it. That is the only sanction, and it is deliberately the only one.

Anyone can run them, against anyone's implementation, including ours. There is no private suite and no certification body to apply to.

## What is testable, and what is not

Most of the constitution is not mechanically checkable. Whether a foundation sells governance seats, whether a brand bought a slot, whether the founder kept a promise — none of that is decided by a test run.

What *is* checkable is a specific and useful subset: **capabilities that must be absent, and behaviours that must be refused.** A clause that says a field does not exist can be checked by looking for the field. A clause that says an order is never created by silence can be checked by staying silent.

So these tests are not a certificate of good conduct. They check the parts of the constitution that were deliberately written to be structural rather than promissory, which is the reason the constitution was written that way.

## Suites

Three of the five are written. `opacity/` and `exit/` are not, for the reason
given under Status.

| Suite | Clauses | What it checks | Written |
|---|---|---|---|
| [`absence/`](absence/) | 31, 32, 33, 34, and §9.1 of the spec | Capabilities that must not exist: discount objects, ratings, urgency fields, per-person event stores, tracking sockets, broadcast and segment routes | yes |
| [`floor/`](floor/) | 30 | An offer below the exploration floor is refused with `422`, no configuration bypasses the check, and the rate cannot reach zero | yes |
| [`silence/`](silence/) | 36, 37, and spec §2.2 | An undecided digital offer creates no order at expiry; no configuration makes silence into consent; at most one reminder is sent | yes |
| [`opacity/`](opacity/) | 19, 21, 22 | No response surface discloses or permits inference of recipient inaction; reciprocation is never prompted; a recipient's record holds nothing but the fact of receipt | no |
| [`exit/`](exit/) | 47, 61, 62 | Full export in a documented format; a node moves host intact; recovery and routine reading are separate powers and recovery is logged | no |

Every probe in the three written suites carries a note recording the mutation
it was shown to catch, and [`MUTATIONS.md`](MUTATIONS.md) holds the ledger with
what each mutation changed and what it found.

## Two things worth knowing before writing a test here

**Absence is harder to test than presence.** A field that is not in the response may still be inferable from what is. `opacity/` in particular has to probe for inference — response timing, array lengths, the presence or absence of an optional object — not merely for a named field. Tests that check only for field names give false assurance.

**A test that cannot fail is not a test.** Each test here carries a note recording how it was shown to fail: what was changed in a reference implementation to break it, and that the test caught it. A test added without that note is not counted.

## Running

The probes talk to an implementation over HTTP and import nothing from it, so
the implementation may be written in any language. Everything they need arrives
as six environment variables:

| Variable | What it is |
|---|---|
| `VALENCE_BASE_URL` | where the implementation is listening |
| `VALENCE_CONFIG_VERSION` | a presenter catalogue version that already exists |
| `VALENCE_PRODUCTS` | at least three product references in that catalogue, comma separated |
| `VALENCE_HOUSEHOLD` | a household the offers are placed with |
| `VALENCE_MANDATE` | a mandate reference the implementation will accept |
| `VALENCE_EXPLORATION_RATE` | the rate this deployment runs at |

Seeding a catalogue is deployment plumbing that the specification does not
describe, so the suite refuses to guess at a route for it and asks for the
result instead.

```
bun install
VALENCE_BASE_URL=http://localhost:8788 \
VALENCE_CONFIG_VERSION=... VALENCE_PRODUCTS=... VALENCE_HOUSEHOLD=... \
VALENCE_MANDATE=... VALENCE_EXPLORATION_RATE=0.2 \
  bun test absence floor silence
```

The last variable is there because §5 publishes no recommended rate. Without it
the suite could only check that an offer below the floor is refused, and an
implementation demanding far more exploration than its deployment declared
would pass. That is not hypothetical: it survived the first version of these
suites, and `MUTATIONS.md` records how it was found.

## Status

September 2026. `absence/`, `floor/` and `silence/` are written and pass
against the reference engine; each probe has been shown to fail under a
deliberate break of that engine.

`opacity/` and `exit/` are still scoped rather than written, and the reason is
not schedule. Both test a hub rather than an offer engine: `exit/` needs a node
that can be exported and moved between hosts, and `opacity/` has to probe for
inference on a giver's response surface, which means having a surface. Writing
either against the offer engine alone would fix the wrong interface, which is
the objection this directory started with.
