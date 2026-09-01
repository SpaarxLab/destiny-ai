# Destiny.AI — Competition-First Build Plan

**Status:** APPROVED through D-014. P1/P2 are integrated. A0 authority is active.
**Deadline:** 3 September 2026, 1:00 p.m. Pacific / 4 September, 1:30 a.m. IST.
**Authority:** `PROJECT_STATE.md` · `SPEC.md` · `docs/DECISIONS.md`.

## Candidate v2 status (P11)

The competition candidate is now `docs/packets/P11-candidate-v2.md` under D-015, built on
`codex/spx-18-candidate-v2` across Lanes A-D. P11 realises the C1 (ChatGPT collaboration and evals)
and C2 (human and candidate hardening) outcomes below in one dependency-closed packet: receipted
follow-up questions, replace-only-what-was-set-aside, `set_limits` and `reopen_exploring`, the
declarative `draft_words` form, the rebuilt Route Room with activity and agent view, the optional
embedded lab assistant, the visiting-agent simulator, and a real-Chrome WebMCP suite. C3 / P8C
(deploy, public source, video, ChatGPT in-app run, submission) remains the next gate. The sections
below are kept as the approved programme and are not rewritten.

## What we are shipping

### Competition candidate

A career-stuck adult completes a guided Destiny Journey and sees three grounded routes. ChatGPT uses
WebMCP to read confirmed words and call `propose_route_set`. The participant repairs the previews
and calls `choose_route`, the single acceptance command. ChatGPT then reads that decision back. The
website shows the same state in the Route Room.

The candidate must work without embedded inference credentials. It needs a live URL, public licensed
repository, public video under three minutes, testing instructions, and fresh ChatGPT WebMCP proof.

### Full product

After the candidate, the chosen route becomes a small experiment, confirmed evidence, and an
inspectable human-approved revision. AI SDK/OpenCode Go Luna can later provide an optional embedded
proposal source. It does not replace ChatGPT/WebMCP or become state authority.

## Stable ownership

| Lane | Owner | Owns | Must not own |
|---|---|---|---|
| A — Domain | Devarsh | schemas, commands, migration, receipts, contract tests | UI or WebMCP policy copies |
| B — Human experience | Tirth | guided journey, Route Room, accessibility, browser journeys | direct persistence |
| C — Agent surface | Harsh | WebMCP, evals, inference adapter, runtime and release proof | domain policy or human approval |
| Integration | Harsh | authority, dependency order, candidate identity, PR stack | silent scope changes |

## Proven base

| Packet | State | Proof | Unlocks |
|---|---|---|---|
| P0A authority | INTEGRATED | baseline and recovery receipt | safe integration |
| P1 command spine | INTEGRATED | PR #1, tests, CI, browser receipt | governed writes |
| P2 cold orientation | INTEGRATED | PR #2, bounded reads, CI, browser receipt | A1 and B1 |

This proves only the base. It does not prove P3, WebMCP, deployment, usefulness, or submission.

## Dependency graph

```text
                         COMPETITION
                 +--> A1 P3 domain --> A2 journey --+
A0 authority ----+                                  +--> C1 P8B --> C2 hardening --> C3 P8C
                 +--> B1 P8A WebMCP ----------------+

                         OPTIONAL / LATER
C3 P8C --> D1 P9 AI SDK + OpenCode Go Luna
A1 P3  --> P4 experiment --> P5 evidence/revision --> P6/P7 --> P10 full WebMCP
```

Only A1 and B1 are initially parallel. A2 starts from the exact A1 head. C1 starts only after A2
and B1 integrate. A green branch does not override this dependency order.

## Smooth, dependency-closed tickets

### SPX-14 / A0 — Authority and PR-stack base

- **Owner:** Harsh
- **Outcome:** everyone builds the same Destiny Journey, Route Room, WebMCP catalogue, and trust model.
- **Paths:** root authority docs and `docs/packets/` only.
- **Done when:** D-014, spec, plan, packets, owner paths, tests, and PR receipt agree; no product code.
- **Rollback:** revert this documentation outcome; P1/P2 remain intact.

### SPX-15 / A1 / P3A — Route proposal and selected-hypothesis domain

- **Owner:** Devarsh
- **Starts after:** A0 exact head.
- **Outcome:** `propose_route_set` stores one bounded three-route proposal; participant-only
  `revise_route_set` owns repair/rejection and `choose_route` atomically advances one edited route
  into an accepted hypothesis and receipt.
- **Paths:** `web/src/domain/`, `web/src/commands/`, `web/src/storage/`, fixtures and focused tests.
- **Done when:** schema migration, quote fidelity, distinct-question/test rules, caps,
  `INSUFFICIENT_SIGNAL`, edit, reject, choose, compensation, stale, replay, conflict, malformed, and
  corrupt-storage paths pass.
- **Not included:** UI, WebMCP registration, model calls.

### B1 / P8A — Native WebMCP foundation and reads

- **Owner:** Harsh
- **Starts after:** A0 exact head; may run beside A1.
- **Outcome:** supported pages safely expose `read_workspace` and `get_method_guide`; unsupported pages
  keep the full human journey.
- **Paths:** `web/src/webmcp/`, read-adapter tests, small honest connection status.
- **Done when:** feature absent/present, registration replacement, abort/remount/navigation, bounds,
  schema parity, malformed input, stale cached call, no mutation, and deterministic harness pass.
- **Not included:** P3 write tool or inference.

### SPX-16 / A2 / P3B — Guided Destiny Journey and Route Room

- **Owner:** Tirth
- **Starts after:** frozen A1 contract.
- **Outcome:** a person chooses the shape of stuck, answers focused prompts, confirms quotes, sees and
  repairs three routes, then chooses one through the single acceptance command.
- **Paths:** `web/src/components/journey/`, `components/routes/`, `components/primitives/`,
  `content/`, `styles/`, page composition and browser tests.
- **Done when:** every early branch, free-writing, Back, safe Skip, refresh/resume, route edit/reject,
  selection with final edit, route rejection, receipt, mobile, keyboard, zoom, reduced motion, and clean console
  pass against the A1 command contract.
- **Not included:** direct storage, duplicated policy, WebMCP handlers.

### C1 / P8B — ChatGPT collaboration and evals

- **Owner:** Harsh
- **Starts after:** integrated A2 and B1.
- **Outcome:** ChatGPT reads the journey, uses the versioned method, calls `propose_route_set`, and
  observes the participant's `choose_route` decision and receipt.
- **Paths:** WebMCP catalogue/tools/evals and ChatGPT journey fixtures.
- **Done when:** hard invariant suite, tool discovery, phase catalogue, exact quotes, human repair,
  write receipt, readback, injection-like content, stale/replay, unavailable-tool avoidance, and
  isolated multi-session tests pass.
- **Rule:** no average model score can hide a safety, authority, receipt, or lifecycle failure.

### C2 — Human and candidate hardening

- **Owner:** Tirth for UI fixes; Harsh for eval/runtime fixes; Devarsh for command defects.
- **Starts after:** C1 candidate branch.
- **Outcome:** the exact journey is clear, accessible, responsive, recoverable, and fast enough to
  demonstrate without explanation.
- **Done when:** copy review, accessibility matrix, mobile/desktop browser runs, provider-off journey,
  console/network checks, performance baseline, and rollback rehearsal pass. Defects return to their
  owner; C2 does not become a mega-PR.

### C3 / P8C — Immutable competition candidate

- **Owner:** Harsh
- **Starts after:** C2 has no blocking finding.
- **Outcome:** one exact SHA is deployed, runtime-proven, opened under the release gate, demonstrated,
  and submitted.
- **Done when:** CI, harness, enabled Chrome, fresh ChatGPT in-app browser, deployed readback, reset,
  rollback, public MIT repository, video with audio under three minutes, description, testing access,
  and Devpost receipt all name the same candidate.
- **Rule:** public release and submission are separate external gates; record their exact after-state.

### D1 / P9 — Optional AI SDK + OpenCode Go Luna adapter

- **Owner:** Harsh
- **Starts after:** provider-free candidate is stable; may be stacked separately but never block C3.
- **Outcome:** measure on synthetic fixtures whether `gpt-5.6-luna` produces better structured route
  proposals through AI SDK while `DisabledInferenceAdapter` preserves the baseline.
- **Paths:** `web/src/inference/`, server-only route, synthetic fixtures and evals.
- **Done when:** authenticated model catalogue, minimal structured response, exact-ref validation,
  streaming cancel, timeout, auth/429/5xx/schema failures, zero mutation on failure, provider-off
  parity, latency/cost/privacy receipt, and adopt/defer/reject decision are recorded.
- **Privacy:** real participant content remains browser-local until a separate accepted decision
  covers consent, minimisation, retention, deletion, provider terms, and failure handling.
- **EVE:** not part of D1. Create a new architecture ticket only after a durable-workflow need exists.

### D2 onward — Full learning loop

P4 adds the reversible experiment. P5 records confirmed evidence and proposes a revision. P6 stores
sourced human teachings. P7 completes recovery and workspace controls. P10 exposes only integrated
commands and runs at least 15 isolated agent sessions.

## PR stack

1. PR A0 updates existing documentation PR #4.
2. PR A1 branches from A0 and owns P3 domain only.
3. PR B1 branches from A0 and owns WebMCP foundation only.
4. PR A2 stacks on A1 and owns the journey/UI only.
5. PR C1 stacks after A2 plus B1 integration.
6. C2 fixes stay in small owner-specific PRs stacked on C1.
7. PR C3 contains proof and release artifacts, not unreviewed feature scope.
8. PR D1 is visibly optional and can land after the candidate.

Each PR states base/head SHA, owned paths, exact commands, observed proof, missing proof, rollback, and
whether it is ready to integrate. Never bulk-stage unrelated files.

## Test matrix

| Layer | Required proof |
|---|---|
| Domain | contract, caps, refs, phase, stale, replay, conflict, compensation, migration |
| UI | all branches, free text, repair, choice, human decision, reload, recovery |
| Accessibility | keyboard, focus, semantics, live status, 44px targets, 200% zoom, reduced motion |
| WebMCP | feature detection, lifecycle, catalogue parity, thin handlers, no direct mutation |
| Agent | discovery, correct tool use, injection resistance, readback, isolated sessions |
| Inference | structured output, cancel/timeout/errors, no mutation on failure, provider-off parity |
| Runtime | harness, enabled Chrome, fresh ChatGPT, deployed exact-SHA readback |
| Release | source/license, secrets/data review, video, testing instructions, submission receipt |

Subjective route quality and copy warmth use a separate reviewer rubric. Deterministic failures are
never averaged with model scores.

## Ticket closeout template

1. Outcome observed by a person.
2. Branch, base SHA, head SHA, and dirty state.
3. Owned paths changed; unrelated changes preserved.
4. Commands run and exact results.
5. Browser/runtime proof class reached.
6. Recovery or rollback exercised.
7. Remaining unknowns and human gates.
8. `INTEGRATE`, `DEFER`, `REJECT`, or `BLOCKED` disposition with reason.

## Release checklist

1. Working WebMCP app and judge-accessible live URL.
2. Clear explanation of the human journey, WebMCP fit, and shared-state collaboration.
3. Public source with visible license and challenge-period change history.
4. Public YouTube video under three minutes with audio and functioning demo.
5. ChatGPT in-app-browser or supported Chrome testing instructions.
6. Exact candidate identity, reset, rollback, and fresh readback.
7. Truthful claims limited to observed proof.

## Defer and reject

Defer auth, server database, sync, automatic outreach, background career agents, hidden memory, and
EVE. Reject career prediction, therapy claims, agent-sent messages, permission earning, fabricated
quotes, and any adapter that writes around the command kernel.
