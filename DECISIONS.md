# Destiny.AI — Decision Record

**Authority:** decisions D-001 through D-009 were selected under Harsh's 2026-09-01
instruction to apply the best defaults and complete foundation setup. Items marked
`OWNER INPUT` remain deliberately unresolved.

## Accepted decisions

### D-001 — One repository root

**Decision:** `/Users/harsh/career-lab` is the canonical Git repository. The Next.js
application remains in `web/`; plans, proof, research, and code share one history.

**Why:** a three-person team needs one review, integration, and rollback boundary. Flattening
the app into the root would add churn without product value.

### D-002 — Runtime and package manager

**Decision:** Node 24, npm, Next.js App Router, TypeScript strict mode.

**Why:** this matches the verified local runtime and current lockfile. Switching package
managers would create noise. Next.js 16 requires Node >=20.9.

### D-003 — Local-first candidate

**Decision:** one schema-versioned local workspace through the entire challenge candidate.
No auth, database, sync, analytics, or remote career-content storage in MVP.

**Why:** it keeps one authority, improves privacy, and focuses learning on agent control,
human collaboration, receipts, and recovery. Server persistence is a separate post-MVP
architecture packet.

### D-004 — Adult participant boundary

**Decision:** recruit adults aged 18+ only for MVP research and demos.

**Why:** the product touches uncertainty and distress. Minor-specific consent and safeguarding
would be a separate, expert-reviewed product profile.

### D-005 — Internal ship target

**Decision:** immutable internal candidate by **29 September 2026**, with a one-week
contingency ending **6 October 2026**. Enter the next official challenge window when announced;
do not let an unknown external date control foundation quality.

### D-006 — Team shape

**Decision:** three stable lanes. Devarsh owns Lane A (Domain, Commands, Persistence);
Tirth owns Lane B (Human Board, Collaboration); Harsh owns Lane C (Agent Surface, Evals,
Runtime Proof) and is integration captain/product authority.

**Why:** Harsh's learning goal is agentic product design. One integration captain prevents
contract drift; lane ownership prevents shared-file chaos.

### D-007 — Research and proof

**Decision:** target five adult participants using pseudonymous IDs and no contact details in
the repository. Three participants must validate the solo board before agent polish; five
complete the candidate study if recruitment succeeds. Report actual counts honestly.

### D-008 — Safeguarding gate

**Decision:** use the recommended qualified safeguarding reviewer. Harsh will secure and name
that reviewer before participant sessions. Product implementation may start; participant
testing remains blocked until the reviewer approves the distress copy.

### D-009 — Repository visibility and license (ownership amended by D-010)

**Original decision:** create a private GitHub repository under `harsh41099` for team
development. The personal-account ownership portion is superseded by D-010. The visibility
and release-gate portion remains current: before submission, complete source-ownership,
secret, participant-data, and candidate review; then add the MIT license and make the
repository public.

No license is granted and the repository remains private until that release gate.

**Historical implementation:** `harsh41099/destiny-ai` was created private, then transferred
to the SpaarxLab organization under D-010.

### D-010 — Repository organization authority (access amended by D-011)

**Decision:** SpaarxLab, not Harsh's personal account, owns the canonical Destiny.AI
repository. Keep Harsh as repository admin. The original per-repository collaborator plan is
superseded by D-011.

**Implemented:** [`SpaarxLab/destiny-ai`](https://github.com/SpaarxLab/destiny-ai) is private
with `main` as the default branch. The transfer preserved repository history and GitHub
Actions history.

### D-011 — Team-wide repository access

**Decision:** grant Devarsh and Tirth write access to every current and future SpaarxLab
repository through GitHub's predefined `All-repository write` organization role. Do not
broaden the base permission for unrelated or future organization members, and do not grant
repository-admin or organization-owner authority.

**Implemented:** `Devarsh009` and `Tirth262830` were assigned the role on 2026-09-01. GitHub
confirmed both assignments in the SpaarxLab organization-role readback.

## Owner input still required before participant testing

1. `OWNER INPUT` — safeguarding reviewer name/role for distress copy.
2. `OWNER INPUT` — five participant IDs/recruitment commitments (do not store contact
   details here).
