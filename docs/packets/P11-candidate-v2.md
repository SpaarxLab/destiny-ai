# Packet P11 — Candidate v2: two chairs, one table

**Status:** IN PROGRESS · **Owner:** Harsh (integration) with Lane A/B/C/D execution
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

- base/head SHA and dirty state:
- paths changed:
- commands and exact results:
- harness/Chrome/ChatGPT proof reached:
- remaining unknowns:
- disposition:
