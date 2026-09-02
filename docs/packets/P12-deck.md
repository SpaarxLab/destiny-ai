# Packet P12 — The Deck

**Status:** LOCALLY VERIFIED, INTEGRATION/RELEASE GATES OPEN · **Owner:** Harsh
**Integration destination:** `main` · **Branch:** `codex/spx-32-deck`
**Depends on:** integrated candidate v2 at `35a273d` · **Authority:** D-016, `SPEC.md` 2.0.0

## Outcome

A fresh participant enters a tactile, provider-optional Deck before the Route Room. They alone sort
moment cards into four visible piles. Agents may deal cards and propose evidence-backed tensions and
a Portrait through the shared kernel. A kept Portrait opens the existing limits and route journey.

## Owned paths

- Domain and authority: `web/src/domain/`, `web/src/commands/`, `web/src/storage/`,
  `web/src/adapters/`, `web/src/projections/`
- Experience: `web/src/components/deck/`, `web/src/content/fixture-deck.ts`,
  `web/src/styles/destiny.css`, journey integration
- Agent surface: `web/src/webmcp/`, `web/src/inference/roles/`, `web/src/app/api/roles/`
- Proof: focused kernel tests, aggregate check, browser journey, SDK WebMCP runtime, live model eval

## Binding gates

- Every write needs `operationId` and `expectedVersion`, with replay or conflict behavior proven.
- No agent adapter or WebMCP catalogue exposes participant swiping or resolutions.
- A tension needs at least three swipe receipts plus a slow swipe or opposite-pole contradiction.
- A Portrait needs two or three participant-kept tensions.
- Existing v3 workspaces migrate additively and retain their phase; only fresh workspaces start Deck.
- Embedded roles are disabled by default, receive only the consented bounded projection, and never
  persist. Fixture behavior remains the availability baseline.

## Deliberate deadline cuts

The Must path is implemented. Influence proposals, redeal in later phases, declarative
`offer_reasons`, and a separate embedded Skeptic UI loop are deferred. The kernel still supports
falsification cards and self-falsification denial. Public deployment, ChatGPT in-app proof, Gemini
proof, participant usefulness, video, and submission remain human/release gates.

## Required proof

- `npm run check`
- focused Deck kernel tests, including denials, replay, actor, evidence, Portrait, and migration
- responsive browser proof at desktop and 390px
- SDK-backed `document.modelContext` discovery and one read/write/denial story
- live smoke for all configured OpenCode Go role models without exposing the credential
- exact branch, SHA, dirty state, and honest boundary receipt

## Recovery

Revert this branch before merge. Schema v4 migration is additive and retains the original bytes on
failure. Provider-off mode requires no remote cleanup; embedded roles are killed with
`EMBEDDED_ROLES=off`.

## Local verification receipt

- `npm run check`: 15 files / 189 tests, lint, TypeScript, and production build passed.
- `npm run test:browser`: 13/13 passed, including fresh Deck swipe/persistence, 390px overflow,
  legacy journey preservation, start-over into Deck, visiting-agent flow, and context isolation.
- SDK WebMCP browser runtime: Deck catalogue registered; `swipe_card` absent; orientation read back
  contract 2.0.0/schema 4/read 4.0.0; over-capacity `deal_cards` returned `TRAY_FULL` with no write.
- OpenCode Go: local auth configured; CLI exact-JSON calls and direct endpoint eval passed for
  `glm-5.3-flash`, `qwen3.8-flash`, `deepseek-v4-flash`, and `gpt-5.6-luna`. The credential value
  was never printed or written into the repository. A live generated Dealer card also passed the
  endpoint's schema and moment-quality check; a synthetic Reader attempt missed its strict schema
  and correctly returned `SCHEMA_FAILED`, leaving the deterministic Reader available.
- Visual inspection: desktop Table and 390px Deck rendered; the discovered mobile fourth-pile
  positioning/overflow defect was fixed and the focused mobile suite rerun.

This is local, synthetic, and browser-runtime proof. It is not deployment, ChatGPT in-app, Gemini,
participant, video, public-source, or submission proof.
