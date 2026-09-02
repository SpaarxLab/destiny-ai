# Destiny.AI — Project State

## Objective

Submit a strong ChatGPT WebMCP Challenge candidate whose first useful minute is The Deck: a
career-stuck adult sorts concrete moments, reviews evidence-backed tensions, accepts a Portrait, and
then enters the shared Route Room. Agents may deal and propose through the same command kernel; only
the person swipes, resolves, chooses, reopens, exports, or starts over. The product does not predict
a career.

## Current authority

- **Contract:** `SPEC.md` (contract 2.0.0, schema 4, read contract 4.0.0, method 3.0.0)
- **Accepted decisions:** `docs/DECISIONS.md`, through D-016
- **Delivery programme:** `docs/PLAN.md`
- **Active packet:** `docs/packets/P12-deck.md`
- **Canonical repo:** `/Users/harsh/career-lab`; Next.js app in `web/`; integration branch `main`
- **Integrated candidate:** `main` at merge commit `3d814a6` through PR
  [#10](https://github.com/SpaarxLab/destiny-ai/pull/10); application candidate `7909cc7`,
  evidence head `0134a6e`.
- **Learning guide:** `docs/HOW_IT_WORKS.md`
- **Active implementation:** `codex/spx-32-deck`, based on `origin/main` at `35a273d`.
- **Execution tracker:** [Linear — Destiny.AI Build & Proof](https://linear.app/harsh-shah/project/destinyai-build-and-proof-5987c83d1c4c/overview)

Repository documents are product authority. Linear mirrors owners, dependencies, and delivery
status. A task is not complete because a ticket says so; its packet and PR must contain the proof.

## Where the code is

| Slice | State | Where |
|---|---|---|
| P0A, P1, P2 (command spine, cold orientation) | integrated | `main` (PR #1, PR #2) |
| P3A route domain, P3B journey, P3C route projections, P8A WebMCP reads | integrated | `main` (PR #5-#8) |
| P8B `propose_route_set` WebMCP write tool and evals | integrated | `main` (PR #9 and candidate closeout in PR #10) |
| P11 candidate v2 (D-015): follow-up questions, replace-what-you-set-aside, limits and reopen commands, declarative draft form, rebuilt Route Room, activity and agent view, embedded lab assistant, simulator, real-Chrome suite | integrated after five independent Luna review lanes and exact-head CI | `main` at `3d814a6` (PR #10) |

## Accepted experience

- Promise: "You do not have to choose your whole career. Find one direction worth testing next."
- Audience: adults who feel stuck; the first choice adapts the journey without labelling the person.
- Primary surface: ChatGPT conversation through WebMCP, with the website as the shared Route Room.
- Two chairs, one table: the same commands, the same receipts, the same projection for both.
- Human gate: the participant edits, sets aside, answers, skips, and chooses; `choose_route` is the
  single acceptance command. `reopen_exploring` lets them change their mind with a receipt.
- Inference: the embedded lab assistant is optional, server-side, consent-gated, disabled by
  default, and replaceable. EVE is deferred.

## Verified evidence for the integrated candidate

### The Deck branch (`codex/spx-32-deck`)

- Contract 2.0.0 / schema 4 / read 4.0.0 / method 3.0.0 implemented locally.
- `npm run check`: 15 test files / 189 tests, lint, TypeScript, and production build pass.
- `npm run test:browser`: 13/13 pass, including Deck desktop/390px, the preserved v2 journey, and
  visiting-agent/context-isolation stories.
- SDK-backed WebMCP browser runtime registered the phase catalogue, omitted participant-only
  `swipe_card`, read schema 4, and returned a non-mutating `TRAY_FULL` denial.
- All four configured OpenCode Go models returned HTTP 200 and valid JSON through their current API
  protocols. Embedded role output still fails closed to the fixture tray on schema/quality failure.
- Desktop and phone screenshots were visually inspected; a mobile fourth-pile overflow found in
  that pass was fixed and the focused browser suite rerun.

These are branch-local, synthetic, and runtime checks—not integration, deployment, ChatGPT in-app,
Gemini, participant, video, public-source, or submission proof.

### Integrated candidate v2 on `main`

All local and exact-head CI, with no inference provider configured:

- `npx tsc --noEmit`: clean.
- `npx vitest run`: 14 files, 182 tests pass (domain, kernel, storage, reader, adapters, WebMCP
  contracts and evals, inference provider-off suite, simulator, journey state).
- `npx eslint .`: clean.
- `npm run test:browser`: 11 passed (human path, manual drafts, edit/set aside/choose/reopen,
  serialized start over, agent view focus/Escape, keyboard, 390px matrix, simulated visiting agent,
  and isolated browser contexts).
- Real Google Chrome 152 with the `enable-webmcp-testing` flag persisted in a throwaway profile:
  `document.modelContext` is present with `registerTool`, `getTools`, `executeTool`, `ontoolchange`;
  `executeTool` returns our results as JSON strings; declarative `<form toolname>` tools are
  synthesised and `toolautosubmit` forms must answer through `event.respondWith`. The live suite
  (`npx playwright test -c playwright.live.config.ts`) passed discovery, orientation, method guide,
  malformed denial, declarative `respondWith`, a seeded proposal/replay/denial/follow-up story, and
  the full rendered Route Room story (draft, follow-up, proposal, denied overwrite, set aside,
  carry-over replacement, choice, readback): 6 passed.

This is local and real-browser proof only. It is not ChatGPT in-app browser, deployed, participant,
public-source, video, or submission proof.

## Remaining gates

1. Mirror `docs/packets/P11-handoff-tickets.md` into Linear.
2. Deploy the candidate SHA to a public URL and read back contract 1.2.0 / schema 3 through
   `read_workspace`.
3. Run the story in the ChatGPT in-app browser and record it with receipts visible on screen.
4. Optionally configure the lab assistant (`LAB_ASSISTANT_PROVIDER=openai_compatible` plus base URL,
   key, model) and capture one live proposal, one `insufficient_signal`, and one provider-failure
   receipt showing the WebMCP path unaffected. Do not enable it publicly without authenticated,
   rate-limited infrastructure.
5. Public repository with a visible MIT license, English description covering WebMCP fit, UX
   improvement, new human-agent capabilities, and implementation approach, testing instructions,
   public YouTube video under three minutes with audio, Devpost submission.
6. Name the qualified safeguarding reviewer for distress copy.
7. Record five adult participant commitments using pseudonymous IDs only.

Gates 2-5 are human steps for Harsh. Gates 6-7 do not block synthetic-fixture implementation or
deterministic testing.

## Supersession receipt

D-015 supersedes the P3/P8B rule that `insufficient_signal` was non-mutating, the P8B rule that
denied every new proposal while an unresolved set remained, and the P3B initial-snapshot cap
seeding. D-014's Destiny Journey, three-route reveal, and replaceable-inference boundary remain
current. The earlier statement in this file that P3 and WebMCP registration were not implemented
was stale and is withdrawn. Pre-2026-09-01 whiteboards, the student seven-day-plan MVP, and the
eight-internal-agent concept remain archived under `docs/archive/2026-09-01-foundation/`.
P11 candidate implementation and review are current on `main`; `docs/packets/P11-candidate-v2.md`
is its build receipt, while `docs/packets/P11-handoff-tickets.md` now governs the remaining gates.
