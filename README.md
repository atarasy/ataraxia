# Ataraxia

**A constitution for commerce infrastructure that returns the intent layer to the person.**

→ Read it: **[ATARAXIA.md](ATARAXIA.md)**

----

## What this repository is

Agentic commerce protocols separated, for the first time and at the level of a specification, the party that forms intent from the party that fulfils orders. Model vendors assume the intent layer is theirs. No specification says so.

This repository holds the constitution for software that assumes otherwise: that the seat belongs to the person, held by their own hub and their own agent, running on the same fulfilment rails everyone else uses.

The constitution is a **list of things that cannot be done**. Not a list of promises. Where a clause says a capability does not exist, the conforming implementation has no API for it, no table for it, and no setting that restores it.

## The order of things

This constitution is not the constitution *of* a product. **Products conform to it.**

| Name | What it names | Where |
|---|---|---|
| **Ataraxia** | This constitution, the conformance mark, the foundation that will hold them | here |
| **Atarasy** | The reference hub — what a member opens | `atarasy/atarasy` |
| **Valence** | The specification and engine — offer, valence, recovery, settlement | `atarasy/valence` |

A merchant exposes Valence-conformant endpoints and carries the Ataraxia mark. A member opens Atarasy. Anyone may build a different hub and claim Ataraxia conformance; what they may not do is use the Atarasy name, or claim conformance without passing the tests.

We hold a reference implementation *and* certify others. That is a real tension, and it is answered in the open: the foundation gives its own implementation no preferential certification, the conformance tests are public and anyone can run them, and a fork can claim conformance. The same arrangement holds for Rust, Python and Signal.

One further asymmetry is worth naming rather than hiding. This repository currently sits under the `atarasy` organisation, which is the name of the reference hub. The URL therefore reads as though the constitution belonged to a product, which is the opposite of the order described above. This is provisional: the constitution and its conformance tests move to a neutral organisation when the foundation is established, and GitHub will redirect. Until then, read the order from this document, not from the path.

## Conformance

Conformance tests live in [`tests/`](tests/) and are runnable by anyone, against anyone's implementation, including ours. A build or host that passes them may use the mark. A build that fails loses it.

All eleven suites are written, and `tests/README.md` says what each covers. There were five when this directory was scoped; the ones added since came from reading the clause list inward rather than outward from the probes, which is the direction that finds what nothing checks. What they check is a specific subset of the constitution: **capabilities that must be absent, and behaviours that must be refused.** Most of the constitution is not mechanically checkable, and the tests do not pretend otherwise.

The mark attaches to software and hosts. **It never attaches to people.** Merchant endpoints and gift lineage do not discriminate on which hub produced a request — see clause 64, and the section on what this constitution does not protect.

## Contributing

The prohibitions are settled by the founder and are not open for negotiation in pull requests. What is open:

- Errors of fact, ambiguity, and clauses that cannot be tested as written
- Conformance tests for clauses that currently have none
- Translation

Amendment procedure is in the constitution itself.

## Status

Draft, September 2026. The foundation does not exist yet; trademarks are held personally and licensed to conforming implementations. Read the Status section of the constitution before treating any of this as settled.

## Licence

[MIT](LICENSE) for the text. The licence does not grant rights to the Ataraxia, Atarasy or Valence names — see [TRADEMARKS.md](TRADEMARKS.md).
