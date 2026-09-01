# Packet P6 — Sourced Human Teaching Without Authority Growth

**Status:** PROPOSED · **Owner:** Harsh (Lane C) with Devarsh (Lane A)
**Linear:** SPX-6 · **Integration destination:** `main` · **Depends on:** integrated P5

## Operator-visible outcome

A participant can turn an edit, rejection, or correction into an explicit sourced teaching.
A cold visiting agent uses it in a later proposal without gaining any new permission.

## Scope and owned paths

- teaching candidate, accept/edit/supersede, conflict, and orientation projection contracts;
- teaching UI and provenance display;
- before/after replay fixtures and authority comparison.

## Contract and invariants

- raw accept/edit/reject/correct receipts remain immutable;
- teachings require participant confirmation and cite source operations;
- scope is bounded by tool/entity/phase; conflicts are surfaced, never silently merged;
- supersession preserves history;
- available actions and command permissions are byte-for-byte equivalent before/after teaching.

## Required proof

- source/provenance, edit, conflict, supersession, stale, replay, and malformed tests;
- replay the same cold-agent fixture before and after teaching: proposal changes, authority does not;
- browser provenance journey; `npm run check`.

## Rollback or recovery

Revert the packet or supersede an active teaching. Never delete source decisions or receipts.

## Remaining unknowns

Model-dependent proposal quality is not required; deterministic fixtures prove the contract.

## Closeout receipt

- branch/SHA:
- dirty state:
- verified:
- unverified:
- disposition:
