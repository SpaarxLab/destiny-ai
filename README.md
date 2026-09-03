# STING

**Your AI says it knows you. STING makes it bet, chip by chip, before each duel choice.**

**Live demo:** [sting-webmcp.vercel.app](https://sting-webmcp.vercel.app)

**Public source:** [github.com/SpaarxLab/destiny-ai](https://github.com/SpaarxLab/destiny-ai)

---

## 60-second how to play

1. Open the [live demo](https://sting-webmcp.vercel.app) **inside ChatGPT's built-in browser**. Tap **Play**, then say “play STING with me.” The page waits for your agent and never makes a human choice for you. If Site tools are unavailable in that chat, choose **Play the house instead**; the same complete match runs from the browser's saved room with deterministic house moves.
2. Open it in **Chrome 149+** with `chrome://flags/#enable-webmcp-testing` set to Enabled (relaunch Chrome), then drive it with a WebMCP-capable extension such as the Model Context Tool Inspector.
3. To call a tool by hand and watch a denial happen: **DevTools → Application → WebMCP** lists every registered tool on the page; invoke one directly with a bad `expectedVersion` and watch the kernel return `STALE_VERSION`.

During the duels the optional in-page model player acts as **captain**: one model call chooses whether to bet or spend its one question; closing a completed duel run is deterministic. An external WebMCP agent chooses among the creative tools registered for the room. After the cast taps it must seal a `cold_read` before `stage_duel` or `ask_once` appears. The kernel denies illegal moves. Only `stage_cast` and `ask_once` expose an optional **aside** on the WebMCP wire; sealed cold reads, duel bets and letters do not.

No typing required, no account. The core match is tap-only; adding a personal rule is optional. If no agent connects, the house plays instead — the match uses zero model-provider calls and keeps its state in the browser.

---

## WebMCP in this repo

STING registers its tool catalogue with the browser's native `document.modelContext` API. It requests a sync on every room change and replaces the native catalogue only when the effective tool set or its dynamic descriptions change, so the agent's authority visibly grows and shrinks on the wire. This shortened excerpt from [`web/src/sting/webmcp.ts`](web/src/sting/webmcp.ts) shows the registration and fail-closed cleanup:

```ts
for (const tool of createStingTools(ws, this.deps, active)) {
  if (!active()) return;
  const wrapped: WebMcpToolDefinition = {
    ...tool,
    execute: async (input) => {
      if (!active()) return { ok: false, denied: { code: "STALE_REGISTRATION" } };
      const patched = await this.stampPassport(tool, input, active);
      if (!active()) return { ok: false, denied: { code: "STALE_REGISTRATION" } };
      const result = await tool.execute(patched);
      return active() ? result : { ok: false, denied: { code: "STALE_REGISTRATION" } };
    },
  };
  try {
    await this.context.registerTool(wrapped, { signal: controller.signal });
    if (!active()) return;
    this.names.push(tool.name);
  } catch (error) {
    this.failure = `${tool.name}: ${error instanceof Error ? error.message : String(error)}`;
    controller.abort();
    this.key = null;
    await this.waitUntilDropped(this.names);
    this.names.length = 0;
    return;
  }
}
```

Every abort on `controller.signal` unregisters the previous catalogue. The repeatable native-Chrome journey observes `toolchange` across cast, cold read, miss, revision and restoration, so the authority change is visible in Chrome's own inspector rather than only in UI copy. See [`web/src/sting/webmcp.ts`](web/src/sting/webmcp.ts) in full, and the adapter it sits on in [`web/src/webmcp/runtime.ts`](web/src/webmcp/runtime.ts).

### Tool table (all nine, as currently registered)

| Tool | Exists when | Enforced boundary or explicit instruction |
|---|---|---|
| `inspect_room` | always, from the door onward, every standing including silenced | cannot mutate anything; all participant decisions remain outside the tool |
| `stage_cast` | cast phase, before eight lives are on the table | stage a second cast or bypass the eight-life, axis, text and safety checks |
| `stage_duel` | duel phase, after the cold read; no open tap/question, no uncorrected miss, fewer than nine answered duels | edit a sealed bet after the commitment is shown; stage a duel that changes more than one thing (`DUEL_NOT_ISOLATED`) |
| `propose_hypothesis` | duel before the first bet (`cold_read`) or after a miss (`revision`); verdict (`hunger`/`mask`/`edge`) once standing is past probation | cannot pass off low-evidence lines as earned, revive killed lines (`KILLED`), or use label/prediction language; its live description also instructs it not to repeat participant-written `rules of me` |
| `ask_once` | duel or verdict, once per match, costs 1 chip | ask a second question, or ask anything open-ended — it must supply exactly three answers |
| `present_evidence` | fight, once the verdict is kept | this is a write that stages the two evidence posters, but it cannot crown either one — only the person's tap decides the winner |
| `stage_route_auditions` | lives phase, once the fight is settled, before posters exist | stage twice, choose a poster, or supply anything but exactly three distinct-axis lives with a week, tradeoff and question |
| `propose_experiment` | dare phase, before a dare exists | use named irreversible actions blocked by `NOT_REVERSIBLE`, exceed the person's bounded hours/money/day limits, or accept the dare; the person may accept, reduce or reject it |
| `seal_letter` | card phase, after the brief and dare acceptance, before the due time, with three chips available | make the page return or change the submitted fields before the person's due-date reveal; the submitting agent necessarily knows what it sent |

`docs/STING.md` §9 is the full contract for all nine. §23 documents which WebMCP-native concepts beyond these nine tools are shipped and which are still design candidates.

### Rules the kernel enforces

- **`operationId` replay** — every current write is idempotent by `operationId`; replaying the same actor and semantic payload returns the original receipt, while reusing the ID for a different request is denied `IDEMPOTENCY_CONFLICT`. Legacy receipts without a request fingerprint stay readable but cannot be safely replayed.
- **`expectedVersion`** — every write must name the state version it read; a mismatch is denied `STALE_VERSION`, never silently applied.
- **Sealed bets and letters** — a bet's or letter's commitment (`sha256(payload ‖ operationId)`, truncated) is shown before the tap; the page omits the submitted sealed fields from later read projections until reveal.
- **Participant-only moves** — no tool taps, kills, crowns, sets limits, accepts a dare, checks in, or opens a letter on the person's behalf; the kernel denies it `PARTICIPANT_ONLY`.
- **Hash-chained receipts** — every accepted kernel write appends a receipt carrying the previous receipt's hash. The current product keeps that chain in the browser; it does not yet ship JSON export/import or an independent attestation service.
- **Catalogue shrinks with standing and phase** — a miss removes `stage_duel` until a `revision` lands; a bust leaves only `inspect_room`. Each effective catalogue change replaces the browser registration and fires `toolchange`.
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
                         #   (start `npm run build -- --webpack && npx next start -p 3111` first)
npm run test:sting-live  # playwright: a live Spark (Muse Spark 1.3) match against the server on 3111
npm run test:live        # playwright against a deployed URL
npm run check        # test + lint + typecheck + build
```

---

## Built during the submission window

The public repository history begins on `2026-09-01` (`git log --reverse`), inside the OpenAI WebMCP Challenge submission window (Aug 25 – Sep 3, 2026). The STING submission commits and this README are in that history; the repository also preserves a pre-STING `/legacy` route and does not use its presence as an authorship claim.

The pre-STING prototype lives at [`/legacy`](web/src/app/legacy/page.tsx) for reference only; it is not part of this submission.

## Demo production kit

[`demo-assets/`](demo-assets/) contains the 2:54 voiceover script, timed captions, 1280×720
thumbnail, source stills, reproducible visual-cut builder, and audio workflow. The locally verified
[`STING_DEMO_NARRATED.mp4`](demo-assets/STING_DEMO_NARRATED.mp4) has H.264 video plus AAC narration
generated with macOS's synthetic Daniel voice; it is not an impersonation. The
[native WebMCP proof note](demo-assets/STING_WEBMCP_PROOF.md) distinguishes live Chrome values from
their labelled video visualization. The current cut is a still-based montage, not a continuous
recording of the interaction.

## License

MIT. See [`LICENSE`](LICENSE).

Design authority: [`docs/STING.md`](docs/STING.md). Submission kit: [`docs/SUBMISSION.md`](docs/SUBMISSION.md). Deploy steps: [`docs/DEPLOY.md`](docs/DEPLOY.md).
