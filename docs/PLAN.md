# Destiny.AI — Team Build Plan

**Status:** APPROVED. Foundation decisions are recorded in `docs/DECISIONS.md`; live packet
status lives in Linear and `PROJECT_STATE.md`. Participant research remains separately
reviewer- and recruitment-gated.
**Product contract:** `SPEC.md`.
**Review receipt:** `docs/archive/2026-09-01-foundation/SYSTEM_REVIEW.md`.
**Decision already made (Harsh, 2026-09-01):** build the complete learning vehicle,
skip the 2026-09-03 submission, and target a later submission window
(internal candidate 2026-09-29, contingency 2026-10-06).

## Outcome

Build one coherent human-agent loop:

`confusion -> quoted hypothesis -> cheap experiment -> confirmed evidence -> proposed revision`

The visiting agent reasons. Destiny.AI owns state, permissions, commands, receipts, and the
human approval boundary. The board remains useful without an agent; WebMCP makes a visiting
agent an unusually capable lab assistant rather than a chatbot.

## Non-negotiable build rules

1. One canonical repository and one declared integration branch before parallel work.
2. One command kernel for UI and WebMCP. A tool may not write state through a second path.
3. Every write carries `operationId` and `expectedVersion`; a retry returns the original
   receipt and never duplicates an effect.
4. Tool registration aids discovery; the command kernel re-checks phase, preconditions, and
   approval on every invocation.
5. Human feedback can improve future proposals, but never silently widen agent authority.
6. Only human-confirmed evidence can revise a hypothesis.
7. Each packet ends with a visible journey proof, denial/retry proof, and a receipt.
8. No lane starts a dependent packet while its contract is unsettled.

## Three team lanes

### Lane A — Domain, commands, and persistence

Owns `src/domain/`, `src/commands/`, `src/storage/`, migrations, invariants, operation
receipts, deterministic projections, and contract tests. Lane A publishes types and fixtures;
it does not own UI or WebMCP adapters.

### Lane B — Human board and collaboration

Owns `src/app/`, `src/components/`, accessibility, onboarding, ghosts, gates, week/outbox/
ledger views, clear/export/delete, and browser journey tests. Lane B invokes the command
kernel; it does not mutate the store directly.

### Lane C — Agent surface, evals, and release proof

Owns `src/webmcp/`, tool descriptions and adapters, `METHOD.md` delivery, fixture-based
agent evals, runtime compatibility, demo script, and deployment receipts. Lane C wraps Lane
A commands; it does not recreate business rules in tool handlers.

Harsh is integration captain for this programme. He admits only packets whose contract tests
and visible exit proof pass.

## Dependency-closed packets

| Packet | Visible outcome | Primary | Prerequisite | Required proof |
|---|---|---|---|---|
| P0A Authority and baseline | one repo, clean recoverable baseline | Harsh | accepted defaults | **INTEGRATED:** `752ab8e` + packet receipt |
| P0B Team admission | implementation owners recorded; research remains reviewer-gated | Harsh | owner decision | **P1 ADMITTED** |
| P1 Command spine | UI and a test adapter execute the same `save_reflection` command | A | P0B | schema, stale, replay, receipt tests |
| P2 Cold orientation | a new agent understands the active situation in one bounded read | A+C | P1 | golden orientation fixtures and token budget |
| P3 Hypothesis collaboration | quote-backed ghost can be accepted, edited, rejected, or compensated | A+B | P2 | full browser journey plus denial cases |
| P4 Experiment loop | accepted hypothesis produces one cost-capped, falsifiable experiment | A+B+C | P3 | wrong-phase, over-cap, stale, replay proof |
| P5 Evidence and revision | confirmed evidence leads to a human-approved confidence revision | all | P4 | unconfirmed/cross-hypothesis evidence denied |
| P6 Accretion | rejection/correction improves a cold agent's next proposal without changing authority | A+C | P5 | replay before/after, conflict and supersession proof |
| P7 Complete workspace | swipe, week, outbox, activity, compensation, privacy controls | B | P5 | solo journey, accessibility, export/import |
| P8 Runtime and release | same candidate works in supported WebMCP runtimes | C | P6+P7 | runtime matrix, deployed readback, rollback |

## Four-week sequence

### Week 1 — 2–8 September: establish truth and the vertical spine

- Day 1: resolve Gate 0, create the clean baseline, record owners and target.
- Day 2: freeze canonical nouns, lifecycle states, command/result envelopes, and storage
  migration strategy.
- Day 3: implement P1 and its replay/stale/malformed tests.
- Day 4: build P2 orientation projection and agent harness; make the same state legible in UI.
- Day 5: integrate the first vertical slice and run 10 rant fixtures. Do not score model prose;
  inspect quotation fidelity, state changes, denials, and receipts.

Exit: one reflection can enter through UI or tool adapter and produce the same after-state and
receipt; a cold agent can orient without reading the full history.

### Week 2 — 9–15 September: human-agent collaboration

- Build P3 and P4 in that order.
- Add ghosts, accept/edit/reject, corrections, phase gates, operation activity, and
  compensating undo.
- Test the board without an agent with at least three participants before adding visual
  flourish.
- Freeze the must-ship journey at the end of the week.

Exit: a participant can move from confusion to one accepted experiment, by hand or with an
agent, and explain every state change.

### Week 3 — 16–22 September: evidence, accretion, and WebMCP

- Build P5, then P6.
- Register only tools valid for the phase, but enforce validity again in commands.
- Turn human corrections into explicit, sourced, editable teachings. Derived summaries are
  projections; raw decisions and receipts remain inspectable.
- Run the agent eval suite on every schema, description, method-guide, or projection change.

Exit: a brand-new agent completes the full loop, survives stale/replay/timeout-style retries,
and demonstrably uses prior human teaching without receiving extra authority.

### Week 4 — 23–29 September: complete, harden, and prove

- Build P7 and P8; add only features that strengthen the frozen journey.
- Test five participants if available; report the actual number if not.
- Verify Chrome flag/origin-trial and ChatGPT in-app browser separately.
- Deploy an immutable candidate; record URL, commit SHA, schema/contract versions, runtime,
  data reset procedure, and rollback.
- Record the video only after a fresh end-to-end candidate readback.

Exit: the three-minute story works without narration and every success claim has the right
proof class. Local tests are not submission or production proof.

## Must ship, gate, and defer

### Must ship

- shared command kernel and versioned local persistence;
- cold-agent orientation, explicit affordances, typed errors, idempotent receipts;
- reflection, hypothesis ghost, experiment ghost, confirmed evidence, proposed revision;
- phase gates, visible activity, compensating undo, export/delete;
- WebMCP runtime test plus deterministic harness and end-to-end evals.

### Start after named gate

- swipe session: only after P3, and latency is interaction telemetry—not evidence about the
  participant's career;
- outreach and week views: only after P5;
- collaboration-profile distillation: only after raw feedback, provenance, conflict, and
  supersession are proven.

### Defer

- embedded fallback agent, Gmail/Calendar, server database, auth, multiple participants,
  background nudges, portfolio, opportunity radar, resource search, and internal AI modules.

### Reject for this build

- automatic career prediction, therapy claims, agent-sent outreach, silent preference
  inference, automatic permission earning, and any mutation path that bypasses commands.

The team operating rhythm, working agreement, and packet definition of done live in
`CONTRIBUTING.md`. Do not admit participant sessions or a public release merely because
local implementation begins.
