# Packet P11 — Candidate v2: two chairs, one table

**Status:** BUILT, AWAITING COMMIT AND CLOSEOUT · **Owner:** Harsh (integration) with Lane A/B/C/D execution
**Linear:** SPX-18 · **Integration destination:** `main` · **Depends on:** integrated P8B (`44fcf23`)
**Authority:** D-015, `SPEC.md` contract 1.2.0

## Operator-visible outcome

A person confirms their words and limits, hands the room to ChatGPT, and watches ChatGPT read, ask
one question if needed, propose three grounded routes, and replace only the route the person set
aside. Every move shows provenance and a receipt in the room; the person alone chooses, can reopen,
export, or start over. The same story runs in real Chrome with WebMCP enabled and in the harness.

## Owned paths

- Lane A: `web/src/domain/`, `web/src/commands/`, `web/src/storage/`, `web/src/adapters/`,
  `web/src/projections/`
- Lane B: `web/src/webmcp/`, `web/tests/webmcp-live.spec.ts`, `web/playwright.live.config.ts`
- Lane C: `web/src/components/`, `web/src/content/`, `web/src/styles/`, `web/src/app/` (no API),
  `web/tests/journey.spec.ts`
- Lane D: `web/src/inference/`, `web/src/app/api/lab-assistant/`, `web/package.json`,
  `web/.env.example`
- Integration: root docs, `docs/HOW_IT_WORKS.md`, `docs/proof/`

## Contract and invariants

See D-015. Additionally: no lane writes storage outside the kernel; the assistant route handlers
persist nothing; the simulator is eval-only; the declarative form never submits on the agent's
behalf; private notes are never inside any projection.

## What was built

- Lane A: workspace schema v3 (`followUpQuestions`, `carriedFromRouteRef`, `answersFollowUpRef`,
  phase/hypothesis consistency, at-rest caps only for proposed sets), commands `set_limits`,
  `skip_follow_up`, `reopen_exploring`, receipted `insufficient_signal`, carry-over supersession,
  migration v1 -> v2 -> v3, participant/WebMCP/embedded adapters, reader v3 (`confirmedWords`,
  `active.followUp`, `proposal` availability, `read-workspace/3.0.0`, 8,000-char / 4,000-byte
  budget), regenerated golden fixtures, 114 lane tests.
- Lane B: method guide 2.0.0 with steps, boundaries, and example input; rule-bearing tool
  descriptions; ledger-derived replay registration; activity events; `draft_words` declarative form
  hook with `respondWith`; evals for follow-up and replacement round trips and a UI-shaped fixture;
  `playwright.live.config.ts` and `tests/webmcp-live.spec.ts` against real Chrome.
- Lane C: rebuilt journey (welcome, shape, questions, confirm words, limits, handoff, workshop,
  room, chosen), Route Room with provenance chip, tags, grounding highlights, follow-up card,
  activity drawer, agent view panel, denial notice, start over, export, reopen; draft key
  `destiny-ai.journey.v2`; `tests/journey.spec.ts` (10 tests).
- Lane D: `web/src/inference/` (schemas, grounding, providers, lab assistant, simulator, scripted
  mock model), `/api/lab-assistant/status` and `/propose`, `.env.example`; dependencies
  `ai@6.0.274`, `@ai-sdk/openai-compatible@2.0.74`, `@ai-sdk/provider@3.0.15`; 25 tests.

## Required proof

- `npm run check` on the candidate SHA;
- Playwright journey suite (human path, simulated agent path, follow-up, replacement, reopen,
  start over, accessibility matrix);
- real Chrome WebMCP suite (`playwright.live.config.ts`): discovery, read, method guide, malformed
  denial, proposal, replacement, choice readback, declarative draft form;
- provider-off inference suite; live provider run is a human step with a key;
- screenshots at 1440 and 390 of every state;
- ChatGPT in-app browser run recorded by a human, with the receipts visible on screen.

## Rollback or recovery

Revert the branch merge; workspace schema v3 migration is additive and the v2 bytes are preserved on
failure. Local data can be cleared from the welcome screen.

## Closeout receipt

- base/head SHA and dirty state: base `44fcf23` (codex/spx-10-p8b); code commit `4b25498`; docs
  commit follows; worktree clean after the docs commit.
- paths changed: see `git show --stat 4b25498` (web/src domain, commands, storage, adapters,
  projections, webmcp, components, content, styles, inference, app/api, tests; docs).
- commands and exact results: `docs/proof/p11/local-proof.md` (npm run check: 180 tests, lint,
  types, build; journey suite 10/10; isolation spec 1/1; real-Chrome live suite 6/6).
- harness/Chrome/ChatGPT proof reached: harness and real Chrome 152 with the WebMCP flag. ChatGPT
  in-app browser, deployment, live provider: not reached (human steps in the handoff tickets).
- remaining unknowns: ChatGPT runtime behaviour with declarative forms and annotations; deployed
  header/permissions-policy behaviour; participant usefulness.
- disposition: READY FOR REVIEW (INTEGRATE after PR review by Devarsh and Tirth).
