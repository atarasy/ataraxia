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

## The two actions that make the line interesting

`POST` and `DELETE /offers/{id}/decisions` carry the person's signature and the
person's withdrawal. `GET` and `POST /offers/{id}/delivery` are the household's
surface by §7.5b. **Their path is the offer's and their role is the hub's**, so
an engine alone does not answer for them and a hub alone does. A split that
followed the path rather than the authority would hand a presenter the person's
own signature and the person's own delivery surface.

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
