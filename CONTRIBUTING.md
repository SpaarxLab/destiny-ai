# Contributing to Destiny.AI

## Ownership

| Responsibility | Owner | Decision authority |
|---|---|---|
| Product authority and integration | Harsh | scope, contract admission, candidate identity |
| Lane A — domain/commands/persistence | Devarsh (`Devarsh009`) | invariants, command kernel, migrations, receipts |
| Lane B — human board/collaboration | Tirth (`Tirth262830`) | interaction design, accessibility, browser journeys |
| Lane C — agent surface/evals/runtime | Harsh | WebMCP adapters, method, evals, live runtime proof |
| Lane D — inference (optional) | Harsh | embedded lab assistant, agent simulator, provider-off evals; never state authority |
| Safeguarding review | **OWNER INPUT** | distress and referral copy |
| Participant recruitment | Harsh | five adult participant commitments |

Harsh is integration captain for the first four-week programme; the role changes only by an
explicit decision-record update.

## Setup

```bash
cd web
npm ci
npm run check
```

Use Node 24 from `.nvmrc` or `.node-version`.

## Before coding

Read `PROJECT_STATE.md`, `SPEC.md`, `docs/DECISIONS.md`, `docs/PLAN.md`, `AGENTS.md`, then
the active packet in `docs/packets/`. Confirm the packet owner and owned paths. New to the
codebase? Start with `docs/HOW_IT_WORKS.md`.

## Working agreement

- One owner, one active packet, one writable worktree per lane.
- Lane A publishes contracts before Lane B/C integrate them.
- Lane B/C consume commands; they do not reproduce policy.
- A contract change needs product-authority approval and updated fixtures.
- Daily 15-minute check: contract change, evidence, blocker, next integration only.
- After A0 lands, P3A and P8A are the first independent outcomes: Devarsh owns the route-set and
  human-choice command contract while Harsh owns the read-only WebMCP adapter. P3B starts only from
  the frozen P3A contract. The lanes must not edit each other's paths or treat an unintegrated
  contract as stable.

## Ticket reading order

Every Linear ticket should be understandable without reconstructing chat history. Read it in
this order: outcome, why it is unblocked, owner and paths, contract, numbered acceptance
criteria, proof commands, rollback, out of scope, and related packet. If any of these is
missing, clarify the ticket before starting code.

Linear mirrors execution. `SPEC.md`, `docs/DECISIONS.md`, `docs/PLAN.md`, and the packet remain
authority when a ticket summary drifts.

## Branches and pull requests

Include the Linear identifier in the branch name, for example `packet/spx-3-hypothesis`.
One lane owns the branch; do not mix packets or repair unrelated files.

A pull request:

- describes the operator-visible outcome;
- links the packet and changed contract;
- lists exact commands and results;
- includes denial/replay/recovery evidence where applicable;
- states candidate limits and remaining gates;
- never calls local checks live WebMCP or participant proof.

## Integration and definition of done

Integration order: `domain schema -> command/denial tests -> adapter and UI -> browser
journey -> real-Chrome WebMCP suite -> docs/receipt`. Harsh integrates dependency-order only; failed or incomplete
packets are parked with a receipt, never partially copied into `main`.

A packet is done when it has: a named operator outcome and owner; satisfied prerequisites;
focused success, denial, stale, and replay checks where applicable; a visible after-state and
durable receipt; documented recovery or compensation; a branch/SHA/dirty-state receipt; and
an explicit `INTEGRATE`, `DEFER`, or `REJECT` disposition.

P8C is the only packet that may close the competition epic. It closes only the truthful
route-proposal and human-choice submission slice, not P4-P7 or the full product promise. P10 completes
the post-submission WebMCP catalogue. P9 optional inference is never a candidate blocker and
must prove benefit against the no-provider baseline before adoption.
