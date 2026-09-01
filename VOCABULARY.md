# Career Lab — Canonical Vocabulary

Stable nouns reduce agent mistakes and contract drift. They do not force awkward human copy:
the UI may say “You” while schemas and tools use the canonical term.

| Canonical term | Contract meaning | Avoid in contracts |
|---|---|---|
| **Participant** | person who owns the question, approvals, evidence, and action | patient, subject |
| **Lab assistant** | visiting reasoning agent with governed tools | boss, therapist, predictor |
| **Board** | shared, inspectable workspace | agent memory, hidden context |
| **Orientation** | compact derived view for a cold/resuming agent | secret prompt, Baton |
| **Hypothesis** | falsifiable claim citing participant words | recommendation, destiny |
| **Experiment** | cheap, bounded real-world falsification attempt | quest, assignment |
| **Evidence** | participant-confirmed observation linked to an experiment | model opinion |
| **Ghost** | agent proposal awaiting participant action | completed item |
| **Revision** | proposed confidence/rationale change citing confirmed evidence | silent update |
| **Verdict** | participant-confirmed supported/weakened/refuted/parked outcome | prediction |
| **Teaching** | sourced, scoped participant instruction for future agent work | inferred personality |
| **Receipt** | durable record of one applied/proposed/prepared/compensated operation | log line |
| **Compensation** | new operation that reverses a reversible effect without erasing history | delete history |
| **Outbox** | editable outreach draft; sending remains human-only | sending queue |
| **Phase** | EXPLORING, TESTING, or REVIEWING | permission guess |
| **Gate** | participant-only phase transition | agent tool |
| **Available action** | declared legal action for a specific entity and state | suggestion |
| **State version** | monotonic workspace version used for concurrency | timestamp |
| **Operation ID** | caller key for one intended effect and safe retry | entity ID |
| **Ref** | short stable address used by people and agents | display title |

## Naming rules

- Tool names use verbs plus canonical nouns: `propose_experiment`,
  `propose_hypothesis_revision`, `log_evidence`.
- Proposals are never named as completed effects.
- Internal `id`, agent-facing `ref`, and participant-facing title are distinct.
- “Taste” is not a canonical fact. Preserve explicit accept/edit/reject/correct receipts and
  activate only sourced participant teachings.
- “Trust” is not an automatic permission score. Authority comes from phase, command policy,
  and explicit participant action.
