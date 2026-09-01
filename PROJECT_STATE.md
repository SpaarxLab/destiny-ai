# Destiny.AI — Project State

## Objective

Submit a strong ChatGPT WebMCP Challenge candidate. A career-stuck adult confirms their words and
limits, hands the shared Route Room to ChatGPT, and watches it read, ask one question if needed,
propose three grounded routes, and replace only the route the person set aside. Every agent move is
a receipted proposal the person can see; only the person chooses, reopens, exports, or starts over.
The product does not predict a career.

## Current authority

- **Contract:** `SPEC.md` (contract 1.2.0, schema 3, read contract 3.0.0, method 2.0.0)
- **Accepted decisions:** `docs/DECISIONS.md`, through D-015
- **Delivery programme:** `docs/PLAN.md`
- **Active packet:** `docs/packets/P11-candidate-v2.md`
- **Canonical repo:** `/Users/harsh/career-lab`; Next.js app in `web/`; integration branch `main`
- **Working worktree and branch for the candidate:** `/Users/harsh/.codex/worktrees/fbf7/career-lab`
  on `codex/spx-18-candidate-v2` (stacked on `codex/spx-10-p8b` at `44fcf23`). Integration
  destination is `main` through a pull request.
- **Learning guide:** `docs/HOW_IT_WORKS.md`
- **Execution tracker:** [Linear — Destiny.AI Build & Proof](https://linear.app/harsh-shah/project/destinyai-build-and-proof-5987c83d1c4c/overview)

Repository documents are product authority. Linear mirrors owners, dependencies, and delivery
status. A task is not complete because a ticket says so; its packet and PR must contain the proof.

## Where the code is

| Slice | State | Where |
|---|---|---|
| P0A, P1, P2 (command spine, cold orientation) | integrated | `main` (PR #1, PR #2) |
| P3A route domain, P3B journey, P3C route projections, P8A WebMCP reads | integrated | `main` (PR #5-#8) |
| P8B `propose_route_set` WebMCP write tool and evals | committed, not integrated | `codex/spx-10-p8b` (`945ff0f`, `44fcf23`) |
| P11 candidate v2 (D-015): follow-up questions, replace-what-you-set-aside, limits and reopen commands, declarative draft form, rebuilt Route Room, activity and agent view, embedded lab assistant, simulator, real-Chrome suite | committed at `4b25498` (code) with docs following in the next commit | `codex/spx-18-candidate-v2` |

## Accepted experience

- Promise: "You do not have to choose your whole career. Find one direction worth testing next."
- Audience: adults who feel stuck; the first choice adapts the journey without labelling the person.
- Primary surface: ChatGPT conversation through WebMCP, with the website as the shared Route Room.
- Two chairs, one table: the same commands, the same receipts, the same projection for both.
- Human gate: the participant edits, sets aside, answers, skips, and chooses; `choose_route` is the
  single acceptance command. `reopen_exploring` lets them change their mind with a receipt.
- Inference: the embedded lab assistant is optional, server-side, consent-gated, disabled by
  default, and replaceable. EVE is deferred.

## Verified evidence on this branch

All local, on the worktree above, with no inference provider configured:

- `npx tsc --noEmit`: clean.
- `npx vitest run`: 14 files, 180 tests pass (domain, kernel, storage, reader, adapters, WebMCP
  contracts and evals, inference provider-off suite, simulator, journey state).
- `npx eslint .`: clean.
- `npx playwright test tests/journey.spec.ts`: 10 passed (human path, manual drafts, edit/set
  aside/choose/reopen, start over, agent view, keyboard, 390px matrix, simulated visiting agent).
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

1. Open the pull request from `codex/spx-18-candidate-v2` to `main` and integrate after review.
2. Mirror `docs/packets/P11-handoff-tickets.md` into Linear.
3. Deploy the candidate SHA to a public URL and read back contract 1.2.0 / schema 3 through
   `read_workspace`.
4. Run the story in the ChatGPT in-app browser and record it with receipts visible on screen.
5. Optionally configure the lab assistant (`LAB_ASSISTANT_PROVIDER=openai_compatible` plus base URL,
   key, model) and capture one live proposal, one `insufficient_signal`, and one provider-failure
   receipt showing the WebMCP path unaffected.
6. Public repository with a visible MIT license, English description covering WebMCP fit, UX
   improvement, new human-agent capabilities, and implementation approach, testing instructions,
   public YouTube video under three minutes with audio, Devpost submission.
7. Name the qualified safeguarding reviewer for distress copy.
8. Record five adult participant commitments using pseudonymous IDs only.

Gates 3-6 are human steps for Harsh. Gates 7-8 do not block synthetic-fixture implementation or
deterministic testing.

## Supersession receipt

D-015 supersedes the P3/P8B rule that `insufficient_signal` was non-mutating, the P8B rule that
denied every new proposal while an unresolved set remained, and the P3B initial-snapshot cap
seeding. D-014's Destiny Journey, three-route reveal, and replaceable-inference boundary remain
current. The earlier statement in this file that P3 and WebMCP registration were not implemented
was stale and is withdrawn. Pre-2026-09-01 whiteboards, the student seven-day-plan MVP, and the
eight-internal-agent concept remain archived under `docs/archive/2026-09-01-foundation/`.
