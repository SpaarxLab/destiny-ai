# Destiny.AI — Linear Workboard Receipt

**Verified:** 2026-09-01  
**Project:** [Destiny.AI — Build & Proof](https://linear.app/harsh-shah/project/destinyai-build-and-proof-5987c83d1c4c/overview)  
**Team:** SpaarxLab (`SPX`)  
**Candidate target:** 2026-09-29

## Authority boundary

`PROJECT_STATE.md`, `SPEC.md`, `DECISIONS.md`, and `PLAN.md` define current product and
delivery authority. Linear records commitments, owners, sequencing, blockers, and evidence;
it does not silently change the contract. If a ticket conflicts with an authority document,
stop and ask Harsh to resolve the conflict before implementation.

## Milestones and allocated packets

| Milestone | Target | Ticket | Owner | Status | Dependency |
|---|---:|---|---|---|---|
| M1 — Truth & command spine | Sep 8 | [SPX-1 — P1 Build the shared command spine](https://linear.app/harsh-shah/issue/SPX-1/p1-build-the-shared-command-spine) | Devarsh | In Progress; due Sep 4 | P0B admitted |
| M1 — Truth & command spine | Sep 8 | [SPX-2 — P2 Deliver cold-agent orientation](https://linear.app/harsh-shah/issue/SPX-2/p2-deliver-cold-agent-orientation) | Devarsh | Backlog | SPX-1 |
| M2 — Human-agent collaboration | Sep 15 | [SPX-3 — P3 Build quote-backed hypothesis collaboration](https://linear.app/harsh-shah/issue/SPX-3/p3-build-quote-backed-hypothesis-collaboration) | Tirth | Backlog | SPX-2 |
| M2 — Human-agent collaboration | Sep 15 | [SPX-4 — P4 Build the cost-capped experiment loop](https://linear.app/harsh-shah/issue/SPX-4/p4-build-the-cost-capped-experiment-loop) | Devarsh | Backlog | SPX-3 |
| M3 — Evidence & accretion | Sep 22 | [SPX-5 — P5 Prove evidence-bound confidence revision](https://linear.app/harsh-shah/issue/SPX-5/p5-prove-evidence-bound-confidence-revision) | Devarsh | Backlog | SPX-4 |
| M3 — Evidence & accretion | Sep 22 | [SPX-6 — P6 Make human corrections accretive without widening authority](https://linear.app/harsh-shah/issue/SPX-6/p6-make-human-corrections-accretive-without-widening-authority) | Harsh | Backlog | SPX-5 |
| M4 — Polish, runtime & proof | Sep 29 | [SPX-7 — P7 Complete and visually harden the participant workspace](https://linear.app/harsh-shah/issue/SPX-7/p7-complete-and-visually-harden-the-participant-workspace) | Tirth | Backlog | SPX-5; coordinate with SPX-6 |
| M4 — Polish, runtime & proof | Sep 29 | [SPX-8 — P8 Prove WebMCP runtime and release candidate](https://linear.app/harsh-shah/issue/SPX-8/p8-prove-webmcp-runtime-and-release-candidate) | Harsh | Backlog | SPX-6 and SPX-7 |

Verified board balance: eight packets; two per milestone; Devarsh owns four, Tirth two, and
Harsh two. Only SPX-1 is `In Progress`; dependent packets remain in `Backlog` so work cannot
outrun the command-spine contract. Linear records the start signal, but no P1 implementation
SHA, test receipt, or pull request has been verified yet.

Native Linear blocker relationships mirror the plan: SPX-2 is blocked by SPX-1; SPX-3 by
SPX-2; SPX-4 by SPX-3; SPX-5 by SPX-4; SPX-6 and SPX-7 by SPX-5; and SPX-8 by both SPX-6
and SPX-7.

## Human and agent workflow

1. Start from the assigned Linear ticket; read `AGENTS.md`, `PROJECT_STATE.md`, `SPEC.md`,
   `PLAN.md`, and the ticket's authority section.
2. Confirm the prerequisite ticket is admitted or complete. Do not infer admission from a
   local implementation, draft, or newer-looking document.
3. Use one packet branch and one writable worktree. Put the `SPX-N` identifier in the branch,
   commits, and pull request.
4. Work only in the ticket's owned paths. Ask before changing another lane's contract or
   authority surface.
5. Exercise writes through the shared command kernel. UI and WebMCP adapters may not mutate
   domain state directly or reproduce policy.
6. Prove the ticket's required success, denial, stale-state, replay, recovery, and receipt
   behavior as applicable. Attach exact SHA, commands, CI, screenshots/traces, and remaining
   gates to the Linear ticket or pull request.
7. Move a packet to `In Progress` only when work actually starts. Move it to `Done` only after
   Harsh verifies CI plus the required human/browser/runtime proof on the exact candidate.
8. Admit the next dependency only after its upstream contract and fixtures are stable.

## Proof classes

Keep local, CI, deployed, runtime, participant, submission, and production proof separate.
A passing local build or browser walkthrough does not prove a live WebMCP runtime, participant
usefulness, production readiness, or challenge submission readiness.

Participant sessions remain blocked until a qualified safeguarding reviewer approves the
distress/referral copy and five adult commitments are recorded.

## Still-unconfigured integrations

The Linear GitHub integration is intentionally not installed by this receipt. Installing it
changes external access scope and requires an explicit repository-scope decision. Devarsh and
Tirth also remain Linear workspace admins until Harsh explicitly chooses whether to reduce
them to members; ticket ownership does not require admin access.
