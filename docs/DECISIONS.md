# Destiny.AI — Decision Record

**Authority:** decisions D-001 through D-014 were selected under Harsh's 2026-09-01
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

### D-005 — Internal ship target (schedule superseded by D-013)

**Decision:** immutable internal candidate by **29 September 2026**, with a one-week
contingency ending **6 October 2026**. Enter the next official challenge window when announced;
do not let an unknown external date control foundation quality.

**Supersession:** the official challenge window is now known. D-013 controls the competition
schedule; the dates above remain historical only for the post-submission product programme.

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

### D-012 — Competition-first WebMCP path; embedded inference is optional (scope refined by D-013 and D-014)

**Decision:** the primary surface is a ChatGPT WebMCP experience built on the deterministic
command kernel. Every admitted human journey and visiting-agent journey must work without EVE,
AI SDK, OpenCode, a model API key, or any remote inference provider.

WebMCP work is split into three dependency-closed outcomes: P8A establishes feature detection,
registration, read tools, and a deterministic harness after P2; P8B exposes each admitted
product command and runs the agent-behaviour suite; P8C proves one immutable candidate in the
harness, Chrome, and ChatGPT in-app browser. P8A may run independently in Lane C while P3 runs
in Lane B. D-013 narrows P8B/P8C to the integrated P3 collaboration for the official deadline
and moves the full catalogue to P10.

AI SDK/OpenCode Go or EVE may be evaluated later as P9. D-014 supersedes the EVE portion: EVE now
requires a separate durable-orchestration decision and has no admitted packet. Proposal sources are
replaceable—never state, policy, permission, memory, approval, or a competition dependency. No participant
content may leave the local workspace until a separate data/retention decision is accepted.

**Why:** this protects the product's distinctive capability, keeps the competition path
testable without provider availability, and lets the team reach visible WebMCP work earlier
without opening a second authority or blocking the core lifecycle.

### D-013 — Deadline-sized competition slice; full lifecycle continues after submission

**Decision:** the official WebMCP Challenge submission deadline is **3 September 2026 at
1:00 p.m. Pacific / 4 September 2026 at 1:30 a.m. IST**. This external fact supersedes the
D-005 schedule and the D-012 assumption that the complete product lifecycle could precede
the competition candidate. D-005 remains historical context only.

The competition candidate is the smallest coherent collaboration already unlocked by the
integrated base plus P3:

`orient -> inspect exact reflection quotes -> propose a quote-backed hypothesis -> participant accepts, edits, or rejects -> visible receipt`

P8A establishes registration and bounded reads. P8B wraps only the integrated P3 hypothesis
collaboration and proves the deadline-sized catalogue. P8C freezes, deploys, opens the source,
records the under-three-minute video, and submits that exact candidate. P4 through P7 and P10
then complete the full experiment/evidence/revision product and WebMCP catalogue without
rewriting the competition slice.

**Why:** the official rules require a working live URL, public licensed repository,
under-three-minute public video, and coherent non-trivial WebMCP experience. Pretending P4
through P7 can safely integrate before the deadline would make the plan impossible. A narrow
human-agent hypothesis collaboration is truthful, useful, testable, and independently
shippable; the larger product remains the approved trajectory rather than a false submission
claim.

**Flow refinement:** D-014 supersedes the proposal/decision wording above with
`propose_route_set -> participant revise_route_set/choose_route -> accepted hypothesis + receipt`.
D-013's deadline and trust boundary remain current.

### D-014 — Destiny Journey, three-route reveal, and replaceable inference

**Decision:** the participant experience is a guided Destiny Journey with one focused question
per step, an early “shape of stuck” branch, editable confirmed quotes, and a Route Room shared by
the participant and ChatGPT. The first useful reveal is three equally weighted route previews:
Closest, Bridge, and Probe. Each route cites exact confirmed words, respects a current constraint,
names what it could teach, and contains a reversible test of seven days or less.

Route previews are explicit shared proposal state, not accepted hypotheses and not hidden UI-only
state. `propose_route_set` is a replay-safe `PROPOSE` command used by UI, ChatGPT, and any optional
inference source. It creates exactly three previews or returns `INSUFFICIENT_SIGNAL` with one focused
follow-up question. `revise_route_set` is participant-only and owns pre-choice edits, individual or
all-route rejection, and a receipt. A replacement proposal cites the set it supersedes.
`choose_route` is participant-only and is the single acceptance gate: it
atomically creates the accepted P3 hypothesis and receipt. The participant may edit before choosing
or reject previews; there is no duplicate confirmation step. This refines D-013's presentation and
candidate story without superseding its deadline, command authority, receipt, or no-prediction
boundaries.

ChatGPT in the WebMCP-capable browser is the primary reasoning surface. The deadline catalogue is
kept small: `read_workspace`, `get_method_guide`, and `propose_route_set`. `choose_route` remains a
participant UI command. Human-only mode provides a guided manual route workshop through the same
route-set command. The site remains fully usable without WebMCP or an inference provider.

AI SDK with OpenCode Go model `gpt-5.6-luna` is admitted only as a separate, disabled-by-default,
server-side, replaceable proposal-source experiment after the provider-free competition path is stable. It may
return typed route proposals but owns no persistence, policy, permission, approval, or memory.
P9 starts with synthetic fixtures; real participant content cannot leave the browser until a
separate consent, minimisation, retention, deletion, and provider-terms decision is accepted.
Provider failure must leave the human and visiting-ChatGPT paths intact. EVE is deferred: adopt it
only if a later accepted packet proves a need for scheduled, crash-resumable, long-running, or
multi-channel orchestration that the command ledger cannot provide.

**Why:** a linear technical flow hid the product's intelligence and made a meaningful capability
sound like form processing. Guided branching gives an immediate human win; three grounded routes
make AI synthesis visible; WebMCP lets ChatGPT change the same inspectable object the person sees;
and advancing only one selected route preserves a coherent authority model.

## Owner input still required before participant testing

1. `OWNER INPUT` — safeguarding reviewer name/role for distress copy.
2. `OWNER INPUT` — five participant IDs/recruitment commitments (do not store contact
   details here).
