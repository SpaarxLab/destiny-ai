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
- private development remote: `https://github.com/SpaarxLab/destiny-ai`;
- no public release or license file before the release-readiness decision.

## Success and recovery proof

- root baseline commit: `752ab8efc878b6a133a3be4bd74f94c5196b3631`;
- original nested HEAD: `6290be40f4074a139b0e4bb021091d52a507d4e1`;
- verified complete bundle:
  `/Users/harsh/career-lab-recovery/2026-09-01-1535-web-scaffold/web-scaffold-6290be4.bundle`;
- original `.git` metadata and package overlay preserved beside the bundle;
- `cd web && npm run check` passed: ESLint, generated route types, TypeScript, and Next.js
  production build;
- GitHub Actions run `33497021144` passed on exact candidate
  `76e8dbd59743eaaaf8c1b48c4dfdc7f46d514c44`.

## Rollback or compensation

Follow `docs/archive/2026-09-01-foundation/RECOVERY.md` to reconstruct the old nested repository in isolation. Do not replace
the active root repository without an explicit recovery decision.

## Dirty-state boundary

The original `web/package.json` and `web/package-lock.json` dependency additions were
intentionally admitted into the new baseline. No unrelated product edits existed.

## Remaining unknowns

Lane A, Lane B, and private-development visibility were resolved in P0B. The safeguarding
reviewer and participant commitments remain `OWNER INPUT` before research.

## Closeout receipt

- verified: recovery bundle, root history, private remote, local checks, clean GitHub CI;
- unverified: live WebMCP, deployment, safeguarding approval, participant value;
- disposition: `INTEGRATE`.
