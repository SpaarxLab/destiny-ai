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

## Documents

| File | Audience | Role |
|---|---|---|
| `README.md` | everyone | this — the short notes |
| `SPEC.md` | Harsh + team/build agents | current product and system contract |
| `PLAN.md` | team | approved ownership, gates, dependency packets, and four-week sequence |
| `SYSTEM_REVIEW.md` | Harsh + team | specialist verdict, findings, recent-chat connection, and doubts |
| `DECISIONS.md` | everyone | accepted defaults and the few remaining owner choices |
| `TEAM.md` | team | lane ownership, integration order, and working agreement |
| `SAFETY_AND_PRIVACY.md` | team + reviewer | adult-only, local-only, distress, and privacy boundary |
| `CONTRIBUTING.md` | contributors | setup, branch, PR, and integration workflow |
| `METHOD.md` | the visiting runtime agent | served verbatim by `get_method_guide` — the skill layer |
| `VOCABULARY.md` | everyone | canonical contract language and naming rules |
| `boards.html` | humans | historical visual explainer; revised text follows this contract |

## Status

The system contract and foundation plan are approved. One canonical repository now contains
the plans and the application; the previous nested history is preserved in `RECOVERY.md`.
P1 Command Spine is implemented on its packet branch and is undergoing integration review.
It proves one governed `save_reflection` path through the participant UI and deterministic
test adapter. Participant testing remains blocked until Harsh names the safeguarding reviewer
and records five adult commitments.
