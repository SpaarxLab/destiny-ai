# Packet P2 — Cold Orientation

**Status:** INTEGRATED — PR #2 merged to `main`
**Owner:** Devarsh (Lane A), with Harsh (Lane C) required for integration/runtime review
**Branch/worktree:** `codex/spx-2-cold-orientation` in the current canonical checkout
**Integration destination:** `main` (merged as `f7dea24438d8bc534d4fb636fe957003d41be0b4`)
**Depends on:** P1 commit `94898ce0c2d0042af837dca9a00d2ed34694023d` and https://github.com/SpaarxLab/destiny-ai/pull/1
**Pull request:** https://github.com/SpaarxLab/destiny-ai/pull/2 (stacked review base:
`codex/p1-command-spine`)

## Operator-visible outcome

A cold agent can understand the current workspace, human boundary, proof level, and allowed
next action in one deterministic bounded read. The same projection is legible in the local UI.

## Prerequisite audit

- P0A is integrated and P0B admits product implementation;
- P1 implementation, denial, replay, receipt, persistence, and browser proof passed;
- P1 PR #1 merged to `main` before P2 was retargeted;
- the P2 head contains the complete accepted P1 head and remained dependency-closed;
- Harsh and independent correctness/test reviewers accepted the exact P2 candidate.

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
  `requestIdentity`; each summary exposes at most five changed refs and reports truncation;
- working-set and targeted entity reads contain at most 20 entities;
- truncated change pages advance their cursor only through the last returned operation;
- the complete orientation tool result is capped at 6,000 serialized characters and 3,000
  UTF-8 bytes, using byte count as a conservative upper bound on token pieces;
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

- branch/code-review SHA: `codex/spx-2-cold-orientation` /
  `61e5bc686425c5334b36ec4e1819006eb8d516ad`
- verified: Node 24 `npm run check`; focused P1/P2 tests; three golden orientation
  fixtures; strict input/output schemas; cursor isolation; public delta; malformed and invalid
  cursor denial; bounded working-set/entity reads; no ledger/request identity; no mutation or
  receipt; recoverable change pagination; 6,000-character/3,000-byte result cap
- browser proof: production journey rendered the P2 handoff, applied one participant
  reflection, and advanced both authoritative state and orientation cursor from `v1` to `v2`;
  proof remained `PARTICIPANT_CONFIRMED` and browser warning/error logs were empty
- unverified: live WebMCP, deployed runtime, participants, release
  candidate, and cold-agent model eval; Linear SPX-2 is `In Review` with PR #2 attached
- review state: P1 `94898ce0c2d0042af837dca9a00d2ed34694023d` is preserved as an
  ancestor; correctness and test reviewers accepted the reconciled candidate after bounded,
  recoverable pagination fixes
- disposition: `INTEGRATED` — exact-head CI passed in run `33506297045`; P2 head is reachable
  from `main`; P3 is admitted next
