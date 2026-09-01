# Destiny.AI — Project State

**Last updated:** 2026-09-01

- **Objective:** agent-native career-experiment workspace for a later OpenAI WebMCP Challenge
  window; primary goal = deep learning of coherent, safe, resource-efficient agentic product
  design.
- **Current authority:** `SPEC.md` (current product/system contract), `DECISIONS.md`
  (accepted choices), and `PLAN.md` (approved delivery programme; P1 admitted).
  `SYSTEM_REVIEW.md` is supporting evidence, not competing authority.
- **Canonical repo/worktree:** `/Users/harsh/career-lab`, branch `main`; foundation
  baseline `752ab8efc878b6a133a3be4bd74f94c5196b3631`. The Next.js app remains in `web/`.
  Original nested-repository history and dirty-overlay recovery are preserved at the path
  documented in `RECOVERY.md`; nothing was deleted.
- **GitHub remote:** `origin = https://github.com/SpaarxLab/destiny-ai.git`; private
  SpaarxLab repository; default branch `main`; Harsh has admin access. Remote candidate
  `aee041473064b2a476ef97e7ea85768d84d36f5f` was pushed successfully and passed GitHub
  Actions CI in run `33497218996`.
- **Phase:** P0A integrated; P0B admits product implementation. P1 Command Spine is active on
  `codex/p1-command-spine` with [PR #1](https://github.com/SpaarxLab/destiny-ai/pull/1)
  open against `main`. P2 Cold Orientation is active on dependency-closed branch
  `codex/p2-cold-orientation`, stacked on P1, and remains blocked from integration until P1
  merges. Participant testing remains blocked on reviewer approval and recruitment.
- **Owner:** Devarsh = Lane A (domain/commands/persistence); Tirth = Lane B (human
  board/collaboration); Harsh = product authority, integration captain, and Lane C
  (agent/evals/runtime).
- **Repository access:** `Devarsh009` and `Tirth262830` hold GitHub's `All-repository write`
  organization role for SpaarxLab. It covers every current and future organization repository
  without granting repository admin or organization-owner authority.
- **Next decision:** Harsh names the qualified safeguarding reviewer and records five adult
  participant commitments before participant testing.
- **Last verified evidence:** on P1 implementation commit
  `009b7f999c3b8b99740f465058bdedba6f403ca1` on `codex/p1-command-spine`, Node 24
  `web/npm run check` passed 9 focused
  command tests, ESLint, generated route types, TypeScript, and the Next.js production build.
  A local production-browser journey saved one participant reflection and rendered one
  `APPLIED` receipt with state version `0 -> 1`; browser error logs were empty. P0A remote CI
  evidence remains GitHub Actions run `33497218996`. This is local/static journey proof—not
  live WebMCP, deployed, participant, `main` integration, or submission proof.
- **Supersedes:** whiteboard sketches (red architecture / green 8-agent boards) and all
  pre-2026-09-01 brainstorm framings, including the original "student reflection + 7-day
  plan" MVP and the 8-internal-agents concept.
- **Documents:** README.md · PROJECT_STATE.md · DECISIONS.md · SPEC.md · PLAN.md · TEAM.md ·
  SAFETY_AND_PRIVACY.md · SYSTEM_REVIEW.md · METHOD.md · VOCABULARY.md · RECOVERY.md ·
  boards.html
