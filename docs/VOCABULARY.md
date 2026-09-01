# Destiny.AI — Canonical Vocabulary

Stable nouns reduce agent mistakes and contract drift. They do not force awkward human copy:
the UI may say "You" while schemas and tools use the canonical term.

| Canonical term | Contract meaning | Avoid in contracts |
|---|---|---|
| **Participant** | person who owns the question, approvals, evidence, and action | patient, subject |
| **Lab assistant** | a visiting or embedded reasoning agent with governed tools; in the UI, "the lab assistant" names the optional embedded proposal source | boss, therapist, predictor |
| **Route Room** | the shared, inspectable workspace as the person sees it | agent memory, hidden context |
| **Orientation** | compact derived view for a cold/resuming agent | secret prompt, Baton |
| **Confirmed words** | participant-confirmed reflection text with refs; the only text a proposal may quote | notes, transcript |
| **Limits** | recorded `costCaps` (hours per week, money, currency) set through `set_limits`; every test must fit inside them | caps guessed by the agent |
| **Follow-up question** | one receipted agent question asked instead of guessing; answered, skipped, or withdrawn by later events | clarification chat |
| **Hypothesis** | falsifiable claim citing participant words | recommendation, destiny |
| **Route** | one of three previews (closest, bridge, probe) with quote, limit, learning question, and small test | option, ranking |
| **Carried route** | a kept route copied unchanged into a superseding set with `carriedFromRouteRef`; only set-aside routes may be replaced | overwrite |
| **Experiment** | cheap, bounded real-world falsification attempt | quest, assignment |
| **Evidence** | participant-confirmed observation linked to an experiment | model opinion |
| **Ghost** | agent proposal awaiting participant action | completed item |
| **Revision** | proposed confidence/rationale change citing confirmed evidence | silent update |
| **Verdict** | participant-confirmed supported/weakened/refuted/parked outcome | prediction |
| **Teaching** | sourced, scoped participant instruction for future agent work (P6) | inferred personality |
| **Receipt** | durable record of one applied/proposed/prepared/compensated operation | log line |
| **Activity** | plain sentences built from receipts plus this session's agent reads and denials ("What happened") | analytics |
| **Agent view** | the exact orientation projection shown to the participant ("See what ChatGPT sees") | debug dump |
| **Compensation** | new operation that reverses a reversible effect without erasing history | delete history |
| **Reopen** | participant-only `reopen_exploring` that parks the accepted hypothesis and returns to exploring | undo, delete |
| **Outbox** | editable outreach draft; sending remains human-only (P7) | sending queue |
| **Phase** | EXPLORING, TESTING, or REVIEWING | permission guess |
| **Gate** | participant-only phase transition | agent tool |
| **Available action** | declared legal action for a specific entity and state | suggestion |
| **Proposal availability** | the projection's answer to "may the agent propose now, and how" (`fresh` or `replace_rejected`) | vibe |
| **Declarative draft form** | the `draft_words` WebMCP form: an agent may fill the box, never submit it | autofill |
| **Simulator** | the eval-only visiting-agent loop over an injected tool catalogue | production agent |
| **State version** | monotonic workspace version used for concurrency | timestamp |
| **Operation ID** | caller key for one intended effect and safe retry | entity ID |
| **Ref** | short stable address used by people and agents | display title |

## Naming rules

- Tool names use verbs plus canonical nouns: `propose_route_set`, `propose_experiment`,
  `log_evidence`. Declarative form tools use the same style: `draft_words`.
- Proposals are never named as completed effects.
- Internal `id`, agent-facing `ref`, and participant-facing title are distinct.
- "Taste" is not a canonical fact. Preserve explicit accept/edit/reject/correct receipts and
  activate only sourced participant teachings.
- "Trust" is not an automatic permission score. Authority comes from phase, command policy,
  and explicit participant action.
- Activity summaries shown to the participant never contain tool names or version jargon beyond
  the receipt line.
