# STING — Devpost submission kit

## Project name

**STING**

## Tagline (≤60 chars)

> Your AI says it knows you. STING makes it bet. (46 chars)

## Three candidate one-liners

1. Your AI says it knows you. STING makes it bet, chip by chip, on every tap.
2. Your own agent, carrying its memory of you, casts your life and stakes chips to prove it.
3. Prove your AI wrong: it bets through the page's own tools, and reality collects.

---

## About the project (≤350 words)

STING is a three-minute, no-typing game played inside ChatGPT over WebMCP. Your own agent —
with its memory of you — casts eight life-cards from what it already knows and **seals a
chip-staked bet on which of two you'll pick before you tap**. Right, it earns chips. Wrong, it
loses them and must correct itself before betting again. Only with enough chips and one
confessed miss may it describe your hunger, mask and edge, cited to your own taps.

**WebMCP Leverage.** WebMCP's premise is a website an agent uses on someone's behalf; STING turns
that around — your own agent uses the page's tools to prove it knows you, staking chips on a tap
it can't see coming. Every move is a real `registerTool` call (`web/src/sting/webmcp.ts`),
phase-gated so the catalogue is the authority meter: a miss removes `stage_duel`, a bust leaves
only `inspect_room`, every change fires `toolchange`. Bets are commit-reveal, hash before the
tap, seal only after. All nine tools (§9) are live, including a captain's turn — one call
chooses to bet, ask, or close — plus an optional `aside` on every write, kernel-filtered.

**Execution.** One kernel enforces every rule server-side-equivalent in the client document:
`operationId` replay returns the original receipt, `expectedVersion` mismatches deny
`STALE_VERSION`, every write is an append-only hash-chained receipt. The whole match runs with
zero network calls if no agent connects.

**Potential Impact.** Career stuckness isn't solved by a quiz; it needs a calibrated bettor and a
week of contact with reality. The chip economy makes an agent's confidence costly and checkable
— no chat interface can replicate that (`docs/STING.md` §5).

**Creativity & Ambition.** Most WebMCP entries let an agent act for a person. STING inverts it:
your AI already claims to know you from the chat you just had; the page makes that claim cost
something. A commit-reveal market with a human referee, played through a catalogue whose captain
picks its own move, uses `registerTool`/`toolchange` most entries won't attempt. Not shipped:
rival-agent mode, "blind challenge". Shipped: the shrinking catalogue, rules of me, the sealed
letter, `ask_once`, seal verification, asides, the captain's turn, the handoff.

---

## How to test

**Proof you can re-run (2026-09-03):** `cd web && npm run test:chrome` launches real Google Chrome 152 with the
WebMCP flag and drives STING through `document.modelContext` itself: the door exposes one tool, Play adds
`stage_cast`, the first write stamps "Chrome 152" as the agent's passport, the sealed bet is absent from
`inspect_room` until the tap, a wrong bet removes `stage_duel` from `getTools()` until a revision lands, and
39 `toolchange` events fire with zero console errors. `npm run test:browser` plays a full house match to the
card and opens the sealed letter under `?clock=+8d`. `npm run test:sting-live` does the same with the real
Muse Spark 1.3 model (18 model calls, all 200, including the paid question).

**ChatGPT (primary path).** Open the live URL inside ChatGPT's desktop app, built-in browser,
model **GPT-5.6 Sol** or **GPT-5.6 Terra** (GPT-5.6 Luna has site tools disabled; Enterprise/Edu
workspaces do not expose them at all — switch account tier if tools don't appear). Say "play
STING with me." Tap through cast and a duel; watch the strip show a sealed bet and chip count
before you tap.

**Chrome (backup path).** Chrome 149+, `chrome://flags/#enable-webmcp-testing` → Enabled →
relaunch. Install a WebMCP-capable extension (e.g. the Model Context Tool Inspector) to drive
tools manually or via Gemini, or use the manual path below.

**DevTools manual-run path — watch a denial.** Open the live URL in Chrome with the flag on.
DevTools → Application → WebMCP lists every registered tool. Select `stage_duel`, fill a duel
call with any valid `operationId` but an `expectedVersion` one lower than the value `inspect_room`
currently reports, and invoke it. The kernel returns `{ ok: false, denied: { code:
"STALE_VERSION", message: "The room moved on. Read it again." } }` — the write is rejected, no
state changes, and calling `inspect_room` again shows the version unchanged.

---

## Video script (< 2:45, three acts)

| Time | On screen | Voiceover |
|---|---|---|
| 0:00–0:10 | ChatGPT chat window, ordinary conversation | "Your AI says it knows you. I'm about to make it bet — with chips it can lose." |
| **Act 1 — the bet** | | |
| 0:10–0:18 | In ChatGPT, the person types "play STING with me"; a tab opens to the door, which reads "waiting for your agent" | "I just say it: play STING with me. The page waits for it — it never plays over my agent." |
| 0:18–0:35 | Cast: eight lives land; a one-line aside from the agent appears on the page before the taps ("Something like: you keep circling mornings."); DevTools WebMCP panel shows `registerTool` calls landing | "It just called `registerTool` — `stage_cast` — and it's talking to me, right there on the page, not just in the chat." |
| 0:35–0:55 | Duel screen, chip stake and commitment hash shown before the tap | "Before I tap, `stage_duel` seals a bet — a commitment hash, right there. It can't see my thumb, can't change its mind after." |
| **Act 2 — the cost** | | |
| 0:55–1:15 | Tap, reveal, a miss; chip count drops on screen | "Wrong. It loses the chips it staked. Watch the tool panel." |
| 1:15–1:35 | DevTools WebMCP panel: `stage_duel` disappears from the registered-tools list; `toolchange` fires | "`toolchange` just fired. `stage_duel` is gone from its own tool list until it corrects itself. That's not a UI lock — that's the browser's own registry." |
| 1:35–1:50 | `propose_hypothesis` call with kind revision; correction text appears | "It has to call `propose_hypothesis`, kind revision, and admit what it misread, before it can bet again." |
| **Act 3 — the referee** | | |
| 1:50–2:05 | Verdict: hunger/mask/edge lines with `▸ proof` taps expanding to real reaction refs | "Only now, with enough chips and one corrected miss, may it describe me — and every line cites the actual tap." |
| 2:05–2:15 | Kill a line; `propose_hypothesis` description regenerates live in DevTools | "I kill one. Its own tool description just rewrote itself to say it can never bring that line back." |
| 2:15–2:28 | Dare accepted; `seal_letter` call, commitment hash shown, write tools vanish | "It dares me to one real thing this week — and seals a letter about whether I'll do it. Sealed from everyone, even itself, until the letter opens." |
| 2:28–2:44 | `?clock=+7d` in the URL bar; two taps open the letter; card updates live | "I skip ahead with the demo clock. Two taps open the letter. Reality signs the card — not the AI." |

Total runtime: 2:44.

---

## Submission checklist

**Deadline: 2026-09-03, 1:00pm PDT = 2026-09-04, 01:30 IST.**

- [ ] Public repo (GitHub) — MIT `LICENSE` visible in the About section
- [ ] Live URL, testable through judging end (Sep 21, 5:00pm PT); root directory `web` per `docs/DEPLOY.md`
- [ ] `WEBMCP_ORIGIN_TRIAL_TOKEN` registered against the exact production origin (not a preview URL) — see `docs/DEPLOY.md`
- [ ] Demo video, public on YouTube, under 3:00, with audio, uploaded and linked
- [ ] Submission text: this file's "About the project," "How to test," and Risks sections pasted into the Devpost form
- [ ] Testing Instructions field: model requirement (GPT-5.6 Sol/Terra, not Luna, not Enterprise/Edu), Chrome flag fallback, DevTools denial walkthrough
- [ ] Five screenshots (see below)
- [ ] Reviewer / representative name filed for the team
- [ ] `git log --reverse` confirms first commit `2026-09-01`, inside the Aug 25 – Sep 3 window — no prior-work ledger needed

### Screenshots (5)

1. **Door** — dark room, "ChatGPT thinks it knows what you want. Prove it wrong," strip reading "ChatGPT is here."
2. **Duel with sealed bet** — two lives side by side, chip stake and commitment hash visible before the tap.
3. **DevTools → Application → WebMCP panel** — the live registered-tool list, showing the phase-gated catalogue.
4. **Verdict with proof** — a hunger/mask/edge line expanded to show `▸ proof · n taps`, cold read revealed beneath.
5. **Card** — chip record (hits/misses/chips), cold read vs. earned read, and the dare with its sealed reality bet.

---

## Risks and honest caveats

- **Luna / Enterprise gap.** GPT-5.6 Luna has site tools disabled, and ChatGPT Desktop under
  Enterprise or Edu workspaces does not expose site tools at all — a judge on either will see the
  house play instead of ChatGPT, with no on-screen explanation yet. Testing Instructions call this
  out explicitly so it isn't mistaken for a bug.
- **Origin trial token is origin-bound.** `WEBMCP_ORIGIN_TRIAL_TOKEN` must be registered against
  the exact scheme+host+port of the production deploy; a Vercel preview URL gets a different
  origin per deploy and will not carry a valid token. Without it, judges on stock Chrome (no flag
  flipped) will not see `document.modelContext` at all and will fall back to the house.
- **iOS is unsupported.** WebMCP has no shipped or trialed support on any iOS milestone (Safari's
  WebKit engine); STING's pitch of "stays on your phone" only gets the agent-side WebMCP
  experience on Android or desktop Chrome/ChatGPT today. iPhone visitors get the house, which is a
  complete game, but not the ChatGPT-plays experience.
- **`toolchange` timing is not guaranteed by spec.** The shrinking-catalogue moments are narrated
  by STING's own on-screen activity sentences as the primary signal; the browser's native tool
  panel updating in sync is a bonus, not something the demo depends on exactly.
