# Destiny.AI — Project State

**Last updated:** 2026-09-01

- **Objective:** agent-native career-experiment workspace for a later OpenAI WebMCP Challenge
  window; primary goal = deep learning of coherent, safe, resource-efficient agentic product
  design.
- **Current authority:** `SPEC.md` (current product/system contract), `DECISIONS.md`
  (accepted choices), and `PLAN.md` (approved delivery programme; P1 admitted).
  `SYSTEM_REVIEW.md` is supporting evidence, not competing authority.
- **Canonical repo/worktree:** `/Users/harsh/career-lab`; integration branch `main`; active P1
  branch `codex/p1-command-spine`; foundation
  baseline `752ab8efc878b6a133a3be4bd74f94c5196b3631`. The Next.js app remains in `web/`.
  Original nested-repository history and dirty-overlay recovery are preserved at the path
  documented in `RECOVERY.md`; nothing was deleted.
- **GitHub remote:** `origin = https://github.com/SpaarxLab/destiny-ai.git`; private
  SpaarxLab repository; default branch `main`; Harsh has admin access. Remote candidate
  `aee041473064b2a476ef97e7ea85768d84d36f5f` was pushed successfully and passed GitHub
  Actions CI in run `33497218996`.
- **Phase:** P0A integrated; P0B admits product implementation. P1 Command Spine is active on
  `codex/p1-command-spine` with [PR #1](https://github.com/SpaarxLab/destiny-ai/pull/1)
  open against `main`. The Linear board contains all eight dependency-closed packets: P1 is
  `In Progress` with a 4 September due date; P2-P8 remain `Backlog` until their prerequisites
  are integrated. Participant testing remains blocked on reviewer approval and recruitment.
- **Owner:** Devarsh = Lane A (domain/commands/persistence); Tirth = Lane B (human
  board/collaboration); Harsh = product authority, integration captain, and Lane C
  (agent/evals/runtime).
- **Repository access:** `Devarsh009` and `Tirth262830` hold GitHub's `All-repository write`
  organization role for SpaarxLab. It covers every current and future organization repository
  without granting repository admin or organization-owner authority.
- **Delivery integration:** Linear's `Linear Code` GitHub App is connected to the SpaarxLab
  organization with read/write code, issue, pull-request, workflow, and action access across
  all current and future organization repositories. Linear readback shows `SpaarxLab` as a
  connected organization, enabled by Harsh on 2026-09-01.
- **Linear roles:** Devarsh, Tirth, and Harsh remain workspace admins because this is a Free
  workspace and Linear makes every user an admin on that plan. Reducing Devarsh and Tirth to
  members requires an explicitly approved paid-plan upgrade; no upgrade has been authorized.
- **Delivery board:** [Destiny.AI — Build & Proof](https://linear.app/harsh-shah/project/destinyai-build-and-proof-5987c83d1c4c/overview)
  in the SpaarxLab Linear team. `docs/LINEAR_WORKBOARD.md` is the repository-side issue,
  milestone, owner, dependency, and workflow receipt. Repository documents remain product
  authority; Linear indexes execution and evidence.
- **Next decision:** Harsh names the qualified safeguarding reviewer and records five adult
  participant commitments before participant testing. Separately, Harsh must choose whether
  to keep Linear Free with all three users as admins or authorize a paid upgrade so Devarsh
  and Tirth can become members.
- **Last verified evidence:** on P1 hardening commit
  `9ad1883b33e4c65153acacde6ac1a8df747a5262` on `codex/p1-command-spine`, Node 24
  `web/npm run check` passed 12 focused
  command and storage tests, ESLint, generated route types, TypeScript, and the Next.js
  production build. Cross-tab writes are serialized and an absent workspace read no longer
  creates an unreceipted bootstrap write.
  A local production-browser journey saved one participant reflection and rendered one
  `APPLIED` receipt with state version `0 -> 1`; browser error logs were empty. P0A remote CI
  evidence remains GitHub Actions run `33497218996`. This is local/static journey proof—not
  live WebMCP, deployed, participant, `main` integration, or submission proof.
- **Supersedes:** whiteboard sketches (red architecture / green 8-agent boards) and all
  pre-2026-09-01 brainstorm framings, including the original "student reflection + 7-day
  plan" MVP and the 8-internal-agents concept.
- **Documents:** README.md · PROJECT_STATE.md · DECISIONS.md · SPEC.md · PLAN.md · TEAM.md ·
  SAFETY_AND_PRIVACY.md · SYSTEM_REVIEW.md · METHOD.md · VOCABULARY.md · RECOVERY.md ·
  docs/LINEAR_WORKBOARD.md · boards.html
