# Destiny.AI

**Find one direction worth testing next.** Destiny.AI guides a career-stuck adult from “I do not
know what to do” to three grounded routes. ChatGPT leads the conversation. The Route Room shows the
person's own words, what ChatGPT proposed, and the one route the person chose.
Built for the OpenAI WebMCP Challenge.

The candidate does not require an embedded model. ChatGPT is the visiting agent; Destiny.AI
provides the governed WebMCP capabilities and shared state. AI SDK/OpenCode experiments are
optional after the WebMCP candidate, not a prerequisite for it.

The competition candidate demonstrates a visible WebMCP collaboration: ChatGPT reads confirmed
words, proposes three routes through the site's own command kernel, the participant repairs and
chooses one, and ChatGPT reads the accepted result back. It proposes a seven-day test idea; it does
not claim that the test ran.

**Development repository:** private [`SpaarxLab/destiny-ai`](https://github.com/SpaarxLab/destiny-ai).

## The idea in 5 lines (humans)

1. Start with a guided choice, not a blank box.
2. ChatGPT uses the person's confirmed words to propose Closest, Bridge, and Probe routes.
3. Every route respects a real constraint and contains one small test idea.
4. The person can repair or reject the suggestions, then chooses once. The AI cannot choose.
5. The website and ChatGPT stay in sync through WebMCP, the shared command kernel, and receipts.

## The idea in 5 lines (agents)

1. Call `read_workspace`, then `get_method_guide` once.
2. Call `propose_route_set` only with exact confirmed quote references and recorded caps.
3. Every write carries `operationId` and `expectedVersion`; retry uncertain results with the
   same operation id, and re-read on `STALE_STATE`.
4. Never call participant-only `revise_route_set` or `choose_route`.
5. Reread after the participant acts. Do not predict, rank, or fabricate a route.

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
