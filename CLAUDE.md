# CLAUDE.md

Guidance for Claude Code working in this repository.

## What this repository is

The **constitution** for commerce infrastructure that returns the intent layer to the person, its trademark policy, and the scaffold for the conformance tests that enforce it. `atarasy/ataraxia`, public, MIT. Nothing to build, lint or deploy. Everything here is prose, and the prose is load-bearing.

**All documents in this repository are in English.** The working strategy documents are in Japanese and live in a private Obsidian vault at `~/Documents/GitHub/hacci/Projects/Atarasy/` — read its `CLAUDE.md` before making a change that follows from a decision, rather than a correction.

Sibling: `~/Documents/GitHub/valence` (`atarasy/valence`) holds the specification. A clause that is enforced structurally is enforced *there*, in an API shape, not here.

## The three names, and why collapsing them breaks the argument

- **Ataraxia** — this constitution, the conformance mark, the future foundation. The object of "conforms to". **Not a product.**
- **Atarasy** — the reference hub. What a member opens. A fork may claim Ataraxia conformance; it may not use this name.
- **Valence** — the specification and engine. A candidate's outcome is its valence.

A merchant exposes Valence-conformant endpoints and carries the Ataraxia mark. A member opens Atarasy. Three names, three different sentences. That separation is the whole answer to how a foundation can hold a reference implementation and still certify others — collapse any two and the answer stops working.

## Rules the text depends on

**"Cannot" is not "will not".** Clause 29 says no capability exists to store per-person events. Clause 30 says no API exists for countdown timers. These are claims about structure, not promises about conduct. If an edit softens one into a policy statement, the clause has been destroyed even though it still reads well. The method is borrowed from Omarchy: removing a setting removes the temptation with it.

**Three admissions are deliberate. Do not tidy them away.**

1. *We hold a reference implementation and certify others* (README, Conformance). Answered in the open, not hidden.
2. *This repository sits under the organisation named after the product, so the URL reads backwards* (README, ATARAXIA Status, TRADEMARKS). Provisional until the foundation exists.
3. *Trademarks are held personally, and a layer acting for people should not depend on one person's reputation* (ATARAXIA Status).

Each was written after considering whether to omit it. An editor who removes them to make the document cleaner has made it weaker.

**The trademarks are unregistered and no application has been filed.** An earlier draft said "registration is in progress" — that was false and was corrected in `f2665d9`. Never restate it. Filing is deliberately deferred until the指定 goods and services can be written properly, which needs decisions that have not been made.

**The mark never attaches to people** (clause 55). It attaches to software and hosts. Merchant endpoints and gift lineage do not discriminate on it. Excluding a fork happens only inside one person's own mandate, decided by whoever is protecting them. Any proposal that turns the mark into a gate contradicts both clause 55 and the section on what the constitution does not protect.

**Amendment is by sortition jury plus the foundation's consent** (clause 57), not by any flow that can be mobilised. Neither the founder nor a pull request amends it. Corrections of fact, ambiguity and untestable wording are welcome; the prohibitions are not open for negotiation, and `README.md#contributing` says so.

## `tests/`

Eleven suites, all written, and `tests/README.md` says what each covers. They run against any implementation over HTTP and import nothing from one; the reference is `atarasy/valence`. Measured on 2026-09-09, after the harness was corrected so that it can report a mutation no probe catches: **161 mutations, 179 declarations, 192 probes at runtime, 187 shown to fail, 5 unproven, 0 survivors.** Count the numerator and the denominator over the same population: `coverage.sh` unions failure lines from the conformance logs and from the engine's own unit tests, and 21 of the 208 lines in the union are the latter. The five unproven are properties of this deployment rather than weak probes, and each says so in its own note.

Three rules apply to anything added there:

- **A test that cannot fail is not a test.** Each test carries a note recording what was broken in a reference implementation and that the test caught it. A test added without that note is not counted, and `MUTATIONS.md` is the ledger of the breaks.
- **A note is a claim about the past; only a run says whether it is still true.** Seven times on 2026-09-09 a probe that could no longer fail was found by `coverage.sh` rather than by reading: an anchor that had drifted, a fixture that made a difference invisible, a deployment with only one of the thing being compared. Re-measure after any change to the engine's fields or fixtures.
- **Absence is harder to test than presence.** A field missing from a response may still be inferable from timing, array length, or an optional object's presence. The `opacity/` suite in particular must probe for inference, not field names.

Tests check a specific subset: capabilities that must be absent and behaviours that must be refused. Most of the constitution is not mechanically checkable, and the README refuses to imply otherwise.

## Style

- British spelling, plain sentences, no em-dash-heavy asides.
- Clause numbers are stable. Renumbering breaks every reference in `valence/SPEC.md` and in the vault; add a clause at the end of its section instead.
- Tables for anything with more than two dimensions; prose otherwise.
- No emoji, no badges, no marketing register. This is a legal-adjacent document that people are asked to trust.

## Git

Ordinary git. Public repository, so assume anything committed is permanent. `hello@atarasy.com` is the published contact and forwards to a real inbox; the catch-all is disabled, so any *other* address written into a document will be silently dropped. Add a routing rule before publishing a new address.
