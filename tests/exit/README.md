# exit

**Clauses 47, 61 and 62.** Not written.

Full export in a documented format; a node moves host intact; recovery and
routine reading are separate powers, and recovery is logged.

## Why it is not written

Every clause here is about a node and its host. The reference work so far is an
offer engine, which has neither. There is nothing yet to export and nowhere to
move it to.

## What it will need

Two hosts, and a node moved between them with its lineage, its notes and its
settled offers intact. The probe that matters is not that an export file is
produced but that the second host serves the same answers as the first.

Recovery is the harder half: a recoverer who can restore access must be shown
*not* to be able to read in the ordinary course, and every recovery must appear
in a log the household can read. A single power that does both is the failure
this suite exists to catch.
