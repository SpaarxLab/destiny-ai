# Packet P7 — Complete Human Workspace

**Status:** PROPOSED · **Owner:** Tirth (Lane B)
**Linear:** SPX-7 · **Integration destination:** `main` · **Depends on:** integrated P5

## Operator-visible outcome

The complete career-experiment loop works accessibly by hand, including Board, Week, Outbox,
Activity, agent status, teachings, privacy, export/import preview, clear, and recovery states.

## Scope and owned paths

- participant application and components;
- accessibility and browser journeys;
- local export/import/clear and corrupt/quota recovery UI over canonical commands/store APIs.

## Contract and invariants

- no-agent mode is complete, not a degraded placeholder;
- ghosts and confirmed entities remain visually distinct;
- import validates and previews before replacement; clear is explicit and receipted as specified;
- no analytics or remote career-content storage is introduced.

## Required proof

- empty, loading, error, rejected, stale, conflict, corrupt/quota, offline, and recovery states;
- keyboard, focus, naming, contrast, reduced-motion, and responsive journey checks;
- export/import/clear round trip and full solo browser journey;
- `npm run check`.

## Rollback or recovery

Revert the packet. Preserve exported bytes and corrupt originals according to the storage contract.

## Remaining unknowns

Participant usefulness and safeguarding approval remain separate human gates.

## Closeout receipt

- branch/SHA:
- dirty state:
- verified:
- unverified:
- disposition:
