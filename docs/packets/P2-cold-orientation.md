# Packet P2 — Cold Orientation

**Status:** ACTIVE — implementation complete; integration blocked on P1
**Owner:** Devarsh (Lane A), with Harsh (Lane C) required for integration/runtime review
**Branch/worktree:** `codex/spx-2-cold-orientation` in the current canonical checkout
**Integration destination:** `main`, only after P1 PR #1 merges
**Depends on:** P1 commit `44acf7d` and https://github.com/SpaarxLab/destiny-ai/pull/1

## Operator-visible outcome

A cold agent can understand the current workspace, human boundary, proof level, and allowed
next action in one deterministic bounded read. The same projection is legible in the local UI.

## Prerequisite audit

- P0A is integrated and P0B admits product implementation;
- P1 implementation, denial, replay, receipt, persistence, and browser proof passed;
- P1 PR #1 is open against `main`, but is not yet integrated;
- this branch contains the complete P1 head, so implementation is dependency-closed;
- P2 integration remains blocked until P1 merges and Harsh reviews Lane C/runtime concerns.

## Scope and owned paths

- `web/src/domain/reads.ts` — strict read input and bounded projection contracts;
- `web/src/domain/affordances.ts` — shared deterministic action projection;
- `web/src/projections/` — `read_workspace` projection and golden fixtures;
- `web/src/adapters/` — deterministic read harness only;
- `web/src/components/command-spine-demo.tsx` — compact human-legible orientation proof;
- focused tests plus this packet and `PROJECT_STATE.md` receipts.

Live WebMCP registration, model-written summaries, hypothesis/experiment lifecycle, server
persistence, auth, sync, analytics, and participant research are out of scope.

## Contract and bounds

- `{}` and `{ view: "orientation" }` return current truth without reading full history;
- `sinceCursor` is caller-owned and workspace/version bound; no global last-read state exists;
- orientation changes contain at most 20 public operation summaries and never expose
  `requestIdentity`;
- working-set and targeted entity reads contain at most 20 entities;
- orientation JSON is capped at 6,000 serialized characters, budgeted as at most 1,500
  estimated tokens at four characters per token;
- reads never mutate the workspace and never return a write receipt;
- available actions come from the same deterministic affordance projection used by commands;
- unknown entity refs are returned explicitly and malformed/invalid cursor reads are typed.

## Required proof

- golden cold, confirmed, and proposed orientation fixtures;
- cursor delta, invalid cursor, malformed/extra field, bound, targeted entity, no-ledger,
  no-mutation, and token-budget tests;
- Node 24 `npm run check`;
- browser journey showing the same orientation before and after one saved reflection.

## Rollback or compensation

Before integration, discard this packet branch. After integration, revert the packet commit as
one unit. P2 is read-only and creates no state requiring compensation.

## Remaining unknowns

- live WebMCP registration and runtime annotations remain Lane C/P8 work;
- later packets will replace empty hypothesis, experiment, teaching, and conflict projections
  with lifecycle-backed entities without changing this entry point;
- participant research remains reviewer- and recruitment-gated.

## Closeout receipt

- branch/implementation SHA: `codex/spx-2-cold-orientation` /
  `eff533e234e48c8774216ff9aaba9ecd4b0af778`
- verified: Node 24 `npm run check`; 16 focused P1/P2 tests; three golden orientation
  fixtures; strict input/output schemas; cursor isolation; public delta; malformed and invalid
  cursor denial; bounded working-set/entity reads; no ledger/request identity; no mutation or
  receipt; 6,000-character/1,500-estimated-token cap
- browser proof: production journey rendered the P2 handoff, applied one participant
  reflection, and advanced both authoritative state and orientation cursor from `v1` to `v2`;
  proof remained `PARTICIPANT_CONFIRMED` and browser warning/error logs were empty
- unverified: live WebMCP, deployed runtime, participants, `main` integration, release
  candidate, and cold-agent model eval; Linear SPX-2 is `In Progress` with this receipt
- disposition: `ACTIVE` — implementation is ready for review, but may not integrate before
  P1 PR #1 merges and Harsh completes Lane C/runtime review
