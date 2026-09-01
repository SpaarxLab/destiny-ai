# P11 local proof receipt

Candidate: branch `codex/spx-18-candidate-v2`, commit `4b25498`, worktree
`/Users/harsh/.codex/worktrees/fbf7/career-lab`, Node 24.14.1, npm 10.9.8, Google Chrome 152.0.7977.65.

| Command (from `web/`) | Result |
|---|---|
| `npm run check` | vitest 14 files / 180 tests pass; eslint clean; `next typegen && tsc --noEmit` clean; `next build` ok (`/` static, `/api/lab-assistant/*` dynamic) |
| `npx playwright test tests/journey.spec.ts` | 10 passed (Chromium, fake `document.modelContext` injected for the agent story) |
| `npx playwright test -c playwright.live.config.ts` | 6 passed in real Chrome with the `enable-webmcp-testing` flag persisted in a temporary profile |

## What the real-Chrome suite proves

All agent steps go through `document.modelContext.getTools()` and `executeTool()` in the browser's
own WebMCP implementation; all human steps are Playwright clicks on the rendered page.

1. First load registers read tools only; the badge reports the connection.
2. `read_workspace` and `get_method_guide` return typed envelopes (serialized as JSON strings by Chrome).
3. The declarative `draft_words` form receives `respondWith` on an agent-invoked submit
   (`event.agentInvoked === true`), stages the text, and does not save; the human confirms.
4. From a journey-shaped workspace: proposal with receipt, same-id replay returning the identical
   receipt, `POLICY_DENIED` for a superseding proposal with no set-aside route, reread showing the
   pending participant decision.
5. `insufficient_signal` creates a receipted follow-up visible on reread as `ANSWER_FOLLOW_UP`.
6. Full story through the rendered Route Room: draft words, confirm, limits, proposal appears in the
   catalogue, follow-up asked and answered, proposal renders "Proposed by ChatGPT" with a receipt
   sentence in the drawer, a denied overwrite shows a visible notice with the ledger unchanged, Probe
   set aside, a proposal that swaps a kept route is denied, the carry-over replacement renders
   "Replaced by ChatGPT" and "Kept from your last set", the human chooses Closest, the write tool
   disappears from `getTools`, and the reread shows phase TESTING with the accepted hypothesis and
   `latestChange` = `choose_route` by the participant. Zero console or page errors.

## Not proven here (human steps)

ChatGPT in-app browser behaviour, deployed URL readback, a live inference provider, participant
usefulness, and submission artifacts. See `docs/packets/P11-handoff-tickets.md`.
