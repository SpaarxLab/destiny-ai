# Destiny.AI — Specialist System Review

**Verdict:** `PARTIAL` — unusually strong concept and agent-facing instincts, but not yet
safe for parallel implementation.
**Reviewed:** 2026-09-01 against `PROJECT_STATE.md`, `SPEC.md`, `PLAN.md`, `METHOD.md`,
`VOCABULARY.md`, `boards.html`, the current scaffold, and the recent WebMCP/Destiny.AI chats.
**Authority:** this is the historical review receipt, not a replacement product contract.
`SPEC.md`, `DECISIONS.md`, and `PROJECT_STATE.md` carry current authority; the plan was
still a team-discussion draft at the time of this review.

## What the recent chats actually established

The direction changed in four important steps:

1. The team first compared investment, travel, support, creator, and education ideas.
2. Under a two-day competition constraint, SaaS support was the pragmatic recommendation.
3. Harsh then explicitly removed feasibility as the deciding factor and made deep learning
   about agents, WebMCP, and exceptional product building the primary goal.
4. The career-learning direction became the chosen ambitious wedge, and Harsh accepted the
   narrow MVP: a stuck student moves from reflection to experiments and an editable plan.

That supports Destiny.AI as the current product direction. It does **not** support therapy,
career prediction, eight internal agents, or a lifetime learner model as MVP scope.

## What is already excellent

- The agent visits; the product owns state, rules, and tools.
- The board—not chat—is the shared working object.
- Phase-gated capability discovery is memorable and easy to demonstrate.
- Ghosts preserve human authorship and make rejection useful.
- Evidence-linked belief revision is a real product invariant, not prompt decoration.
- A method guide separates available actions from good operating technique.
- Cold-start orientation, explicit affordances, typed errors, and compact reads directly
  reduce agent guesswork and token use.

## Critical findings

### C1 — two conflicting persistence architectures

The architecture section described server routes and server persistence while the stack
declared localStorage with no server round-trip. A team could implement two writers and two
sources of truth. The revised spec chooses one MVP authority: a versioned local workspace
written only through the shared command kernel. WebMCP and UI are adapters.

### C2 — adaptive trust was unsafe and internally inconsistent

Ghost tools already require human review, so “two rejections demote to proposal-only” did not
define a meaningful change. Restoring trust after one acceptance was also too easy to game,
and tool-level history cannot establish the identity or reliability of a new visiting agent.
The revised design makes accretion improve context and proposals only. Authority remains fixed
by phase, command policy, and explicit human action.

### C3 — retries and success proof were incomplete

Only proposal tools had idempotency, even though any mutation can time out after taking
effect. Every write now requires `operationId` plus `expectedVersion`; replay returns the
original receipt. A successful tool response carries the authoritative after-version and
changed references.

### C4 — “registered means permitted” was too weak

An agent can cache a catalogue and page lifecycles can race. Phase-based registration remains
excellent for discoverability, but the command kernel must enforce the current phase,
resource lifecycle, and approval on every call.

### C5 — taste and narrative could become hidden, lossy authority

Free-text `tasteProfile` and `storySoFar` did not define who writes them, how they are
corrected, or what happens when they contradict source events. The revised model preserves
raw human decisions and receipts, derives bounded projections, attaches provenance, surfaces
conflicts, and allows teachings to be superseded. No summary can overwrite evidence.

### C6 — evidence could influence the system before human confirmation

Agent-transcribed evidence was immediately writable while only displaying a review chip.
Evidence now has proposed/confirmed status; only confirmed evidence can support a revision.
Hypothesis changes are proposed revisions, not silent direct updates.

### C7 — the long-lived swipe tool was operationally brittle

Waiting inside one tool call for a person to finish can exceed agent/browser timeouts. The
tool now opens a visible interaction and returns `AWAITING_HUMAN`; a later workspace read
reports completion. Swipe latency is telemetry, not evidence of career preference.

### C8 — the declared canonical repository is not a repository

`~/career-lab` contains the authority documents, but only `~/career-lab/web` has Git history.
Parallel implementation would leave plans and code under different change control. This is a
hard Gate 0 decision; the review did not move or initialize repositories.

## Important findings

- Semantic IDs should be short human references, not the database identity. Stable internal
  IDs prevent collisions; readable refs reduce agent mistakes.
- “Everything undoable” should mean compensating operations with preserved history. Audit
  receipts are never erased, and irreversible external sends remain human-only.
- `read_workspace` had contradictory inputs (`{}` versus `detail`). It now has one bounded,
  cursor-aware read contract.
- The lab metaphor should stabilize domain language, not force awkward copy. The UI may say
  “You” while schemas and tools use one canonical noun.
- Tool annotations are hints. They are never enforcement.
- A local-only workspace still needs schema migrations, clear/export/delete, quota/corruption
  recovery, and explicit data-loss language.

## Doubts requiring Harsh or the team

1. Should the MVP recruit only adults? This review recommends 18+ until a minor-specific
   consent and safeguarding design exists.
2. Which directory becomes the one Git root, and who owns integration?
3. Who are the five reachable participants? Names are stronger than a target number.
4. What later submission date is real enough to plan backwards from?
5. Who approves the distress redirect and privacy copy?
6. Does every teammate have access to at least one real WebMCP runtime, or is one person the
   runtime owner?
7. Does “local-only” remain acceptable for the entire challenge candidate? If not, a server
   migration is a separate post-MVP packet, not a mid-build substitution.

## Minimal admission decision

Approve Gate 0 and packets P1-P2 first. Do not approve all four weeks as one undifferentiated
batch. The first honest success is one shared command, one receipt, one rendered after-state,
and one cold-agent orientation fixture—not 11 registered tools.
