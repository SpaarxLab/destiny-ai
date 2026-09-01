# Packet P5 — Evidence-Bound Confidence Revision

**Status:** PROPOSED · **Owner:** Devarsh (Lane A), with all lanes contributing
**Linear:** SPX-5 · **Integration destination:** `main` · **Depends on:** integrated P4

## Operator-visible outcome

A participant confirms what happened, sees a proposed interpretation, and approves any
confidence change. Unconfirmed or unrelated evidence cannot influence the hypothesis.

## Scope and owned paths

- evidence, verdict, and hypothesis-revision contracts and commands;
- confirmation/rejection/revision UI;
- deterministic relationship and proof projections plus tests.

## Contract and invariants

- agent-transcribed evidence starts `proposed`;
- only participant-confirmed evidence from an experiment belonging to the target hypothesis
  can support a revision;
- relation and strength never silently determine a verdict or confidence;
- accepted revisions preserve rationale, evidence refs, before/after confidence, and receipt.

## Required proof

- success: propose/confirm/reject evidence, propose verdict/revision, accept/edit/reject revision;
- denial: unconfirmed, rejected, unrelated, cross-hypothesis, wrong phase/lifecycle, stale,
  replay conflict, malformed input;
- browser: experiment -> confirmed evidence -> proposed revision -> accepted after-state;
- `npm run check`.

## Rollback or recovery

Use compensating commands for accepted local decisions. Preserve evidence and receipt history.

## Remaining unknowns

Human comprehension is participant proof, not established by fixtures or browser automation.

## Closeout receipt

- branch/SHA:
- dirty state:
- verified:
- unverified:
- disposition:
