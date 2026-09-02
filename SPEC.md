# Destiny.AI — Product and System Contract

**Status:** Current product/technical authority, revised for ChatGPT A/B Tests Your Future (D-018).
**Contract version:** `2.0.0` · **Workspace schema:** `4` · **Read contract:** `read-workspace/4.0.0` ·
**Method guide:** `destiny-method/3.0.0`.
**Build admission:** P1, P2, P3A, P3B, P3C, and P8A are integrated on `main`; P8B is committed on
`codex/spx-10-p8b`; candidate v2 (P11) is integrated on `main`; The Deck is built through P12 on
`codex/spx-32-deck`. Participant research remains reviewer- and recruitment-gated.
**Supersedes:** the original Destiny.AI brainstorm, the red/green whiteboards, the eight
internal-agent concept, the pre-review architecture in this file, and the contract 1.1.0 rules that
D-015 lists as superseded.
**Review receipt:** `docs/archive/2026-09-01-foundation/SYSTEM_REVIEW.md`.

## 1. Product promise

**ChatGPT A/B Tests Your Future:** ChatGPT is the only intelligence conducting the connected
experience. Destiny is the stateful, versioned interactive instrument ChatGPT operates through
WebMCP. The participant responds exclusively on the webpage. They leave knowing what to test next
and why, not with a career prediction.

The connected loop is:

`inspect evidence -> stage probe -> participant responds -> inspect receipt -> propose hypothesis -> challenge it -> visibly revise it -> present both sides -> stage three route auditions -> recommend one reversible experiment`

The public catalogue is exactly `inspect_room`, `stage_probe`, `propose_hypothesis`,
`present_evidence`, `stage_route_auditions`, and `propose_experiment`. The rendezvous spike remains
test evidence; the admitted protocol is the recoverable two-call fallback because pending-tool
interaction has not been proven in the real ChatGPT in-app browser.

The earlier guided Destiny Journey remains an internal development path and fixture source. It is
not the connected competition experience and must not appear as a competing autonomous mode.

**Thesis:** direction is not predicted and is not found through endless introspection. It is
reduced through small, reversible experiments against the real world. The agent is a lab
assistant; the participant owns the question, approvals, evidence, and real-world action.

**Two chairs, one table (D-015, narrowed by D-017):** the person and ChatGPT operate the same Route Room. Every agent
move is a receipted proposal the person can see. The agent may ask one question before it guesses,
and it may replace only what the person set aside.

The superseded P12 session was:

`16 moment-card swipes -> evidence-backed tensions -> participant-approved Portrait -> limits -> three route previews -> choose one to test`

The current session uses no more than five bounded probes and no Portrait gate. Existing moment,
duel, reversal, falsification, tension, route-set, replay, receipt, and selective-repair contracts
remain the internal implementation authority.

The smallest complete learning loop is:

`confusion -> reflection -> hypothesis ghost -> experiment ghost -> confirmed evidence -> revision ghost`

## 2. Binding invariants

1. **We do not require an embedded reasoning agent.** A browser agent visits. Destiny.AI
   supplies the workspace, governed capabilities, method, and proof. Every candidate
   must work without EVE, AI SDK, OpenCode, a model API key, or any remote inference service.
2. **One state authority.** The MVP workspace is one versioned local document. UI and WebMCP
   invoke the same command kernel; neither writes storage directly.
3. **The Route Room is the shared object.** Agent-visible facts are inspectable by the participant.
   Compact summaries are derived projections with provenance, never a hidden second memory. The
   participant can open the exact projection the agent reads ("See what ChatGPT sees").
4. **Propose before consequence.** Agent hypotheses, follow-up questions, experiments, evidence
   transcriptions, verdicts, and confidence revisions require human acceptance.
5. **Schemas are one policy layer, not the whole policy.** Bounded schemas reject malformed
   inputs; the command kernel also enforces current phase, lifecycle, versions, and approval.
6. **The catalogue is stable; execution remains phase-governed.** The connected page registers the
   six public tools throughout the session. `inspect_room.callableAgentActions` narrows the valid
   next moves, and the kernel re-checks every invocation because agents can cache catalogues and
   pages can race.
7. **Every write is replay-safe.** It requires `operationId` and `expectedVersion`. Reusing
   the same operation id returns the original receipt; it never repeats the effect.
8. **Success has a receipt.** A write reports the authoritative before/after version, changed
   references, effect status, and next available actions.
9. **Undo preserves truth.** Undo is a compensating operation. Receipts and evidence history
   are never erased. External sends remain human-only and outside the tool catalogue.
10. **Accretion improves judgment, never authority.** Human corrections can shape future
    proposals. They cannot silently unlock tools, loosen caps, or approve actions.
11. **Not therapy and not prediction.** The product offers structured self-direction practice.
    It does not diagnose, treat distress, or claim a correct career.
12. **Anything equally good in plain chat is removed.** The differentiator is shared state,
    governed action, human collaboration, and verified after-state.
13. **The agent replaces only what the person set aside.** A proposal may supersede a live set
    only when at least one route is set aside, and every kept route must be carried over unchanged.
14. **Agent affordances never advertise an unregistered tool.** Every `availableActions` entry with
    `actor: 'agent'` names a tool the page registers in that state.
15. **Only the participant swipes.** No imperative or declarative WebMCP tool may expose
    `swipe_card`, and a cached agent invocation is denied by the kernel with `NO_SWIPE_TOOL`.
16. **Embedded roles are optional proposal sources.** The fixture Deck remains complete with no
    credentials. Consent defaults off; provider output is schema-checked, quality-checked, then
    submitted through the same kernel and participant gates.
17. **Connected mode has one intelligence.** When WebMCP is attached, fixtures and embedded role
    inference do not run, no hidden proposal is created, and every visible agent action is ChatGPT.
18. **Falsification is mandatory.** Route auditions are kernel-denied with
    `COUNTEREVIDENCE_REQUIRED` until a participant responds to a hypothesis-targeted reversal or
    variable-isolation probe. ChatGPT must then visibly strengthen, weaken, or replace its claim.
19. **Evidence presentation is transient.** `present_evidence` may focus cited receipts but cannot
    mutate evidence, limits, hypotheses, routes, or participant decisions.
20. **A reaction is explicit.** The participant chooses `That's me`, `Not me`, `I wish`, or `I used
    to` before choosing or skipping a reason. No click, reason, drag, timeout or default may infer a
    reaction. The selected reaction remains visible until its receipted write succeeds.
21. **Protocol is inspectable, not the product voice.** The primary surface uses plain participant
    language and one active decision. Tool names, versions, raw receipts, JSON and timings remain
    available under optional technical details. Limits appear only when the participant is bounding
    a proposed reversible experiment.

## 3. Scope

### MVP

- one local participant workspace;
- a responsive ChatGPT-conducted probe table with moment, forced-tradeoff and variable-isolation
  templates backed by existing moment, duel, reversal and falsification cards;
- no conventional questionnaire, embedded chatbot, Portrait gate, or fake multi-agent theatre;
- contextual participant limits, privacy notice, start over, receipts and recovery;
- one bounded three-route proposal containing Closest, Bridge, and Probe previews, or one receipted
  follow-up question when the words are too thin;
- replacement of set-aside routes with kept routes carried over;
- reflections, follow-up questions, route sets, hypotheses, receipts, activity;
- human-only phase gates, limits, choice, reopening, and real-world sends;
- the six-tool ChatGPT WebMCP catalogue, typed outcomes, receipts and bounded `inspect_room`;
- deterministic fixtures, command tests, browser journeys, real-Chrome runtime proof, provider-off
  inference and simulator evals;
- a complete no-provider baseline: the human journey and visiting-agent WebMCP journey work
  without embedded inference credentials.

### Deferred

- experiments, evidence, revisions, week plan, outbox, teachings (P4-P7);
- import with preview (export exists; import is deferred);
- authentication, server database, multi-person workspaces, sync, background agents;
- resource/opportunity search, portfolio generation, embedded chatbot, Gmail/Calendar;
- a career knowledge store, internal reflection/plan agents, automatic nudges;
- automatic model-written taste summaries that become active without review;
- durable frameworks such as EVE, evaluated only after a proven orchestration need; neither may
  become state authority.

### Rejected

- career prediction, therapy positioning, clinical intervention, agent-sent outreach;
- eight internal agents presented as architecture;
- automatic permission earning or any second mutation path.

## 4. Current runtime facts

- OpenAI describes the challenge as an app that becomes meaningfully better when people and
  agents use it together, and says ChatGPT's in-app browser supports WebMCP.
- The current community-group draft exposes imperative tools through
  `document.modelContext.registerTool()` and lists them through `getTools()`; agents invoke them
  through `executeTool()`; the list changes fire `toolchange`.
- Chrome documents an experimental origin trial beginning in Chrome 149 and the
  `#enable-webmcp-testing` flag. This is experimental and may drift.
- Verified on this machine in Chrome 152 with that flag persisted in a throwaway profile:
  `document.modelContext` exists with `registerTool`, `getTools`, `executeTool`, and
  `ontoolchange`; `executeTool` returns our structured results serialised as JSON strings;
  `getTools` lists tools alphabetically and echoes `annotations`; a `<form toolname>` with
  `toolautosubmit` is synthesised as a tool whose input schema mirrors the named fields, and its
  submit handler must answer through `event.respondWith()`.
- The implementation feature-detects the runtime, isolates compatibility behavior in one adapter,
  and retains a deterministic in-page test harness. A passing harness is not live ChatGPT proof.

Primary sources:
[OpenAI challenge](https://openai.com/webmcp-challenge/) ·
[WebMCP draft](https://github.com/webmachinelearning/webmcp) ·
[Chrome origin trial](https://developer.chrome.com/blog/ai-webmcp-origin-trial)

## 5. The system as a tower of linked abstractions

Each layer depends only on the layer below. An agent should be able to understand the entire
system by walking this table top to bottom.

| Layer | Owns | Must not own |
|---|---|---|
| Product method | what a good career experiment is | permissions or persistence |
| Human-agent journey | phases, gates, pending collaboration | direct storage writes |
| Agent control surface | orientation, affordances, tools, errors | domain rules |
| UI and WebMCP adapters | translation to/from commands | a second command implementation |
| Command kernel | validation, policy, lifecycle, idempotency, compensation | presentation |
| Workspace authority | current snapshot, operation receipts, schema migrations | model reasoning |
| Proof system | fixtures, replays, journey/runtime receipts | product claims without evidence |

The concrete control flow is:

```text
participant UI ─┐
                ├─> command kernel -> validate -> apply once -> workspace + receipt
WebMCP tool ────┤                          │
embedded lab ───┘                          ├─> UI renders authoritative after-state
assistant (optional)                       └─> agent receives result + next actions

workspace + receipts -> deterministic orientation projection -> read_workspace
human feedback       -> sourced teachings (P6) ---------------^
```

The WebMCP registry is an adapter. It exposes product-owned commands; it is never an
independent domain, permission system, or ledger.

Two pieces sit outside the tower and can be removed without touching it:

- **Embedded lab assistant** (`web/src/inference/`, `web/src/app/api/lab-assistant/`): a
  server-side, replaceable proposal source behind `LAB_ASSISTANT_PROVIDER` (default `disabled`).
  It receives a bounded projection (confirmed words, limits, what may be replaced), returns a typed
  draft that a deterministic grounding validator has already checked, and never persists, logs
  participant text, or calls the kernel. The browser submits any returned draft through the same
  `propose_route_set` command with `embedded_inference` provenance, and only after the participant
  ticks the consent sentence for that request.
- **Visiting-agent simulator** (`web/src/inference/agent-simulator.ts`): an AI SDK tool loop whose
  only tools wrap an injected catalogue. It exists for evals and never runs against product state
  outside the harness.

## 6. Journey and authority

| Phase | Discoverable agent tools | Human-only gate |
|---|---|---|
| all phases | `read_workspace`, `get_method_guide` | — |
| `DECK` | `deal_cards`, `propose_tension`, `propose_portrait`, `post_dealer_note` | `swipe_card`, settings, all tension/Portrait decisions |
| `EXPLORING` before words are confirmed | `draft_words` (declarative form on answer screens) | Participant confirms words and `set_limits` |
| `EXPLORING` with confirmed words | `propose_route_set` when `proposal.available` | Participant answers or skips a follow-up, then `revise_route_set` / `choose_route` |
| `TESTING` | none | `reopen_exploring` parks the hypothesis and returns to `EXPLORING` |
| `REVIEWING` | `propose_hypothesis_revision`, `propose_verdict` (P5) | Accept revision or re-explore |

Registration helps an agent discover what is relevant. The command kernel is authoritative:
it rejects wrong-phase, wrong-actor, wrong-resource, stale, replay-conflict, and unconfirmed-evidence
use.

Agent work has three effect classes:

- `READ`: no mutation;
- `PREPARE_UI`: open a bounded interaction and return `AWAITING_HUMAN`;
- `PROPOSE`: create a visible ghost requiring participant action.

Direct committed mutations are reserved for explicit participant UI commands and internal
bookkeeping performed atomically with an accepted command.

**Participant commands** (`web/src/domain/commands.ts`, all replay-safe, all receipted):

- `save_reflection` confirms the participant's words; with `answersFollowUpRef` it also marks an
  open follow-up question `answered` in the same receipt.
- `set_limits` records `costCaps` (hours per week, money, three-letter currency) and optionally the
  focus question. Limits never enter state through an initial snapshot. It is denied while a
  proposed route's test would exceed the new limits.
- `revise_route_set` owns bounded pre-choice edits and individual or all-route rejection.
  Rejecting all routes resolves the set without creating a hypothesis.
- `choose_route` is the single acceptance gate. It may include final edits, atomically creates the
  accepted hypothesis and receipt, withdraws any open follow-up, and moves the phase to `TESTING`.
- `compensate_route_set` resolves an untouched proposal as a compensating operation.
- `skip_follow_up` marks an open follow-up question `skipped`.
- `reopen_exploring` parks the accepted hypothesis and returns to `EXPLORING`; the next proposal
  must cite the resolved set as its predecessor.

**Agent commands:**

- `propose_route_set` is a replay-safe `PROPOSE` command shared by the participant UI, the WebMCP
  adapter, and the optional embedded assistant. Its input is either
  `{ outcome: 'routes', routes: [slot, slot, slot], supersedesRouteSetRef? }` where each slot is a
  full `RouteProposalInput` or `{ carryRouteRef }`, or
  `{ outcome: 'insufficient_signal', followUpQuestion, reasonRefs }`.
- `insufficient_signal` is a receipted `PROPOSED` write. It creates one visible `FollowUpQuestion`
  and returns `data.followUp` with a receipt. It is denied while a route set is proposed or another
  question is open, and it is agent-only. A later routes proposal or choice withdraws an open
  question in the same receipt.
- A routes proposal must cite the latest route set as `supersedesRouteSetRef` when any exists.
  Superseding a set that is still proposed is allowed only when the participant has set at least
  one route aside: every kept route must appear as `{ carryRouteRef }`, the kernel copies it with a
  fresh ref and `carriedFromRouteRef` preserving its status and edits, and the fresh routes must
  cover exactly the set-aside kinds. Superseding a resolved (all-rejected or reopened) set takes
  three fresh routes. The older set stays in history as `superseded` or `resolved`.
- `draft_words` is a declarative WebMCP form tool on the answer, confirm, and follow-up screens. The
  browser synthesises it from the participant's own `<form>`. When an agent executes it, the text is
  staged into the participant's box and the form answers `AWAITING_HUMAN` through `respondWith`;
  nothing is saved until the participant confirms. It is the `PREPARE_UI` class made native.

## 7. Canonical nouns and data

Internal identity and agent legibility are separate:

- `id`: stable opaque internal identity;
- `ref`: short unique human/agent reference such as `reflection-3`, `route-set-4`,
  `route-closest-a1`, `question-5`, `hypothesis-7`, `operation-4`;
- display title: editable participant-facing text.

```ts
type Phase = 'EXPLORING' | 'TESTING' | 'REVIEWING';
type GhostStatus = 'proposed' | 'accepted' | 'rejected' | 'superseded';
type ProposalSource = 'chatgpt_webmcp' | 'participant' | 'embedded_inference';

interface Workspace {
  id: string;
  schemaVersion: 3;
  contractVersion: '1.2.0';
  stateVersion: number;
  phase: Phase;
  participant: {
    displayName: string;
    focusQuestion: string;
    costCaps: { hoursPerWeek: number; money: number; currency: string };
  };
  reflections: Reflection[];
  followUpQuestions: FollowUpQuestion[];
  routeProposalSets: RouteProposalSet[];
  hypotheses: Hypothesis[];
  experiments: Experiment[];          // empty until P4
  evidence: Evidence[];               // empty until P5
  revisions: HypothesisRevision[];    // empty until P5
  planItems: PlanItem[];              // empty until P7
  outbox: OutreachDraft[];            // empty until P7
  teachings: HumanTeaching[];         // empty until P6
  operations: OperationRecord[];
}

interface AgentAddressable {
  id: string;
  ref: string;
  availableActions: AvailableAction[];
}

interface Reflection extends AgentAddressable {
  status: 'proposed' | 'confirmed';
  text: string;
  recordedBy: 'participant' | 'agent_transcribed';
  createdAt: string;
  answersFollowUpRef?: string;        // set when this reflection answers a follow-up
}

interface FollowUpQuestion extends AgentAddressable {
  status: 'proposed' | 'answered' | 'skipped' | 'withdrawn';
  question: string;                   // <= 300 chars
  reasonRefs: string[];               // confirmed reflections that were too thin, 1..5
  askedBy: 'chatgpt_webmcp' | 'embedded_inference';
  createdAt: string;
  answerReflectionRef?: string;       // only when answered
}

type RouteKind = 'closest' | 'bridge' | 'probe';

interface RoutePreview {
  ref: string;
  kind: RouteKind;
  title: string;
  premise: string;
  sourceQuotes: { reflectionRef: string; quote: string }[];
  constraint: string;
  learningQuestion: string;
  test: {
    action: string;
    maximumDays: number;       // 1..7
    maximumHours: number;
    maximumMoney: number;
    currency: string;
  };
  strengthensWhen: string;
  weakensWhen: string;
  status: 'proposed' | 'edited' | 'rejected' | 'selected';
  carriedFromRouteRef?: string;       // copied unchanged from the superseded set
}

interface RouteProposalSet extends AgentAddressable {
  status: 'proposed' | 'resolved' | 'superseded';
  routes: [RoutePreview, RoutePreview, RoutePreview];
  selectedRouteRef?: string;
  supersedesRouteSetRef?: string;
  createdBy: ProposalSource;
  createdAt: string;
}

interface Hypothesis extends AgentAddressable {
  status: GhostStatus | 'testing' | 'supported' | 'weakened' | 'refuted' | 'parked';
  claim: string;
  originatingRouteSetRef: string;
  originatingRouteRef: string;
  sourceQuotes: { reflectionRef: string; quote: string }[];
  influenceFlags: ('peer' | 'trend' | 'parent' | 'prestige' | 'fear')[];
  confidence: number;
}

interface Evidence extends AgentAddressable {
  experimentRef: string;
  status: 'proposed' | 'confirmed' | 'rejected';
  observation: string;
  relation: 'supports' | 'contradicts' | 'neutral';
  strength: 1 | 2 | 3;
  recordedBy: 'participant' | 'agent_transcribed';
}

interface HypothesisRevision extends AgentAddressable {
  hypothesisRef: string;
  status: GhostStatus;
  proposedConfidence: number;
  confirmedEvidenceRefs: string[];
  rationale: string;
}

interface HumanTeaching extends AgentAddressable {
  kind: 'constraint' | 'preference' | 'correction';
  statement: string;
  scope: { tool?: ToolName; entityRef?: string; phase?: Phase };
  sourceOperationRefs: string[];
  status: 'active' | 'superseded';
  supersedesRef?: string;
}

interface OperationReceipt {
  operationId: string;
  operationRef: string;
  actor: 'participant' | 'agent';
  command: string;
  effect: 'APPLIED' | 'PROPOSED' | 'AWAITING_HUMAN' | 'COMPENSATED';
  beforeVersion: number;
  afterVersion: number;
  changedRefs: string[];
  at: string;
  compensatesOperationRef?: string;
}

interface OperationRecord extends OperationReceipt {
  requestIdentity: string; // internal canonical intent used for replay-conflict checks
}
```

Route previews are durable proposal state, not accepted career facts. Selecting one route creates
one accepted `Hypothesis` that copies its exact quote sources and preserves the originating route
reference. The other routes remain proposal history and never become silently accepted. Every quote
must equal a substring of its referenced confirmed reflection. Every proposed route respects the
current time and money limits and proposes a test idea of no more than seven days.

Workspace validation (`web/src/domain/workspace.ts`) independently rechecks these relationships on
load/import: globally unique addressable refs (workspace id, reflections, follow-up questions, route
sets, routes, hypotheses, operation refs); every receipt `changedRef` resolves; unique operation IDs
and a contiguous `beforeVersion -> afterVersion` chain ending at `stateVersion`; at most one
proposed route set and at most one open follow-up; answered follow-ups and their answer reflections
point at each other; carried routes copy a same-kind route of the superseded set unchanged; proposed
sets stay inside the current limits (historical sets were validated when created); selected-route
cardinality; accepted-hypothesis lineage; `TESTING` holds exactly one accepted hypothesis and
`EXPLORING` holds none; and the compensation rules below.

A compensation may point only to one earlier, uncompensated `PROPOSED` `propose_route_set`
operation for the same route set, with no intervening operation that changed that set, and only a
`COMPENSATED` `compensate_route_set` record may carry that link.

The workspace snapshot is canonical for current state. Operation receipts are canonical for
what happened. A stored operation record adds the canonical request identity needed to
distinguish a retry from reuse of an operation id for a different intent; that internal value
is not returned in the public receipt. Orientation, counts, "story so far," and collaboration
patterns are deterministic projections and can always be rebuilt.

## 8. Agent driver's-seat contract

### 8.1 Cold orientation

`read_workspace` is the only orientation entry point:

```ts
type ReadWorkspaceInput =
  | { view?: 'orientation'; sinceCursor?: string }
  | { view: 'working_set'; sinceCursor?: string; omittedRefsCursor?: string }
  | { view: 'entities'; refs: string[] };
```

`orientation` is the default and returns:

- workspace identity: schema, contract, read-contract, state and phase versions;
- focus question and `costCaps`;
- `confirmedWords`: the exact confirmed participant text with refs (newest last, at most six,
  with `confirmedWordsTruncated`); every quote in a proposal must be an exact substring of one of
  these texts;
- active route set summary, accepted hypothesis summary, and the latest follow-up question;
- `proposal`: whether and how the agent may propose right now (`available`, `mode: 'fresh' |
  'replace_rejected'`, `reason`, `supersedesRouteSetRef`, `carryRouteRefs`, `replaceKinds`);
- the next human decision (`ADD_REFLECTION`, `REVIEW_PROPOSED_REFLECTION`, `ANSWER_FOLLOW_UP`,
  `CHOOSE_OR_REVISE_ROUTE_SET`, `REOPEN_OR_CONTINUE`, `NO_PENDING_DECISION`);
- active constraints and sourced human teachings (teachings are empty until P6);
- unresolved conflicts and pending human interactions (confirm reflection, answer follow-up,
  choose or revise);
- changes since the optional cursor (each with `actor`) and a new cursor;
- available agent actions with target refs;
- the highest relevant proof/confirmation status;
- concise guidance.

Participant-only commands appear only as pending human interactions; they are never projected in
callable `availableActions`. The `proposal` field and the visible room header derive from the same
function (`proposalAvailability` in `web/src/domain/affordances.ts`), so both chairs see one truth.

It does not return the full ledger by default. Every successful projection identifies the explicit
`read-workspace/3.0.0` projection contract. `working_set` preserves the P2 `reflections` field for
compatible consumers and returns current hypotheses, open follow-up questions, route sets, and
reflections within one shared entity limit. It names omitted refs in bounded pages and returns a
state-bound omission cursor until every omitted ref is enumerable. `entities` performs bounded
targeted reads across reflections, follow-up questions, route sets, individual route previews,
hypotheses, and public operation-receipt summaries; unknown refs are returned in `missingRefs`.
There is no ambiguous "since last read" stored globally; the caller supplies a cursor, while a cold
caller receives current truth.

Bounds (`web/src/domain/reads.ts`): 20 public change summaries and 20 working-set or targeted
entities per read; 5 changed refs per public change summary; the complete orientation tool result
is capped at 8,000 serialized characters and 4,000 UTF-8 bytes, used as a conservative upper bound
on token pieces. When over budget the projection drops the oldest confirmed words first, then
pending interactions, then change items (advancing the cursor only through the last returned
operation so nothing is stranded), then halves free text. Internal replay identities are never
projected. Every successful view labels participant-authored strings as untrusted content rather
than agent instructions.

### 8.2 Affordances

Every addressable entity returns:

```ts
interface AvailableAction {
  tool: ToolName;
  targetRef: string;
  actor: 'agent' | 'participant';
  effect: 'READ' | 'PREPARE_UI' | 'PROPOSE';
  requiresHuman: boolean;
  reason?: string;
}
```

Agent projections expose only actions with `actor: 'agent'`, and the only agent action in the
candidate is `propose_route_set` (with a `reason` that says whether to propose fresh or replace
set-aside routes). Participant actions such as `revise_route_set`, `choose_route`,
`skip_follow_up`, `set_limits`, and `reopen_exploring` appear in `pendingHumanActions`, never as
callable WebMCP tools. Descriptions never advertise unavailable actions.

### 8.3 Writes and receipts

Every write input includes:

```ts
interface WriteControl {
  operationId: string;       // unique per intended effect; reuse only for retry
  expectedVersion: number;
}
```

Every result uses one envelope:

```ts
interface ToolResult<T> {
  ok: boolean;
  data?: T;
  receipt?: OperationReceipt;
  error?: {
    code: string;
    what: string;
    retry: 'NEVER' | 'SAME_OPERATION_ID' | 'REREAD_THEN_NEW_OPERATION';
    insteadDo?: string;
    example?: unknown;
    changedRefs?: string[];
  };
  nextActions: AvailableAction[];
  stateVersion: number;
  guidance: string;          // short, situational, no policy hidden here
}
```

`retry` describes whether the exact request and operation may be repeated; it does not prohibit a
different recovery action. `NEVER` means do not repeat that request. `insteadDo` may direct the
caller to reread or correct the input and submit a distinct command with a new `operationId`.
`SAME_OPERATION_ID` is reserved for retrying the same intended effect after an uncertain/storage
failure, while `REREAD_THEN_NEW_OPERATION` requires fresh state and a newly considered operation.

On a lost response, the agent retries with the same `operationId`. The command ledger
returns the original receipt. On `STALE_STATE`, it re-reads and creates a new operation only
after reconsidering the new state.

A proposal receipt carries up to three `changedRefs`, in order: the withdrawn follow-up question if
any, the superseded predecessor if it was still proposed, and the new route set last. A follow-up
receipt carries the question ref. A `choose_route` receipt carries the set, the hypothesis, and any
withdrawn question.

While a ChatGPT-authored set or question is unresolved, `propose_route_set` stays registered so an
exact same-operation replay can recover its receipt after any refresh; eligibility is derived from
the ledger-backed projection, never from page memory, and the kernel decides between replay,
`OPERATION_CONFLICT`, and lifecycle denial. UI projection refresh is a separate notification: its
failure is visible in the human surface but cannot replace or hide the already committed command
result.

Actor and proposal provenance are trusted execution context, not caller-shaped command input. The
participant adapter supplies participant authority; the WebMCP write adapter supplies agent
authority with `chatgpt_webmcp` provenance; the embedded adapter supplies agent authority with
`embedded_inference` provenance. Extra payload fields that attempt to self-assert actor or
provenance are malformed. Replay identity remains bound to the trusted actor and, for route
proposals, the trusted proposal source.

### 8.4 Accretion without corruption

The system gets better through a provenance chain:

```text
accept / edit / reject / correct
          ↓ immutable operation receipt
explicit human teaching candidate
          ↓ participant accepts or edits
active sourced teaching
          ↓ deterministic orientation projection
better next proposal, including for a cold visiting agent
```

Rules:

- raw decisions and receipts remain inspectable;
- teachings cite their source operations and have bounded scope;
- contradictory teachings are surfaced, never silently merged;
- a new teaching can supersede an old one without deleting history;
- free-text summaries are derived and cannot change state or permissions;
- model eval outputs never write participant memory;
- no acceptance/rejection count automatically grants authority.

Teachings are admitted in P6. In the candidate, the visible accretion is the ledger itself: edits,
set-asides, answers, and carried routes are receipts the next proposal must respect.

## 9. WebMCP tool catalogue

All tool annotations are discovery hints only. Product policy is enforced in commands.
All collection outputs are bounded; entity reads are ref-targeted.

| Tool | Kind | Mode | Effect | Human boundary | Receipt |
|---|---|---|---|---|---|
| `read_workspace` | imperative | all | READ | none | no |
| `get_method_guide` | imperative | all | READ | none | no |
| `propose_route_set` | imperative | exploring, when `proposal.available` or replay-eligible | PROPOSE | participant answers/skips, edits/rejects/chooses | yes |
| `draft_words` | declarative form | answer, confirm, and follow-up screens | PREPARE_UI | participant edits and confirms | no |
| `propose_experiment` | imperative | testing (P4) | PROPOSE | accept/edit/reject | yes |
| `schedule_action` | imperative | testing (P4) | PROPOSE | confirm day/duration | yes |
| `draft_outreach` | imperative | testing (P7) | PROPOSE | edit/copy/send manually | yes |
| `log_evidence` | imperative | testing (P5) | PROPOSE | confirm observation/relation | yes |
| `propose_hypothesis_revision` | imperative | reviewing (P5) | PROPOSE | accept/edit/reject | yes |
| `propose_verdict` | imperative | reviewing (P5) | PROPOSE | confirm outcome | yes |

Catalogue rules:

- every state-changing tool includes `WriteControl`;
- `get_method_guide` returns `methodVersion` (`destiny-method/2.0.0`), `contractVersion`,
  `promise`, ordered `steps`, `boundaries`, and a complete `exampleInput` for `propose_route_set`;
- `propose_route_set`'s input schema is derived mechanically from the canonical Zod command schema
  (`web/src/webmcp/catalogue/propose-route-set-schema.ts`); its description states every rule that
  causes a denial: exact quotes, limits, distinct kinds/questions/tests, fresh refs, predecessor
  citation, `carryRouteRef` for kept routes, and the `insufficient_signal` path;
- proposal inputs use refs, bounded strings/enums/numbers, and `additionalProperties: false`;
- every proposal declares which accepted entity it extends;
- only confirmed evidence belonging to the hypothesis's experiments can support a revision;
- `draft_outreach` has no send counterpart anywhere in the product;
- `propose_route_set` returns a visible proposal and cannot select or accept a route for the
  participant; `choose_route`, `revise_route_set`, `set_limits`, `skip_follow_up`, and
  `reopen_exploring` are intentionally absent from the WebMCP catalogue;
- public write results are runtime-validated, expose only agent affordances, and represent
  participant affordances as pending human interactions;
- every invocation, including reads and denials, emits one plain-language activity event for the
  visible room; summaries never contain tool names;
- a state change aborts old registrations, but cached invocations are still command-denied
  (`STALE_REGISTRATION`).

Tool handlers are mechanically thin:

```ts
async function executeWebMcpTool(input: unknown) {
  const command = parseToolInput(input);
  const result = await commandKernel.execute(command);
  renderAuthoritativeState(result.stateVersion);
  emitActivity(participantSentenceFor(result));
  return toWebMcpResult(result);
}
```

## 10. Human workspace

1. **Journey:** one focused question at a time, early branching, honest progress, Back, safe Skip,
   save-as-you-go, resume, and an equal free-writing route. Limits are entered once and recorded
   through `set_limits`.
2. **Handoff:** the confirmed words and limits, one capability line derived from the same
   projection the agent reads, and three equal paths: ask ChatGPT, draft by hand, or (when
   enabled) ask the lab assistant after ticking a consent sentence.
3. **Route Room:** provenance chip on the set (Proposed by ChatGPT, Drafted by you, Drafted by the
   lab assistant); three equally weighted route cards with Edit, Set aside, and Choose; tags for
   "Kept from your last set", "Replaced by ChatGPT", and "Set aside"; grounding highlights that mark
   the exact quoted words in the words panel when a card is hovered or focused; private notes behind
   a disclosure that no projection ever contains.
4. **Follow-up card:** the agent's question, the words it reasoned from, an answer box (also a
   declarative draft form), Answer and Skip.
5. **Activity ("What happened"):** plain sentences built from the ledger with receipt lines, plus
   this session's agent reads and denials; denials also surface as a dismissible notice.
6. **Agent view ("See what ChatGPT sees"):** the exact orientation projection, with the note that
   private notes are not in it.
7. **Agent status:** small, honest badge (Human mode, Agent connected, Agent tools unavailable).
8. **Chosen:** the direction to test, its receipt, the unchosen routes as history, Reopen exploring,
   Export my room (JSON download), and Start over.
9. **Privacy:** local-only explanation, export, start over with an explicit confirmation that says
   what is removed, and recovery guidance. Import with preview is deferred.
10. **No-agent mode:** the complete core loop remains usable by hand.

The UI may use "You" in participant-facing copy. Canonical schema/tool nouns remain stable;
the metaphor must not make the product harder for a distressed or uncertain person. Primary copy
never exposes command names, versions beyond the receipt line, or "best".

## 11. Persistence and recovery

- Next.js + TypeScript; shared Zod schemas; one client command kernel.
- One versioned local workspace in localStorage (`destiny-ai.workspace.v1`) for the challenge
  MVP; the journey draft (screen, answers, idempotent operation ids, private notes) lives in
  `destiny-ai.journey.v2` and is presentation state, never authority.
- Each accepted command atomically writes the next snapshot and receipt. Browser writes are
  serialized across same-origin tabs with the Web Locks API; a command whose expected version
  became stale while waiting for the lock is denied before persistence.
- Reading an absent workspace returns the validated initial snapshot without creating an
  unreceipted persistence write. The first accepted command persists the first authoritative
  snapshot and receipt together.
- Startup validates and migrates `schemaVersion` through the chain v1 -> v2 -> v3 in memory
  (`migrateWorkspace` in `web/src/storage/local-workspace-store.ts`); the next accepted write
  persists v3. Migration failure preserves the original bytes and reports a typed storage failure.
- Start over requires explicit participant confirmation and reports what was removed.
- No analytics or remote career-content storage by default. The embedded assistant sends confirmed
  words only when the participant ticks the consent sentence for that request; the server stores
  and logs nothing.
- Server persistence, auth, and sync require a separate architecture packet. They are not a
  drop-in "upgrade" during the MVP.

## 12. Evaluation and proof

### Deterministic contract suite

- malformed/extra fields, bounds, wrong phase, wrong actor, wrong lifecycle, unknown/cross-resource
  refs;
- stale version, same-id replay, same-id/different-payload conflict;
- proposal accepted/rejected/superseded and compensation; follow-up asked/answered/skipped/withdrawn;
  carry-over supersession and its denials; limits and reopening;
- unconfirmed or unrelated evidence denied for revision (P5);
- storage migration v1/v2/v3, corrupt/quota failure, export, start over.

### Agent behaviour suite

- WebMCP evals (`web/src/webmcp/evals/`): catalogue completeness and schema parity, never
  registering participant-only commands, proposal with receipt, quote fidelity, caps, distinctness,
  stale/replay/conflict, injection-like text as untrusted content, follow-up round trip, replace
  only what was set aside, denial of replacing a kept route, isolated contexts, and a UI-shaped
  fixture (limits then words, exactly as the journey writes them);
- the visiting-agent simulator (`web/src/inference/agent-simulator.ts`) runs a scripted mock model
  through discovery -> method guide -> grounded proposal, proves that tools outside the catalogue
  are refused, and proves that an instruction hidden in participant text is quoted, not obeyed;
- the lab assistant provider-off suite proves grounding denials (fabricated quote, cap breach,
  duplicate kinds), timeout and provider failure paths, and the 403 when disabled.

For accretion (P6), replay the same fixture before and after an accepted teaching. The next
proposal must respect the teaching; the available authority must remain identical.

### Human journey proof

- `web/tests/journey.spec.ts` (Playwright, Desktop Chrome): every shape reaches the handoff with
  `set_limits` recorded before any `save_reflection`; manual drafts quote different answers; edit,
  set aside, choose, reload, reopen, re-draft; start over clears both keys; the agent view shows
  confirmed words and no notes; keyboard and focus; 390px, 200% text, reduced motion, forced
  colours; and a simulated visiting agent (injected `document.modelContext`) that proposes, asks
  first, is denied visibly, replaces only what was set aside, and reads the decision back.
- After safeguarding and recruitment gates clear, report how many moderated adults can identify
  their quoted words, state that routes are not predictions, distinguish proposed routes from the
  accepted hypothesis, and explain what choosing changed. Make no comprehension claim before then.

### Runtime and release proof

Verify the same immutable candidate separately in:

1. the deterministic adapter harness (vitest);
2. real Google Chrome with the `enable-webmcp-testing` flag persisted in a throwaway profile
   (`web/tests/webmcp-live.spec.ts`, `npx playwright test -c playwright.live.config.ts`), driving
   `document.modelContext.getTools()` and `executeTool()` for discovery, typed reads, the method
   guide, malformed denial, declarative `respondWith`, proposal with receipt persisted to
   localStorage, replay, denial, follow-up, and reread;
3. the ChatGPT in-app browser (human step; record the screen with receipts visible);
4. a deployed URL readback with candidate SHA/contract/schema identity and rollback.

The competition story is:

`guided answers -> limits -> ChatGPT asks one question or proposes three grounded routes -> participant edits or sets aside -> ChatGPT replaces only what was set aside -> participant chooses -> receipt -> ChatGPT rereads`

Capture tool discovery, invocation, human approval, authoritative after-state, typed
denial/retry behavior, and the resulting receipt. Run the same story with no embedded model
provider configured. State clearly that experiments, evidence, and revisions are the
post-submission product path. Optional inference quality is a separate post-candidate claim.

Report the highest proof actually observed. Local tests are not browser, deployed, user,
competition, or production proof; a real-Chrome run is not a ChatGPT in-app browser run.

## 13. Delivery authority

The dependency-ordered team programme, ownership lanes, packet gates, and daily sequence live
in `docs/PLAN.md`. It is intentionally separate from this product/system contract.

P1/P2/P3/P8A are integrated. P8B joined read and write paths. P11 (candidate v2, D-015) realises
the ChatGPT collaboration, hardening, and live-Chrome proof in one packet across Lanes A-D. P8C
admits the immutable candidate, deploys it, opens the source, and records the ChatGPT run. P4-P7
and P10 complete the product after submission. P9's optional inference is now the embedded lab
assistant admitted in D-015, disabled by default; EVE has no admitted packet.

## 14. Open decisions

1. Who is the named qualified reviewer for distress copy?
2. Which five adults commit to testing?
3. Which OpenAI-compatible endpoint and model, if any, back the lab assistant for the demo, and who
   holds the key?
