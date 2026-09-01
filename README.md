# Destiny.AI

**A lab for career confusion.** A career-stuck participant and a visiting AI agent share one
board: the participant reflects, the agent proposes quoted hypotheses, they run one cheap
real-world experiment, and confidence can move only through confirmed evidence.
Built for the OpenAI WebMCP Challenge.

**Development repository:** private [`SpaarxLab/destiny-ai`](https://github.com/SpaarxLab/destiny-ai).

## The idea in 5 lines (humans)

1. Direction is reduced through cheap experiments, not predicted. The AI is the lab
   assistant; the participant owns the question and every consequential decision.
2. The AI has no hands: it acts only through typed WebMCP tools the page exposes, and
   everything it does appears live on the shared board, undoable.
3. **The journey shapes the capability surface**: tools register/unregister as the
   participant moves through EXPLORING → TESTING → REVIEWING. Phase changes are human-only
   buttons, while the command kernel enforces the current state on every call.
4. Agent output lands as **ghosts** the participant accepts, edits, or rejects. Corrections
   can become sourced, scoped teachings for the next visiting agent.
5. Learning improves future proposals, never permissions. Anything touching the real world
   (such as sending outreach) remains the participant's hand.

## The idea in 5 lines (agents)

1. Call `read_workspace` for compact orientation, then `get_method_guide` once.
2. Follow each entity's `availableActions`; do not infer permissions.
3. Every write carries `operationId` and `expectedVersion`; retry uncertain results with the
   same operation id, and re-read on `STALE_STATE`.
4. Only confirmed evidence can support a proposed revision. Every success returns a receipt.
5. Speak through the board. One traceable real-world learning loop is success.

## Where things live

Four living documents at the root, reference material in `docs/`, history in `docs/archive/`.

| Read this | When you want |
|---|---|
| `README.md` | the vision — this file |
| `PROJECT_STATE.md` | what is current, what is next, what is blocked |
| `SPEC.md` | the product and system contract (the authority) |
| `AGENTS.md` | rules for build agents working in this repository |
| `CONTRIBUTING.md` | team lanes, workflow, setup, and definition of done |
| `docs/PLAN.md` | the approved delivery programme and packet sequence |
| `docs/DECISIONS.md` | accepted decisions and the few remaining owner choices |
| `docs/METHOD.md` | the visiting agent's operating method (served by `get_method_guide`) |
| `docs/VOCABULARY.md` | canonical contract nouns and naming rules |
| `docs/SAFETY_AND_PRIVACY.md` | adult-only, local-only, distress, and privacy boundary |
| `docs/packets/` | one receipt per delivery packet |
| `docs/archive/` | superseded history — never current authority |

Live execution status (tickets, owners, blockers) lives in
[Linear](https://linear.app/harsh-shah/project/destinyai-build-and-proof-5987c83d1c4c/overview),
not in repository markdown.

## Status

See `PROJECT_STATE.md` — the only file that answers "where are we right now."
