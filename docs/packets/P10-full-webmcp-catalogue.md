# Packet P10 — Full Product WebMCP Catalogue

**Status:** PROPOSED POST-SUBMISSION · **Owner:** Harsh (Lane C)
**Linear:** SPX-13 · **Integration destination:** `main`
**Depends on:** integrated P5 and P8C; P6/P7 capabilities wait for their own integration

## Operator-visible outcome

A visiting agent can complete the full experiment/evidence/revision lifecycle through thin,
phase-aware WebMCP adapters while the participant retains every consequential decision.

## Scope and owned paths

- remaining catalogue adapters and schemas in `web/src/webmcp/`;
- full fixture-driven agent suite in `web/src/webmcp/evals/`;
- catalogue audit against integrated commands and projections.

## Contract and invariants

- add tools only after their canonical commands integrate;
- every write includes `operationId` and `expectedVersion` and returns a receipt;
- command kernel rechecks phase, lifecycle, refs, evidence relation, and approval;
- no send tool, hidden memory, permission earning, or second writer;
- P8A/P8B tool behavior remains backward-compatible unless a versioned contract changes.

## Required proof

- catalogue completeness and schema parity;
- malformed, wrong phase/lifecycle/ref, stale, replay, injection, and denial checks;
- at least 15 scripted sessions across `SPEC.md` section 12, with every hard invariant passing;
- no-provider full journey and `npm run check`.

## Rollback or recovery

Remove individual adapters or revert P10 without changing canonical commands or stored data.

## Remaining unknowns

Post-submission participant usefulness and future inference remain separately gated.

## Closeout receipt

- branch/SHA:
- dirty state:
- verified:
- unverified:
- disposition:
