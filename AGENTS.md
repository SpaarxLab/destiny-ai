# Destiny.AI Agent Rules

These rules apply to the whole repository. `web/AGENTS.md` adds framework-specific rules.

## Read before action

1. `docs/STING.md` — the single design authority for the current build.
2. `docs/2026-09-03-sting-once-and-done.md` — the original STING brainstorm it grew from.
3. `web/AGENTS.md` — framework rules.

All earlier documents (SPEC, PROJECT_STATE, DECISIONS, PLAN, packets, evidence) were removed on
2026-09-03. They exist only in git history and are not current authority.

## Repository boundary

- The canonical repository root is `/Users/harsh/career-lab`.
- The Next.js application lives in `web/` and uses npm.
- Do not create another repository or worktree until `PROJECT_STATE.md` names its owner,
  outcome, and integration destination.
- Preserve unrelated dirty work. Never bulk-stage unknown changes.

## Product boundary

- UI and WebMCP must invoke the same command kernel.
- No adapter may write persistence directly or recreate policy.
- Every write requires `operationId` and `expectedVersion` and returns a receipt.
- Registration and tool annotations are discovery hints; commands enforce phase, lifecycle,
  evidence, and approval.
- Agent learning improves future proposals only. It never silently changes permissions.
- Only confirmed evidence can support a hypothesis revision.
- No agent-sent outreach, career prediction, therapy claim, or hidden memory.

## Packet discipline

- Work on one dependency-closed packet at a time.
- Each packet names owner, paths, prerequisites, tests, visible proof, rollback/recovery, and
  remaining unknowns.
- Contract changes update schemas, fixtures, `SPEC.md`, and the active packet together.
- Close with exact branch/SHA/dirty state and the highest proof actually observed.

## Verification

From `web/`, run `npm run check` before integration. Add focused contract, denial, replay,
and journey proof as the system grows. A passing local check is not live WebMCP, deployed,
participant, or submission proof.
