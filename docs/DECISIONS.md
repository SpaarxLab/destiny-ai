# Destiny.AI — Decision Record

**Authority:** decisions D-001 through D-014 were selected under Harsh's 2026-09-01
instruction to apply the best defaults and complete foundation setup. Items marked
`OWNER INPUT` remain deliberately unresolved. D-015 through D-018 were explicitly accepted by Harsh.

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

### D-015 — Candidate v2: two chairs, one table

**Decision:** the competition candidate is rebuilt around one visible principle: the person and the
agent operate the same Route Room, every agent move is a receipted proposal, and the agent can only
replace what the person set aside. Contract version `1.2.0`, workspace schema `3`.

Admitted changes:

1. `propose_route_set` with `outcome: insufficient_signal` is now a receipted `PROPOSED` write. It
   creates one visible `FollowUpQuestion`; the participant answers it with `save_reflection` carrying
   `answersFollowUpRef` (a confirmed reflection the agent may quote) or skips it with the
   participant-only `skip_follow_up`. A routes proposal or a choice withdraws an open question in the
   same receipt. Only one question may be open.
2. A proposal may supersede a set that is still proposed only when the participant has set at least
   one route aside. Every kept route must be carried over unchanged through a `carryRouteRef` slot;
   the kernel copies it with a fresh ref and `carriedFromRouteRef`, preserving participant edits.
   Only the set-aside kinds may be replaced. This is the "replace only what I set aside" rule.
3. `set_limits` is a participant-only command with a receipt. Caps and the focus question never
   enter state through an initial snapshot. Limits cannot shrink below a proposed route.
4. `reopen_exploring` is a participant-only command that parks the accepted hypothesis and returns
   the workspace to `EXPLORING`, so a person can change their mind on one device with a receipt.
5. Agent affordances never advertise a tool that is not registered. `save_reflection` is no longer
   an agent action; agent transcription returns in P10 through a real tool.
6. The participant's answer boxes are declarative WebMCP forms (`draft_words`): an agent may fill
   the box, never submit it. This is the `PREPARE_UI` effect class made native to the browser.
7. The Route Room shows provenance, receipts, denials, the live capability line, an activity
   drawer built from the ledger, grounding highlights of quoted words, and a "see what the agent
   sees" panel that renders the exact orientation projection. Nothing the agent can read is hidden
   from the person; private notes are never readable by the agent.
8. An embedded lab assistant (AI SDK, any OpenAI-compatible endpoint including OpenCode Go) is
   admitted as a replaceable proposal source behind `LAB_ASSISTANT_PROVIDER`, disabled by default,
   server-side, with an explicit per-request consent sentence in the UI, deterministic grounding
   validation, and no persistence. Its proposals pass through the same kernel with
   `embedded_inference` provenance. Real participant content is sent only when the participant
   ticks the consent sentence for that request.
9. A visiting-agent simulator (AI SDK tool loop over the WebMCP catalogue) is admitted as eval
   tooling only. It never touches product state outside the harness.
10. Live proof is captured in real Chrome with the `enable-webmcp-testing` flag persisted in a
    temporary profile, driving `document.modelContext.getTools()` and `executeTool()` from
    Playwright. ChatGPT in-app browser proof remains a human step.

**Why:** the previous candidate could not reach the agent-proposal state from the shipped journey,
hid receipts and provenance from the person, and ended in a dead end. These changes make the
collaboration multi-turn, visible, repeatable on one device, and demonstrably governed, without
adding hidden memory, extra authorities, prediction, or outreach.

**Supersedes:** the P3/P8B assumption that `insufficient_signal` is non-mutating; the P8B rule that
denied every new proposal while an unresolved set remained (now: denied unless a route was set
aside and kept routes are carried); the initial-snapshot cap seeding in P3B.

### D-016 — The Deck becomes the opening experience

**Decision:** contract `2.0.0` and workspace schema `4` add `DECK` before `EXPLORING`. A fresh
participant receives concrete moment cards and sorts each with four gestures: `me`, `not_me`,
`wish`, or `used_to`. Only the participant can swipe. Agents may deal bounded cards and propose
evidence-backed tensions and a Portrait through the same command kernel used by the UI. Accepting a
Portrait opens the existing limits and Route Room flow; a route may cite an accepted tension instead
of an exact reflection quote.

The provider-free 36-card fixture deck is the complete baseline. Embedded Dealer, Reader, Skeptic,
and Route-maker roles are optional, disabled by default, consent-gated, server-only proposal
sources. Current OpenCode Go API model IDs and protocol families are `glm-5.3-flash`
(`/chat/completions`), `qwen3.8-flash` (`/messages`), `deepseek-v4-flash`
(`/chat/completions`), and `gpt-5.6-luna` (`/responses`). Provider output never bypasses schema,
quality checks, the command kernel, or participant gates.

WebMCP production registration uses the SDK. In `DECK`, the admitted visiting-agent writes are
`deal_cards`, `propose_tension`, `propose_portrait`, and `post_dealer_note`; swiping, settings, and
all resolution commands remain participant-only and are never registered. The orientation read is
`read-workspace/4.0.0` and the method guide is `destiny-method/3.0.0`.

**Why:** the opening card interaction earns meaningful evidence quickly, makes agent contribution
visible without surrendering authority, and creates a tactile bridge into the more deliberate Route
Room. The fixture baseline preserves availability, privacy, and demo reliability.

**Supersedes:** D-015's onboarding as the first useful moment, contract `1.2.0`, schema `3`, and the
deadline catalogue being limited to route proposals. D-015's shared-kernel, receipt, participant
gate, replace-only-what-was-set-aside, no-prediction, and recovery boundaries remain current.

### D-017 — ChatGPT A/B Tests Your Future

**Decision:** Convert the connected candidate into a ChatGPT-only WebMCP experience. ChatGPT is the
only intelligence; Destiny is the versioned instrument. Preserve the shared command kernel,
workspace persistence, operation IDs, replay, receipts, participant authority, evidence refs,
tension lifecycle and exactly-three-route selective repair. Reuse moment, duel, reversal and
falsification cards as the three public probe templates: moment, forced tradeoff and variable
isolation.

The public catalogue is exactly six tools: `inspect_room`, `stage_probe`, `propose_hypothesis`,
`present_evidence`, `stage_route_auditions`, and `propose_experiment`. Participant response,
hypothesis resolution, limits, evidence confirmation, route choice and commitment remain webpage
actions only. Connected mode runs no fixture or embedded inference and presents no second chatbot.

The pending `run_probe` rendezvous remains a tested spike, but the admitted protocol is the
recoverable `stage_probe -> participant webpage response -> inspect_room` fallback until a real
ChatGPT in-app-browser run proves that the participant can interact while a tool call is pending.
Route auditions are denied in the kernel until a participant-settled counterexample exists and
ChatGPT has visibly strengthened, weakened or replaced the hypothesis. Evidence presentation is
transient and non-mutating.

**Supersedes:** D-016's multi-chair connected presentation, automatic fixture/embedded Reader flow,
16-card target and Portrait gate. It does not supersede D-016's card and tension contracts or
D-014/D-015's shared-kernel, route authority, receipts and selective-repair rules.

### D-018 — One decision at a time

**Decision:** Keep D-017's ChatGPT-only orchestration and six-tool catalogue, but remove the
protocol-first participant presentation. A visible probe has four explicit reaction buttons. A
reason is optional and can only annotate the reaction the participant already chose; nothing may
default to `me`. The primary surface shows the situation, the current human decision and readable
evidence. Raw operation names, versions, receipts, JSON and timings live under optional technical
details. Time and money limits appear only when ChatGPT is ready to propose a reversible experiment.

Connected mode does not call OpenCode Go or any embedded model. ChatGPT is the external intelligence
acting through WebMCP; Destiny therefore reports zero application-side model calls and does not
invent provider-side token telemetry it cannot observe.

**Supersedes:** P13's ambiguous drag/flip interaction, click-first default reaction and always-visible
protocol/limits wallpaper. It does not supersede D-017's shared kernel, receipts, recovery,
falsification, participant authority, route repair or real ChatGPT-IAB proof gate.

## Owner input still required before participant testing

1. `OWNER INPUT` — safeguarding reviewer name/role for distress copy.
2. `OWNER INPUT` — five participant IDs/recruitment commitments (do not store contact
   details here).
