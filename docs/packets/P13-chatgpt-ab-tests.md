# Packet P13 — ChatGPT A/B Tests Your Future

**Status:** LOCALLY AND CODEX-IAB VERIFIED; CHATGPT-IAB GATE OPEN · **Owner:** Harsh
**Integration destination:** `main` · **Branch:** `codex/spx-32-deck`
**Depends on:** P12 card/tension contracts and P11 route/repair contracts · **Authority:** D-017

## Outcome

Destiny is a ChatGPT-only WebMCP instrument. ChatGPT inspects evidence, stages bounded probes,
proposes and challenges a hypothesis, presents both sides, stages exactly three route auditions and
highlights one reversible experiment. The participant reacts and decides only on the webpage.

## Owned paths

- Domain and kernel: `web/src/domain/`, `web/src/commands/`
- WebMCP surface and evals: `web/src/webmcp/`
- Experience: `web/src/components/deck/`, `web/src/components/room/`, journey integration and styles
- Authority and proof: `PROJECT_STATE.md`, `SPEC.md`, `docs/DECISIONS.md`, this packet and evidence

## Binding gates

- Exactly six connected tools; no participant-only command is registered.
- `stage_probe` returns `awaiting_participant` and a recovery ref immediately. Reload and disconnect
  preserve the staged card; `inspect_room` returns the participant receipt after response.
- Every write retains `operationId`, `expectedVersion`, stale denial, replay and receipt behavior.
- Connected mode runs no fixture Dealer, embedded Reader or hidden proposal.
- Route auditions are kernel-denied until a participant-settled falsification exists and ChatGPT has
  visibly revised or qualified the hypothesis.
- `present_evidence` and `propose_experiment` are non-mutating focus/recommendation operations.
- Route choice, hypothesis resolution, limits, evidence confirmation and commitment remain webpage
  actions using the participant adapter and the shared kernel.
- Every probe presents four explicit participant reactions before optional reasons; a reason can
  never manufacture or replace the chosen reaction.
- Participant copy is plain language and one-decision-at-a-time. Tool names, versions, raw receipts,
  JSON and timing are available only in optional technical details.
- Connected Deck mode contains no legacy history/context chrome, explainer strip, progress counter
  or footer. Evidence is collapsed until requested; contextual limits become the whole next step.
- Optional OpenCode Go roles and the lab assistant are local proposal sources only. Connected mode
  suppresses them, and schema/grounding/limit failure changes no state.

## Verification

- `npm run check`: 18 files / 201 tests, lint, TypeScript and production build passed.
- Focused browser coverage verifies all four reaction receipts, reason and skip preservation,
  keyboard use, mobile layout and graceful haptics failure.
- Focused end-to-end contract test covers limits, three probe templates, participant receipts,
  premature route denial, counterexample, revised hypothesis, non-mutating evidence, three rich
  auditions and decision-ready experiment.
- `run_probe` spike tests cover pending completion, abort, timeout, reload/replay and stale state.
- Codex in-app browser discovered exactly six page-defined tools and completed the fallback loop
  through route auditions at state v15 with zero console warnings/errors. See the evidence record.

## Recovery and rollback

The additive schema fields are optional/defaulted, so existing schema-4 workspaces parse unchanged.
Revert this packet before merge to restore the P12 connected catalogue. A staged fallback probe is
never deleted on tool disconnect; reload and `inspect_room` recover it.

## Remaining gate

The real ChatGPT in-app browser must run the exact prompt and record whether pending `run_probe`
interaction works. Until then, the product truth is the verified fallback protocol. Codex IAB,
tests, mocks and ordinary Chromium do not satisfy the ChatGPT-IAB completion gate.
