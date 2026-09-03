# STING

**Your AI says it knows you. STING makes it bet, chip by chip, before every tap.**

---

## 60-second how to play

1. Open the live URL **inside ChatGPT's built-in browser** (desktop app, model **GPT-5.6 Sol** or **GPT-5.6 Terra** — GPT-5.6 Luna and Enterprise/Edu workspaces do not expose site tools). Tap **Play**, then say "play STING with me." The page waits for your agent — "waiting for your agent" — and never plays over it; if it doesn't show up you can pick "Play Spark instead" or "Play the house instead." Or:
2. Open it in **Chrome 149+** with `chrome://flags/#enable-webmcp-testing` set to Enabled (relaunch Chrome), then drive it with a WebMCP-capable extension such as the Model Context Tool Inspector.
3. To call a tool by hand and watch a denial happen: **DevTools → Application → WebMCP** lists every registered tool on the page; invoke one directly with a bad `expectedVersion` and watch the kernel return `STALE_VERSION`.

During the duels your agent plays **captain**: one model call a turn chooses to bet, ask its one question, or close — the kernel denies any illegal choice and hands the turn to the house if it can't recover. Most of its moves can carry an **aside**, a short line spoken to you on the page before you act, never revealing what it staked.

No typing, no account. If no agent connects, the house plays instead — the whole match works with zero network calls.

---

## WebMCP in this repo

STING registers its tool catalogue with the browser's native `document.modelContext` API and re-registers it every time the phase, tier, kills, rules, or letter status changes, so the agent's authority visibly grows and shrinks on the wire. The real registration call, copied from [`web/src/sting/webmcp.ts`](web/src/sting/webmcp.ts) (`StingWebMcp.replace`, lines 589–616):

```ts
for (const tool of createStingTools(ws, this.deps)) {
  const wrapped: WebMcpToolDefinition = {
    ...tool,
    execute: async (input) => { /* passport stamp + abort + error handling */ },
  };
  try {
    await this.context.registerTool(wrapped, { signal: controller.signal });
    this.names.push(tool.name);
  } catch (error) {
    this.failure = `${tool.name}: ${error instanceof Error ? error.message : String(error)}`;
  }
}
```

Every abort on `controller.signal` unregisters the previous catalogue, and every successful `registerTool` fires the browser's `toolchange` event — so a miss, a kill, or a bust is not just a message on screen, it is tools disappearing from Chrome's own tool inspector. See [`web/src/sting/webmcp.ts`](web/src/sting/webmcp.ts) in full, and the adapter it sits on in [`web/src/webmcp/runtime.ts`](web/src/webmcp/runtime.ts).

### Tool table (all nine, as currently registered)

| Tool | Exists when | What it can never do |
|---|---|---|
| `inspect_room` | always, from the door onward, every standing including silenced | mutate anything; tap, kill, crown, set limits, accept a dare, or check in for the person |
| `stage_cast` | cast phase, before eight lives are on the table | recast a life the person already killed |
| `stage_duel` | duel phase; no open tap/question, no uncorrected miss, fewer than nine answered duels | edit a sealed bet after the commitment is shown; stage a duel that changes more than one thing (`DUEL_NOT_ISOLATED`) |
| `propose_hypothesis` | cast/duel (`cold_read`, `revision`); verdict (`hunger`/`mask`/`edge`) once standing is past probation | describe the person before it has earned the right; re-propose or paraphrase anything the person killed (`KILLED`) or ruled out (`rules of me`); use label or prediction language ("you are a...", "you will...") |
| `ask_once` | duel or verdict, once per match, costs 1 chip | ask a second question, or ask anything open-ended — it must supply exactly three answers |
| `present_evidence` | fight, once the verdict is kept | crown a hunger — only the person's tap decides the winner |
| `stage_route_auditions` | lives phase, once the fight is settled | replace a life the person did not explicitly set aside; stage anything but exactly three |
| `propose_experiment` | dare phase, before a dare exists | propose an irreversible dare (quit, resign, move, marry, borrow — `NOT_REVERSIBLE`); set the person's hours/money limits, or act at all once the dare is accepted, since every write tool leaves the catalogue on acceptance |
| `seal_letter` | card phase, dare accepted, no letter sealed yet | be read by anyone, including the sealing agent, before the dare's due date — contents stay blanked in every projection until then |

`docs/STING.md` §9 is the full contract for all nine. §23 documents which WebMCP-native concepts beyond these nine tools are shipped and which are still design candidates.

### Rules the kernel enforces

- **`operationId` replay** — every write is idempotent by `operationId`; replaying one returns the original receipt instead of doing the work twice.
- **`expectedVersion`** — every write must name the state version it read; a mismatch is denied `STALE_VERSION`, never silently applied.
- **Sealed bets and letters** — a bet's or letter's commitment (`sha256(payload ‖ operationId)`, truncated) is shown before the tap; the sealed value itself stays out of every participant- and agent-facing projection until it is revealed.
- **Participant-only moves** — no tool taps, kills, crowns, sets limits, accepts a dare, checks in, or opens a letter on the person's behalf; the kernel denies it `PARTICIPANT_ONLY`.
- **Hash-chained receipts** — every write appends a receipt carrying a hash of the previous one, so an export can be checked for tampering after the fact.
- **Catalogue shrinks with standing and phase** — a miss removes `stage_duel` until a `revision` lands; a bust leaves only `inspect_room`. Each change re-registers the catalogue and fires `toolchange`.
- **Demo clock** — append `?clock=+7d` to the URL to shift the room's clock forward, so a sealed letter can be opened without waiting a real week; the strip then reads "… · demo clock".

---

## Local dev

```bash
cd web && npm i && npm run dev
```

Environment variables (all optional):

| Var | Effect |
|---|---|
| `OPENCODE_GO_API_KEY` | enables the optional local lab assistant as a solo-mode house replacement; unset means the deterministic house plays |
| `STING_PLAYER` | set to `off` to force the house even with a key present |
| `STING_PLAYER_MODEL` | overrides the lab assistant's model name |

## Test commands

```bash
cd web
npm run typecheck   # next typegen && tsc --noEmit
npm run test        # vitest
npm run test:browser     # playwright: the whole house match in Chromium (cast → card → sealed letter opened under ?clock=+8d)
npm run test:chrome      # playwright: REAL Chrome 149+ with the WebMCP flag, calling the tools through document.modelContext
                         #   (start `npm run build && npx next start -p 3111` first)
npm run test:sting-live  # playwright: a live Spark (Muse Spark 1.3) match against the server on 3111
npm run test:live        # playwright against a deployed URL
npm run check        # test + lint + typecheck + build
```

---

## Built during the submission window

The first commit in this repository's history is `2026-09-01` (`git log --reverse`), inside the OpenAI WebMCP Challenge submission window (Aug 25 – Sep 3, 2026). Everything here, including this README, was written during that window.

The pre-STING prototype lives at [`/legacy`](web/src/app/legacy/page.tsx) for reference only; it is not part of this submission.

## License

MIT. See [`LICENSE`](LICENSE).

Design authority: [`docs/STING.md`](docs/STING.md). Submission kit: [`docs/SUBMISSION.md`](docs/SUBMISSION.md). Deploy steps: [`docs/DEPLOY.md`](docs/DEPLOY.md).
