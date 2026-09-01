# Packet P4 — Cost-Capped Experiment Loop

**Status:** PROPOSED · **Owner:** Devarsh (Lane A), with Tirth (Lane B)
**Linear:** SPX-4 · **Integration destination:** `main` · **Depends on:** integrated P3

## Operator-visible outcome

An accepted hypothesis becomes one participant-approved, affordable, reversible, falsifiable
experiment with a visible schedule. Outreach remains a draft the participant sends manually.

## Scope and owned paths

- experiment, plan-item, and outreach-draft schemas and commands;
- proposal/approval UI and week placement;
- `propose_experiment`, `schedule_action`, and `draft_outreach` fixtures for future WebMCP.

## Contract and invariants

- the experiment extends one accepted hypothesis;
- time/money remain within participant caps and `doneWhen` is stranger-checkable;
- the initial experiment fits within seven days and remains reversible;
- no send command, background job, mail credential, or hidden external effect exists;
- all proposals remain participant-approved and receipted.

## Required proof

- success: propose/edit/accept/reject experiment, schedule action, create draft;
- denial: wrong phase/lifecycle, over cap, unknown ref, stale, replay conflict, malformed input;
- browser: accepted hypothesis -> experiment ghost -> accepted experiment/week item;
- repository search proves no automated send path; `npm run check` passes.

## Rollback or recovery

Revert as one packet. Compensate accepted local entities; never erase receipts.

## Remaining unknowns

Actual real-world usefulness requires gated participant research. WebMCP wrapping waits for P8B.

## Closeout receipt

- branch/SHA:
- dirty state:
- verified:
- unverified:
- disposition:
