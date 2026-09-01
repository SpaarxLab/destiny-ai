# Packet P3 — Route Set and Human Choice

**Status:** ACTIVE CONTRACT CLOSURE
**Owners:** Devarsh owns P3A domain; Tirth owns P3B journey
**Linear:** SPX-3 must be split/mirrored into P3A and P3B
**Integration destination:** `main` · **Depends on:** integrated P2 and landed A0 authority

## Operator-visible outcome

ChatGPT or the participant can propose three grounded route previews. The participant edits or
rejects them, then chooses exactly one. That single choice creates the accepted hypothesis and an
authoritative receipt. No second approval is required.

## P3A — Domain contract

**Owner:** Devarsh

### Owned paths

- `web/src/domain/`
- `web/src/commands/`
- `web/src/storage/`
- P3 schema fixtures and focused domain tests

### Contract

- `RouteProposalSet` contains a stable ref, status, author, version lineage, and exactly three
  `RoutePreview` values: Closest, Bridge, and Probe.
- Each route contains title, premise, exact confirmed quote refs, respected constraint, learning
  question, bounded test idea, and strengthen/weaken observations.
- `propose_route_set` is a replay-safe `PROPOSE` command with `operationId` and `expectedVersion`.
- UI, WebMCP, and optional inference use the same command.
- If three grounded routes cannot be produced, return `INSUFFICIENT_SIGNAL` with one focused
  follow-up question. Never fabricate a third route.
- Routes differ only when both their learning question and test differ.
- Every quote equals a substring of its referenced confirmed reflection.
- Tests take at most seven days and stay within recorded time and money caps.
- `revise_route_set` is participant-only and owns pre-choice edits plus individual/all rejection;
  rejecting all resolves the set without creating a hypothesis.
- a reshaped `propose_route_set` cites `supersedesRouteSetRef`; accepted hypotheses record both
  originating route-set and route refs.
- `choose_route` is participant-only. It may carry final edits, atomically creates one accepted
  hypothesis plus receipt, and leaves the other routes as proposal history.
- Rejection and compensation preserve proposal and receipt history.

### Required proof

- propose success from agent and participant actors;
- exactly-three, unique-kind, distinct-question/test, quote, ref, cap, and length validation;
- `INSUFFICIENT_SIGNAL` without mutation;
- revise, reject one/all, supersede, choose with/without final edit, compensate, reload, and migration;
- wrong actor, wrong phase/lifecycle/workspace, stale, same-id replay, same-id conflict, malformed and
  extra fields, corrupt/quota failure;
- from `web/`: `npm run check`.

## P3B — Guided journey and Route Room

**Owner:** Tirth · **Depends on:** frozen/integrated P3A

### Owned paths

- `web/src/components/journey/`
- `web/src/components/routes/`
- `web/src/components/primitives/`
- `web/src/content/`
- `web/src/styles/`
- page composition and P3 browser tests

### Contract

- one question per screen; early shape-of-stuck branch; equal free-writing path;
- honest progress, Back, safe Skip, save/exit, and resume;
- participant confirms editable source wording before route proposals cite it;
- human-only mode offers a guided manual route workshop through `propose_route_set`;
- route reveal shows equal weight and no “best” label;
- participant can mark what draws them in, worries them, and what each route would teach; the
  comparison rearranges these human marks without ranking;
- edit/reject happens before the single “Choose this to test” action;
- primary copy never exposes command names, versions, receipts, “unknown,” or “hypothesis ghost.”

### Required proof

- every early branch and free-writing path reaches a valid route set or focused follow-up;
- route repair, rejection, comparison, choosing, reload, and plain-language history;
- unsupported WebMCP and provider-disabled journeys remain complete;
- keyboard-only, focus restore, semantic fields, live status, 44px targets, 200% zoom, reduced motion,
  high contrast, screen reader pass, 390px viewport, desktop, and clean console;
- from `web/`: `npm run check`.

## Rollback or recovery

P3A owns a versioned migration and must preserve original bytes on migration failure. P3B can be
reverted without changing product state. Neither packet performs remote or irreversible effects.

## Out of scope

WebMCP registration belongs to P8A/P8B. Executing the seven-day test starts in P4. Participant value
claims remain safeguarding- and recruitment-gated.

## Closeout receipt

- packet and owner:
- base/head SHA and dirty state:
- paths changed:
- commands and exact results:
- browser/runtime proof class:
- rollback/recovery result:
- remaining unknowns:
- disposition:
