# Destiny.AI — Product and System Contract

**Status:** Current product/technical authority, revised 2026-09-01.
**Build admission:** P1 and P2 are integrated. A0 admits D-014; P3A domain and P8A WebMCP
foundation are the next independent outcomes. P3B journey stacks on P3A. Participant research
remains reviewer- and recruitment-gated.
**Supersedes:** the original Destiny.AI brainstorm, the red/green whiteboards, the eight
internal-agent concept, and the pre-review architecture in this file.
**Review receipt:** `docs/archive/2026-09-01-foundation/SYSTEM_REVIEW.md`.

## 1. Product promise

A guided Destiny Journey where a career-stuck adult and ChatGPT turn the person's own words into
three grounded routes and leave with one participant-approved hypothesis plus a bounded seven-day
test idea. After submission, the product can run that test and revise direction only from confirmed
evidence. The website is their shared Route Room.

**Thesis:** direction is not predicted and is not found through endless introspection. It is
reduced through small, reversible experiments against the real world. The agent is a lab
assistant; the participant owns the question, approvals, evidence, and real-world action.

The first useful session is:

`shape of stuck -> focused prompts -> confirmed words -> three route previews -> choose one to test`

The smallest complete learning loop is:

`confusion -> reflection -> hypothesis ghost -> experiment ghost -> confirmed evidence -> revision ghost`

## 2. Binding invariants

1. **We do not require an embedded reasoning agent.** A browser agent visits. Destiny.AI
   supplies the workspace, governed capabilities, method, and proof. Every candidate
   must work without EVE, AI SDK, OpenCode, a model API key, or any remote inference service.
2. **One state authority.** The MVP workspace is one versioned local document. UI and WebMCP
   invoke the same command kernel; neither writes storage directly.
3. **The Route Room is the shared object.** Agent-visible facts are inspectable by the participant.
   Compact summaries are derived projections with provenance, never a hidden second memory.
4. **Propose before consequence.** Agent hypotheses, experiments, evidence transcriptions,
   verdicts, and confidence revisions require human acceptance.
5. **Schemas are one policy layer, not the whole policy.** Bounded schemas reject malformed
   inputs; the command kernel also enforces current phase, lifecycle, versions, and approval.
6. **Phase controls discovery and execution.** WebMCP registers only phase-relevant tools;
   every invocation is re-checked because agents can cache catalogues and pages can race.
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

## 3. Scope

### MVP

- one local participant workspace;
- onboarding, focus question, time/money caps, privacy notice, clear/export/import;
- early “shape of stuck” branching, one-question steps, editable answers, and resumable progress;
- one bounded three-route proposal containing Closest, Bridge, and Probe previews;
- reflections, hypotheses, experiments, evidence, revisions, week plan, outbox, activity;
- human-only phase gates and real-world sends;
- visiting-agent WebMCP tools, method guide, compact orientation, typed errors, receipts;
- explicit human teachings from accept/edit/reject/correct actions;
- deterministic fixtures, command tests, browser journeys, and live runtime proof.
- a complete no-provider baseline: the human journey and visiting-agent WebMCP journey work
  without embedded inference credentials.

### Deferred

- authentication, server database, multi-person workspaces, sync, background agents;
- resource/opportunity search, portfolio generation, embedded chatbot, Gmail/Calendar;
- a career knowledge store, internal reflection/plan agents, automatic nudges;
- automatic model-written taste summaries that become active without review.
- optional AI SDK/OpenCode Go Luna inference behind a server-only proposal-source interface;
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
  `document.modelContext.registerTool()`.
- Chrome documents an experimental origin trial beginning in Chrome 149 and the
  `#enable-webmcp-testing` flag. This is experimental and may drift.
- The implementation must feature-detect the runtime, isolate compatibility behavior in one
  adapter, and retain a deterministic in-page test harness. A passing harness is not live
  ChatGPT or Chrome proof.

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
WebMCP tool ────┘                          │
                                         ├─> UI renders authoritative after-state
                                         └─> agent receives result + next actions

workspace + receipts -> deterministic orientation projection -> read_workspace
human feedback       -> sourced teachings --------------------^
```

The WebMCP registry is an adapter. It exposes product-owned commands; it is never an
independent domain, permission system, or ledger.

An optional inference adapter, if ever admitted, sits outside this tower as a replaceable
proposal source. It receives bounded projections and returns typed proposals through the same
commands. Its absence, timeout, quota failure, or removal must not break the product.

## 6. Journey and authority

| Phase | Discoverable tools | Human-only gate |
|---|---|---|
| all phases | `read_workspace`, `get_method_guide` | — |
| `EXPLORING` | `save_reflection`, `propose_route_set` | Participant calls `choose_route` |
| `TESTING` | `propose_experiment`, `schedule_action`, `draft_outreach`, `log_evidence` | Close cycle after confirmed evidence |
| `REVIEWING` | `propose_hypothesis_revision`, `propose_verdict` | Accept revision or re-explore |

Registration helps an agent discover what is relevant. The command kernel is authoritative:
it rejects wrong-phase, wrong-resource, stale, replay-conflict, and unconfirmed-evidence use.

Agent work has three effect classes:

- `READ`: no mutation;
- `PREPARE_UI`: open a bounded interaction and return `AWAITING_HUMAN`;
- `PROPOSE`: create a visible ghost requiring participant action.

Direct committed mutations are reserved for explicit participant UI commands and internal
bookkeeping performed atomically with an accepted command.

`propose_route_set` is a replay-safe `PROPOSE` command shared by the participant UI, ChatGPT
WebMCP adapter, and any optional inference adapter. Its input is either
`{ outcome: 'routes', routes: [RoutePreview, RoutePreview, RoutePreview] }` or
`{ outcome: 'insufficient_signal', followUpQuestion: string, reasonRefs: string[] }`. The kernel
validates bounds, exact references, caps, and structural distinction; it does not pretend to judge
career sufficiency itself. The insufficient branch stores no route set. A replacement proposal
includes `supersedesRouteSetRef`; the older set stays in history.

`insufficient_signal` is a successful, non-mutating diagnostic outcome: the result has `ok: true`,
typed `outcome`, `followUpQuestion`, and `reasonRefs` data, no `error`, no receipt, and the unchanged
`stateVersion`. It is not a successful write. Every successful write still creates and returns a
receipt.

`revise_route_set` is replay-safe and participant-only. It owns bounded pre-choice edits and
individual or all-route rejection. Rejecting all routes resolves the set without creating a
hypothesis. Revision, rejection, and supersession preserve receipts and proposal history.

`choose_route` is a participant-only command and the single acceptance gate. It may include final
participant edits, atomically creates the accepted hypothesis and receipt, and leaves the other two
routes as non-authoritative proposal history. There is no second accept step.

## 7. Canonical nouns and data

Internal identity and agent legibility are separate:

- `id`: stable opaque internal identity;
- `ref`: short unique human/agent reference such as `hyp-analytical-01`;
- display title: editable participant-facing text.

```ts
type Phase = 'EXPLORING' | 'TESTING' | 'REVIEWING';
type GhostStatus = 'proposed' | 'accepted' | 'rejected' | 'superseded';

interface Workspace {
  id: string;
  schemaVersion: number;
  contractVersion: string;
  stateVersion: number;
  phase: Phase;
  participant: {
    displayName: string;
    focusQuestion: string;
    costCaps: { hoursPerWeek: number; money: number; currency: string };
  };
  reflections: Reflection[];
  routeProposalSets: RouteProposalSet[];
  hypotheses: Hypothesis[];
  experiments: Experiment[];
  evidence: Evidence[];
  revisions: HypothesisRevision[];
  planItems: PlanItem[];
  outbox: OutreachDraft[];
  teachings: HumanTeaching[];
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
}

interface RouteProposalSet extends AgentAddressable {
  status: 'proposed' | 'resolved' | 'superseded';
  routes: [RoutePreview, RoutePreview, RoutePreview];
  selectedRouteRef?: string;
  supersedesRouteSetRef?: string;
  createdBy: 'chatgpt_webmcp' | 'participant' | 'embedded_inference';
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
must equal a substring of its referenced confirmed reflection. Every route respects recorded time
and money caps and proposes a test idea of no more than seven days.

Workspace validation independently rechecks those caps and lifecycle relationships on load/import.
Workspace identity, entity refs, route refs, hypothesis refs, and operation refs are globally unique;
every receipt `changedRef` resolves to an addressable workspace object. Operation IDs are unique and
the ordered ledger forms a contiguous `beforeVersion -> afterVersion` chain ending at
`stateVersion`. A compensation may point only to one earlier, uncompensated `PROPOSED`
`propose_route_set` operation for the same route set, and only a `COMPENSATED`
`compensate_route_set` record may carry that link.

The workspace snapshot is canonical for current state. Operation receipts are canonical for
what happened. A stored operation record adds the canonical request identity needed to
distinguish a retry from reuse of an operation id for a different intent; that internal value
is not returned in the public receipt. Orientation, counts, “story so far,” and collaboration
patterns are deterministic projections and can always be rebuilt.

## 8. Agent driver's-seat contract

### 8.1 Cold orientation

`read_workspace` is the only orientation entry point:

```ts
type ReadWorkspaceInput =
  | { view?: 'orientation'; sinceCursor?: string }
  | { view: 'working_set'; sinceCursor?: string }
  | { view: 'entities'; refs: string[] };
```

`orientation` is the default and returns:

- workspace identity: schema, contract, state and phase versions;
- focus question, caps, active hypothesis/experiment, and next human decision;
- active constraints and sourced human teachings;
- unresolved conflicts and pending human interactions;
- changes since the optional cursor and a new cursor;
- available actions with target refs;
- the highest relevant proof/confirmation status;
- concise guidance.

It does not return the full ledger by default. `working_set` returns current active entities
and `entities` performs bounded targeted reads. There is no ambiguous “since last read”
stored globally; the caller supplies a cursor, while a cold caller receives current truth.

The P2 implementation fixes those bounds at 20 public change summaries and 20 working-set or
targeted entities per read. Internal replay identities are never projected. Truncated change
pages advance only through the last returned operation, so callers can continue without
stranding older changes. The complete orientation tool result is capped at 6,000 serialized
characters and 3,000 UTF-8 bytes; the byte count is used as a conservative upper bound on
token pieces without assuming an English-only four-characters-per-token ratio.

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

Agent projections expose only actions with `actor: 'agent'`. Participant actions such as
`revise_route_set` and `choose_route` appear in `pendingHumanActions`, never as callable WebMCP
tools. Descriptions never advertise unavailable actions.

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

Actor and proposal provenance are trusted execution context, not caller-shaped command input. The
participant adapter supplies participant authority; a WebMCP write adapter can supply only agent
authority with `chatgpt_webmcp` provenance; an optional inference adapter supplies agent authority
with `embedded_inference` provenance. Extra payload fields that attempt to self-assert actor or
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

This is agent-accretive because useful human instruction survives model/session replacement.
It is resource-efficient because the agent reads a compact active projection, not the entire
history.

## 9. WebMCP tool catalogue

All tool annotations are discovery hints only. Product policy is enforced in commands.
All collection outputs are bounded; entity reads are ref-targeted.

| Tool | Mode | Effect | Human boundary | Receipt |
|---|---|---|---|---|
| `read_workspace` | all | READ | none | no |
| `get_method_guide` | all | READ | none | no |
| `save_reflection` | exploring | PROPOSE when agent-transcribed | confirm/edit text | yes |
| `propose_route_set` | exploring | PROPOSE | participant edits/rejects/chooses | yes |
| `propose_experiment` | testing | PROPOSE | accept/edit/reject | yes |
| `schedule_action` | testing | PROPOSE | confirm day/duration | yes |
| `draft_outreach` | testing | PROPOSE | edit/copy/send manually | yes |
| `log_evidence` | testing | PROPOSE | confirm observation/relation | yes |
| `propose_hypothesis_revision` | reviewing | PROPOSE | accept/edit/reject | yes |
| `propose_verdict` | reviewing | PROPOSE | confirm outcome | yes |

Catalogue rules:

- every state-changing or preparing tool includes `WriteControl`;
- `get_method_guide` returns `methodVersion` and the current `contractVersion`;
- proposal inputs use refs, bounded strings/enums/numbers, and `additionalProperties: false`;
- every proposal declares which accepted entity it extends;
- only confirmed evidence belonging to the hypothesis's experiments can support a revision;
- `draft_outreach` has no send counterpart anywhere in the product;
- `propose_route_set` returns a visible proposal and cannot select or accept a route for the
  participant; `choose_route` is intentionally absent from the WebMCP catalogue;
- a phase change aborts old registrations, but cached invocations are still command-denied.

Tool handlers are mechanically thin:

```ts
async function executeWebMcpTool(input: unknown) {
  const command = parseToolInput(input);
  const result = await commandKernel.execute(command);
  renderAuthoritativeState(result.stateVersion);
  return toWebMcpResult(result);
}
```

## 10. Human workspace

1. **Journey:** one focused question at a time, early branching, honest progress, Back, safe Skip,
   save/exit, resume, and an equal free-writing route.
2. **Route Room:** confirmed quote slips, three equally weighted route previews, comparison, repair,
   and one participant-chosen accepted hypothesis.
3. **Week:** accepted plan items and honest pending/confirmed/done/missed states.
4. **Outbox:** drafts with edit/copy/mailto; no automated send.
5. **Activity:** plain-language history; versions and operation details stay under a disclosure.
6. **Agent status:** small, honest connected/human-only/reconnect state.
7. **Teach agent:** card/workspace correction that becomes a sourced teaching only after the
   participant confirms it.
8. **Privacy:** local-only explanation, export, import preview, clear, and recovery guidance.
9. **No-agent mode:** the complete core loop remains usable by hand.

The UI may use “You” in participant-facing copy. Canonical schema/tool nouns remain stable;
the metaphor must not make the product harder for a distressed or uncertain person.

## 11. Persistence and recovery

- Next.js + TypeScript; shared Zod schemas; one client command kernel.
- One versioned local workspace in localStorage for the challenge MVP.
- Each accepted command atomically writes the next snapshot and receipt. Browser writes are
  serialized across same-origin tabs with the Web Locks API; a command whose expected version
  became stale while waiting for the lock is denied before persistence.
- Reading an absent workspace returns the validated initial snapshot without creating an
  unreceipted persistence write. The first accepted command persists the first authoritative
  snapshot and receipt together.
- Startup validates and migrates `schemaVersion`; migration failure preserves the original
  bytes and offers export/reset rather than guessing.
- Import validates into a preview before replacement.
- Clear requires explicit participant action and reports what was removed.
- No analytics or remote career-content storage by default.
- Server persistence, auth, and sync require a separate architecture packet. They are not a
  drop-in “upgrade” during the MVP.

## 12. Evaluation and proof

### Deterministic contract suite

- malformed/extra fields, bounds, wrong phase, wrong lifecycle, unknown/cross-resource refs;
- stale version, same-id replay, same-id/different-payload conflict;
- proposal accepted/rejected/superseded and compensation;
- unconfirmed or unrelated evidence denied for revision;
- storage migration, corrupt/quota failure, export/import and clear.

### Agent behaviour suite

Use at least 15 scripted sessions across:

- cold orientation and mid-journey handoff;
- quote fidelity and no fabricated source;
- load-bearing hypothesis selection;
- cost/deadline/falsifiability constraints;
- unavailable-tool avoidance;
- stale/retry recovery;
- human correction and contradictory teaching;
- distress redirect without diagnosis;
- bounded reads and token cost.

For accretion, replay the same fixture before and after an accepted teaching. The next
proposal must respect the teaching; the available authority must remain identical.

### Human journey proof

- solo board first, then visiting-agent collaboration;
- empty, error, rejected, stale, conflict, offline/corrupt, and recovery states;
- participant can explain why confidence changed and identify the confirming evidence;
- accessibility and clear/export/delete are part of the journey, not release polish.
- after safeguarding and recruitment gates clear, report how many moderated adults can identify
  their quoted words, state that routes are not predictions, distinguish proposed routes from the
  accepted hypothesis, and explain what choosing changed. Make no comprehension claim before then.

### Runtime and release proof

Verify the same immutable candidate separately in:

1. deterministic adapter harness;
2. Chrome with the required experimental access;
3. ChatGPT in-app browser;
4. deployed URL readback with candidate SHA/contract/schema identity and rollback.

The deadline-sized competition story is:

`guided answers -> ChatGPT proposes three grounded routes -> participant chooses one -> accepted hypothesis and receipt -> ChatGPT rereads`

For that story, capture tool discovery, invocation, human approval, authoritative after-state,
typed denial/retry behavior, and the resulting receipt. Run the same story with no embedded
model provider configured. State clearly that experiments, evidence, and revisions are the
post-submission product path. Optional inference quality is a separate post-candidate claim.

The candidate may display a bounded seven-day test idea contained in the chosen route. It does not
schedule, execute, or evaluate that test; those capabilities start in P4.

Report the highest proof actually observed. Local tests are not browser, deployed, user,
competition, or production proof.

## 13. Delivery authority

The dependency-ordered team programme, ownership lanes, packet gates, and daily sequence live
in `docs/PLAN.md`. It is intentionally separate from this product/system contract.

The repository-root conflict is resolved and P1/P2 are integrated. P3A defines route-set and
participant-only selection authority while P8A independently establishes WebMCP feature detection,
registration, read-only tools, and the deterministic harness. P3B builds the human journey on the
frozen P3A contract. P8B joins those paths for ChatGPT collaboration; P8C admits the immutable
candidate. P4-P7 and P10 complete the product after submission. P9 optional AI SDK/OpenCode Go Luna
inference is not part of candidate completion; EVE has no admitted packet.

## 14. Open decisions

1. Who is the named qualified reviewer for distress copy?
2. Which five adults commit to testing?
