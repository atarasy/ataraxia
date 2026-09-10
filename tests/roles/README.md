# roles

**Specification §13.1, and clause 1 for the registry.**

An implementation may present the engine's surface, the hub's surface, or both,
and is judged on the surface it presents.

## Why this suite needs servers of its own

Every other suite here reaches one implementation that runs both roles, and
against that one nothing in this file could be seen. The harness starts two
more servers beside it, each declaring a single role, and these probes ask what
each answers for. **A boundary a probe cannot reach is one the specification
cannot hold anyone to**, which is the whole argument for naming the roles.

## The action that makes the line interesting, and the one that did not

`GET` and `POST /offers/{id}/delivery` are the household's surface by §7.5b: a
carrier's code resolves to an address, so a merchant must not read one. **Its
path is the offer's and its role is the hub's**, and a hub holds deliveries
without holding offers.

**`decisions` was the hub's too, for a day, and the reason was wrong.** It was
assigned there because a decided set is the person's. It is, and clause 35
makes it so **by the signature**, which whoever answers the route cannot forge.
What answering the route needs is the offer, and a hub does not have one: a hub
alone answered `decisions` and could only reply that it had never heard of the
offer. **Authority travels in the signature, not in the route.** The correction
came from running the two roles apart, not from reading the design.

## What these probes could not ask, until they could

The probes above ask **who answers**. That is what §13.1 was written to make
checkable, and for a day it was all this suite could do, which is how three
defects lived here with every suite green: an engine summing its own
settlements as though they were a household's union, a hub exporting an empty
node, and deciding assigned to the party without the offer.

Two probes now ask the other question. They **settle on one party and read the
other**, so nothing but a working interface between them can make them pass:
a settlement reaching the person's own copy on the hub, and a hub alone
exporting a node with the offer in it. The second decides everything
`returned`, because a probe that checked a purchase would miss the half clause
8 puts in the person's node.

## What a failure means

**An engine that answers for the household's surface**: the split is a
directory layout rather than a boundary. Nothing stops the presenter's side
holding the person's ledger, which is what clause 52 is about when it says the
host is blind.

**A hub that does not answer for deciding**: the person cannot sign on their own
side, and the signature that clause 35 requires would be taken by the party the
offer came from.

**A single-role deployment that refuses the registry**: resolution has become a
favour a full deployment does. Clause 1 makes the registry nobody's subject, and
a deployment may put it behind either role.

## What it does not reach

Whether the two roles, run apart, actually work together: these probes ask what
each answers for, not what happens when an engine asks a hub for a mandate. That
needs the two deployed separately with the interface between them exercised,
which is a suite against two implementations rather than one.

**A 404 alone is not the signal.** An empty server answers 404 for a household
it has never heard of, and a server that does not present the hub answers 404
for the same path. The refusal by role carries `not_this_role`, and these probes
read the name rather than the number.
