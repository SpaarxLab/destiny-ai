# Packet P0A — Canonical Foundation Baseline

**Status:** INTEGRATED
**Owner:** Harsh
**Branch/worktree:** `main` at `/Users/harsh/career-lab`
**Integration destination:** `main`

## Operator-visible outcome

The three-person team has one version-controlled authority containing the product contract,
team plan, operating rules, proof scaffolding, and Next.js application.

## Scope and owned paths

Repository metadata and foundation files only. No product implementation.

## Prerequisites

- current documents reviewed and reconciled;
- old nested repository resolved read-only;
- original HEAD and dirty overlay identified.

## Contract and invariants

- canonical root: `/Users/harsh/career-lab`;
- application: `web/`;
- package manager: npm;
- Node: 24;
- original nested history remains recoverable;
- no remote or license created without owner choice.

## Success and recovery proof

- root baseline commit: `752ab8efc878b6a133a3be4bd74f94c5196b3631`;
- original nested HEAD: `6290be40f4074a139b0e4bb021091d52a507d4e1`;
- verified complete bundle:
  `/Users/harsh/career-lab-recovery/2026-09-01-1535-web-scaffold/web-scaffold-6290be4.bundle`;
- original `.git` metadata and package overlay preserved beside the bundle;
- `cd web && npm run check` passed: ESLint, TypeScript, Next.js production build.

## Rollback or compensation

Follow `RECOVERY.md` to reconstruct the old nested repository in isolation. Do not replace
the active root repository without an explicit recovery decision.

## Dirty-state boundary

The original `web/package.json` and `web/package-lock.json` dependency additions were
intentionally admitted into the new baseline. No unrelated product edits existed.

## Remaining unknowns

Lane A, Lane B, safeguarding reviewer, participant commitments, and license/visibility remain
`OWNER INPUT` in `DECISIONS.md`.

## Closeout receipt

- verified: recovery bundle, root history, local CI-equivalent checks;
- unverified: GitHub CI, remote repository, live WebMCP, participant value;
- disposition: `INTEGRATE`.
