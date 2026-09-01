# Destiny.AI — Product and System Contract

**Status:** Current product/technical authority, revised 2026-09-01.
**Build admission:** P1 implementation approved with Devarsh, Tirth, and Harsh owning separate
lanes. Participant research remains reviewer- and recruitment-gated.
**Supersedes:** the original Destiny.AI brainstorm, the red/green whiteboards, the eight
internal-agent concept, and the pre-review architecture in this file.
**Review receipt:** `SYSTEM_REVIEW.md`.

## 1. Product promise

A shared workspace where a career-stuck participant and a visiting AI agent turn confusion
into quoted hypotheses, run one cheap real-world experiment, confirm what happened, and
revise direction from evidence.

**Thesis:** direction is not predicted and is not found through endless introspection. It is
reduced through small, reversible experiments against the real world. The agent is a lab
assistant; the participant owns the question, approvals, evidence, and real-world action.

The smallest complete loop is:

`confusion -> reflection -> hypothesis ghost -> experiment ghost -> confirmed evidence -> revision ghost`

## 2. Binding invariants

1. **We do not build the reasoning agent.** A browser agent visits. Destiny.AI supplies the
   workspace, governed capabilities, method, and proof.
2. **One state authority.** The MVP workspace is one versioned local document. UI and WebMCP
   invoke the same command kernel; neither writes storage directly.
3. **The board is the shared object.** Agent-visible facts are inspectable by the participant.
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
- reflections, hypotheses, experiments, evidence, revisions, week plan, outbox, activity;
- human-only phase gates and real-world sends;
- visiting-agent WebMCP tools, method guide, compact orientation, typed errors, receipts;
- explicit human teachings from accept/edit/reject/correct actions;
- deterministic fixtures, command tests, browser journeys, and live runtime proof.

### Deferred

- authentication, server database, multi-person workspaces, sync, background agents;
- resource/opportunity search, portfolio generation, embedded chatbot, Gmail/Calendar;
- a career knowledge store, internal reflection/plan agents, automatic nudges;
- automatic model-written taste summaries that become active without review.

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

## 6. Journey and authority

| Phase | Discoverable tools | Human-only gate |
|---|---|---|
| all phases | `read_workspace`, `get_method_guide` | — |
| `EXPLORING` | `save_reflection`, `start_swipe_session`, `propose_hypothesis` | Confirm hypothesis set |
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

interface Hypothesis extends AgentAddressable {
  status: GhostStatus | 'testing' | 'supported' | 'weakened' | 'refuted' | 'parked';
  claim: string;
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
targeted entities per read. Internal replay identities are never projected. The serialized
orientation is capped at 6,000 characters, with a conservative 1,500-token estimate at four
characters per token; truncation is explicit and callers can follow with targeted reads.

### 8.2 Affordances

Every addressable entity returns:

```ts
interface AvailableAction {
  tool: ToolName;
  targetRef: string;
  effect: 'READ' | 'PREPARE_UI' | 'PROPOSE';
  requiresHuman: boolean;
  reason?: string;
}
```

The agent selects from declared actions instead of inferring lifecycle rules. Descriptions
never advertise unavailable actions.

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

On a lost response, the agent retries with the same `operationId`. The command ledger
returns the original receipt. On `STALE_STATE`, it re-reads and creates a new operation only
after reconsidering the new state.

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
| `start_swipe_session` | exploring | PREPARE_UI | participant completes UI | yes |
| `propose_hypothesis` | exploring | PROPOSE | accept/edit/reject | yes |
| `propose_experiment` | testing | PROPOSE | accept/edit/reject | yes |
| `schedule_action` | testing | PROPOSE | confirm day/duration | yes |
| `draft_outreach` | testing | PROPOSE | edit/copy/send manually | yes |
| `log_evidence` | testing | PROPOSE | confirm observation/relation | yes |
| `propose_hypothesis_revision` | reviewing | PROPOSE | accept/edit/reject | yes |
| `propose_verdict` | reviewing | PROPOSE | confirm outcome | yes |

Catalogue rules:

- all nine state-changing/preparing tools include `WriteControl`;
- `get_method_guide` returns `methodVersion` and the current `contractVersion`;
- proposal inputs use refs, bounded strings/enums/numbers, and `additionalProperties: false`;
- every proposal declares which accepted entity it extends;
- only confirmed evidence belonging to the hypothesis's experiments can support a revision;
- `draft_outreach` has no send counterpart anywhere in the product;
- `start_swipe_session` returns immediately with `AWAITING_HUMAN`; completion appears in
  a later read. Swipe latency is interaction telemetry, not a career signal;
- a phase change aborts old registrations, but cached invocations are still command-denied.

Tool handlers are mechanically thin:

```ts
async function executeWebMcpTool(input: unknown) {
  const command = parseToolInput(input);
  const result = commandKernel.execute(command);
  renderAuthoritativeState(result.stateVersion);
  return toWebMcpResult(result);
}
```

## 10. Human workspace

1. **Board:** active hypotheses, experiments, and evidence; ghosts are visually distinct.
2. **Week:** accepted plan items and honest pending/confirmed/done/missed states.
3. **Outbox:** drafts with edit/copy/mailto; no automated send.
4. **Activity:** receipts, human/agent attribution, teaching sources, compensation history.
5. **Agent status:** runtime detected/not detected, current phase, pending interaction.
6. **Teach agent:** card/workspace correction that becomes a sourced teaching only after the
   participant confirms it.
7. **Privacy:** local-only explanation, export, import preview, clear, and recovery guidance.
8. **No-agent mode:** the complete core loop remains usable by hand.

The UI may use “You” in participant-facing copy. Canonical schema/tool nouns remain stable;
the metaphor must not make the product harder for a distressed or uncertain person.

## 11. Persistence and recovery

- Next.js + TypeScript; shared Zod schemas; one client command kernel.
- One versioned local workspace in localStorage for the challenge MVP.
- Each accepted command atomically writes the next snapshot and receipt.
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

### Runtime and release proof

Verify the same immutable candidate separately in:

1. deterministic adapter harness;
2. Chrome with the required experimental access;
3. ChatGPT in-app browser;
4. deployed URL readback with candidate SHA/contract/schema identity and rollback.

Report the highest proof actually observed. Local tests are not browser, deployed, user,
competition, or production proof.

## 13. Delivery authority

The dependency-ordered team programme, ownership lanes, packet gates, and daily sequence live
in `PLAN.md`. It is intentionally separate from this product/system contract.

The repository-root conflict is resolved and P1 is admitted. The first product outcome remains
the command spine and cold orientation—not the whole catalogue.

## 14. Open decisions

1. Who is the named qualified reviewer for distress copy?
2. Which five adults commit to testing?
