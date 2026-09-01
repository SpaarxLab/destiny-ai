# Destiny.AI

**Find one direction worth testing next.** Destiny.AI is a governed decision lab for adults who
feel stuck. You answer a few questions in your own words and set your limits. ChatGPT reads the
same Route Room through WebMCP and proposes three different routes, Closest, Bridge, and Probe,
each quoting your exact words and each with a small reversible test. It cannot choose for you. You
edit, set aside, or choose one, and every move by either of you leaves a receipt you can both read.
Built for the OpenAI WebMCP Challenge.

The candidate does not require an embedded model. ChatGPT is the visiting agent; Destiny.AI
provides the governed WebMCP capabilities and shared state. An optional embedded lab assistant
(AI SDK, any OpenAI-compatible endpoint) is disabled by default and never a prerequisite.

**Development repository:** [`SpaarxLab/destiny-ai`](https://github.com/SpaarxLab/destiny-ai).

## The idea in 5 lines (humans)

1. Start with a guided choice, not a blank box. Confirm your words and your limits.
2. ChatGPT reads your room and either proposes Closest, Bridge, and Probe routes or asks you one
   question first. It never guesses when your words are too thin.
3. Every route quotes your exact words, respects your limits, and contains one small test. Point at
   a route and the words it quotes light up.
4. Set a route aside and ChatGPT may replace only that one; the routes you kept are carried over
   unchanged. You choose once. The AI cannot choose.
5. "What happened" lists every move with its receipt. "See what ChatGPT sees" shows the exact view
   the agent reads. Your private notes are never in it.

## The idea in 5 lines (agents)

1. Call `read_workspace` (orientation), then `get_method_guide` once. Quote only exact substrings of
   `confirmedWords[].text`; keep every test inside `focus.costCaps` and seven days.
2. If `proposal.available` is true, call `propose_route_set`. Cite `proposal.supersedesRouteSetRef`
   when it is not null; when `proposal.mode` is `replace_rejected`, send `{ carryRouteRef }` for
   every kept route and fresh routes only for `replaceKinds`.
3. If the words are too thin, send `outcome: insufficient_signal` with one focused follow-up
   question; it is receipted and shown to the participant. Reread after they answer or skip.
4. Every write carries `operationId` and `expectedVersion`; retry an uncertain result with the same
   operation id, and reread on `STALE_STATE`.
5. Never call participant-only actions. Reread after the participant acts and report exactly what
   `latestChange` says. Do not predict, rank, or fabricate.

## Try it in three minutes (judges)

In the ChatGPT in-app browser (desktop app), or in Google Chrome with `chrome://flags/#enable-webmcp-testing`
set to Enabled and relaunched:

1. Open the live URL. The badge in the header reads "Agent connected" when WebMCP is available.
2. Press "Start", pick a shape of stuck, answer the three questions in your own words, confirm
   them, and set your limits (for example 3 hours a week, 500 INR). Nothing has left your browser.
3. On "Your words are ready", ask the agent: **"Read my Destiny room and propose three routes."**
   The room updates by itself with a "Proposed by ChatGPT" chip and a receipt line. If the agent
   asks a question first, answer it in the card and ask again.
4. Set one route aside, then ask: **"Replace the route I set aside."** The two routes you kept show
   "Kept from your last set"; the new one shows "Replaced by ChatGPT". Ask it to replace a route you
   kept and watch the room decline it visibly.
5. Choose one route, then ask: **"What did I decide?"** The agent rereads and reports the receipt.
   Open "What happened" and "See what ChatGPT sees" to compare.
6. "Start over" clears the room for the next person and says exactly what it removes.

Human mode (no agent) offers "Draft my own three routes" so the whole loop also works by hand.

## Run locally

```bash
cd web
npm ci
npm run dev                 # http://localhost:3000
npm run check               # vitest, eslint, typecheck, production build
npx playwright test tests/journey.spec.ts
npx playwright test -c playwright.live.config.ts   # real Google Chrome with WebMCP enabled; requires Chrome installed
```

Use Node 24. The live suite starts its own dev server on port 3101 and launches Google Chrome
(channel `chrome`) with the WebMCP testing flag persisted in a temporary profile.

### Optional lab assistant

Disabled by default. To enable, copy `web/.env.example` to `web/.env.local` and set:

```
LAB_ASSISTANT_PROVIDER=openai_compatible   # or fake (deterministic test double) or disabled
LAB_ASSISTANT_BASE_URL=<OpenAI-compatible /v1 base URL, e.g. OpenCode Go>
LAB_ASSISTANT_API_KEY=<key, optional>
LAB_ASSISTANT_MODEL=<model id>
LAB_ASSISTANT_LABEL=Lab assistant
```

`GET /api/lab-assistant/status` reports `{ enabled, label, provider }`. The handoff screen shows
"Ask the lab assistant" only when enabled and sends your confirmed words only after you tick the
consent sentence. The server drafts, checks the draft against your words and limits, and returns
it; your browser submits it through the same command kernel as ChatGPT's proposals.

## Where things live

Five living documents at the root, reference material in `docs/`, history in `docs/archive/`.

| Read this | When you want |
|---|---|
| `README.md` | the vision and how to try it |
| `PROJECT_STATE.md` | what is current, what is next, what is blocked |
| `SPEC.md` | the product and system contract (the authority) |
| `AGENTS.md` | rules for build agents working in this repository |
| `CONTRIBUTING.md` | team lanes, workflow, setup, and definition of done |
| `docs/HOW_IT_WORKS.md` | the teaching guide: agents, MCP and WebMCP, our architecture, the kernel, the frontend, the lab assistant, the simulator, the tests |
| `docs/PLAN.md` | the approved delivery programme and packet sequence |
| `docs/DECISIONS.md` | accepted decisions and the few remaining owner choices |
| `docs/METHOD.md` | the visiting agent's operating method (served by `get_method_guide`) |
| `docs/VOCABULARY.md` | canonical contract nouns and naming rules |
| `docs/SAFETY_AND_PRIVACY.md` | adult-only, local-only, distress, and privacy boundary |
| `docs/packets/` | one receipt per delivery packet |
| `docs/archive/` | superseded history, never current authority |

Live execution status (tickets, owners, blockers) lives in
[Linear](https://linear.app/harsh-shah/project/destinyai-build-and-proof-5987c83d1c4c/overview),
not in repository markdown.

## Status

See `PROJECT_STATE.md`, the only file that answers "where are we right now."
