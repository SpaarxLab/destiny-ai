# STING — Devpost submission kit

## Links

- **Live demo:** https://sting-webmcp.vercel.app
- **Public source:** https://github.com/SpaarxLab/destiny-ai
- **License:** MIT, visible in the repository root
- **Demo video:** add the public YouTube URL after upload

## Project name

**STING**

## Tagline (46 characters)

> Your AI says it knows you. STING makes it bet.

## About the project (Devpost copy, ≤350 words)

Most AI experiences ask you to trust a fluent answer. STING makes an AI **earn the right to
describe you**.

STING is a three-minute, no-typing-required game for people who ask AI for direction. The core
match is tap-only; writing a personal rule is optional. Your agent casts
eight possible lives. Before each duel choice, it must seal a chip-staked bet on which side you
will pick. A hit earns chips; a miss costs chips and forces a public correction before the
agent can bet again. Only after enough evidence and one corrected miss may its read be marked
earned. Lower-standing drafts are visibly labelled unearned. Reject a line and the kernel blocks
the same or a near-duplicate line; participant-written rules remain visible guidance to later agents.

**WebMCP leverage.** Nine phase-gated capabilities ship across the match. They are registered
through `document.modelContext.registerTool`, and the catalogue itself becomes the trust meter.
At the door, the agent can only `inspect_room`. Play reveals `stage_cast`. A miss removes
`stage_duel` until a revision lands. Going bust leaves only the read-only tool. The agent's
browser-level authority changes with its record.

One command kernel serves the UI and WebMCP. Writes require an
`operationId` and `expectedVersion`; replays return the original receipt, stale writes are
denied, bets use commit-reveal hashes, and receipts form a per-room hash chain. There is no
tool for tapping, killing a line, crowning a want, setting limits, accepting a dare, or opening
a sealed letter. Those decisions belong to the person.

**Better together.** Ordinary chat advises after seeing your answer, making confidence hard to
audit. STING makes the agent predict before observation, exposes mistakes, and lets its
record—not its tone—control what it may do next. The result is one bounded weekly test and a
field brief any future AI can use as revisable evidence, never as identity or diagnosis.

If no agent is available, the deterministic house completes the entire experience with zero
model calls. That makes STING a complete product as well as a non-trivial WebMCP implementation.

## Why it can win each judging criterion

### WebMCP Leverage

- Nine tools are deliberately distributed across phases instead of exposed as a static API.
- Native registration and catalogue replacement make capability changes observable to the host.
- `stage_duel` creates a real human-agent interlock: after a required sealed cold read, the tool returns `awaiting_participant`,
  the bet stays sealed, and only the person's tap resolves it.
- Tool availability expresses earned authority. A miss revokes a capability; a correction
  restores it; a bust leaves a read-only surface.
- The WebMCP adapter is thin. Policy, validation, idempotency, state versions, commitments, and
  receipts live in the shared kernel used by the UI.
- `present_evidence` is deliberately a write: it stages the two evidence posters, while the
  participant-only crown command keeps the decision human.

### Execution

- Complete journey: door → cast → five-to-nine duels → verdict → fight → three lives → bounded
  dare → card → sealed reality bet.
- No account and no typing required; the fallback house runs without a model provider.
- Public Vercel deployment, public MIT repository, responsive UI, human-readable tool activity,
  keyboard controls, reload recovery, and a demo clock for judging the one-week letter flow.

### Potential Impact

- Audience: people already asking AI for personal or career direction.
- Problem: confident personalised advice is usually post-hoc, hard to falsify, and easy to
  mistake for understanding.
- Intervention: pre-committed predictions, visible cost for misses, evidence thresholds,
  rejectable claims, and one bounded real-world test. The kernel blocks named irreversible
  actions and enforces limits; that is a concrete guard, not a proof that every proposal is safe.
- Boundary: STING does not claim therapy, diagnosis, prediction of a career, or validated
  participant outcomes. It demonstrates a safer interaction model that can now be user-tested.

### Creativity & Ambition

Instead of giving an agent more power to act for a person, STING makes the agent the contestant
and the person the referee. Its score is not decoration: the score changes the agent's actual
browser capabilities. The final artifact is not an AI verdict; it is a record of what survived
the person's choices and what should be tested next.

## How judges can test it

### Primary path: ChatGPT in-app browser

1. Open https://sting-webmcp.vercel.app in ChatGPT's built-in browser.
2. Confirm the page initially exposes only `inspect_room`.
3. Select **Play**, then ask the agent: “Play STING with me.”
4. Watch `stage_cast` appear and let the agent stage eight lives.
5. Make the three participant-only cast taps. Confirm `stage_duel` and `ask_once` are still absent.
6. Let the agent call `propose_hypothesis` with `kind: cold_read`; only then does `stage_duel` appear.
7. Let the agent call `stage_duel`. Before selecting either life, note the chip stake and commitment hash.
8. Select the opposite life. Refresh the tool list: `stage_duel` is absent.
9. The agent must call `propose_hypothesis` with `kind: revision` before the tool returns.

If Site tools are unavailable in that chat, select **Play the house instead**. The complete
product still runs; the Chrome path below proves the native WebMCP surface independently.

### Chrome path

Use Chrome with `chrome://flags/#enable-webmcp-testing` enabled, then relaunch. Open the live
URL with a WebMCP-capable inspector or agent. Chrome DevTools → Application → WebMCP shows the
registered catalogue.

For a quick denial proof, call `inspect_room`, then invoke any current write tool using an
`expectedVersion` lower than the returned `stateVersion`. The kernel returns
`STALE_VERSION`, applies no mutation, and tells the caller to read the room again.

### Reproducible source proof

From `web/`:

```bash
npm install
npm run test
npm run lint
npm run typecheck
npm run build -- --webpack
```

The current deterministic suite is 26 Vitest files / 271 tests. The repeatable native-Chrome
journey covers door discovery, cast, three human taps, the required cold read, a sealed duel,
miss, capability revocation, correction, and restoration through `document.modelContext`.

Additional journeys:

```bash
npm run test:browser  # complete deterministic house match
npm run build -- --webpack && npx next start -p 3111
# In a second terminal:
npm run test:chrome   # native Chrome document.modelContext + toolchange flow
```

The public deployment intentionally leaves the optional in-page model provider off. This removes
provider latency and spend from judging while preserving the external-agent WebMCP path and the
deterministic house fallback. If Spark is explicitly enabled, the browser POSTs a bounded
`PlayerContext` to `/api/sting/move`, which sends it to the configured provider. The app does not
control or guarantee that provider's retention policy.

## Demo video script — 2:54

| Time | Visual | Voiceover |
| --- | --- | --- |
| 0:00–0:10 | Live door, immediately readable | “Your AI says it knows you. STING makes it prove it—before you give it the answer.” |
| 0:10–0:25 | Door into eight lives | “STING is a three-minute, no-typing-required game for a person and their agent. The agent casts eight possible lives from what it knows. You tap the ones that sting.” |
| 0:25–0:43 | Cast and current tool catalogue | “This is not an AI quiz. The page gives the agent structured WebMCP tools, but only the move this phase permits. First it may inspect and cast. After a mandatory cold read, it may bet or ask once. The person still owns every tap.” |
| 0:43–1:05 | Sealed duel and commitment | “Here is the key move. Before I choose, the agent calls stage duel and seals a chip-staked bet on which side I will pick. The page hashes that commitment. It cannot see my tap or rewrite the bet afterward.” |
| 1:05–1:27 | Miss, lost chips, correction | “I choose the other side. It loses two chips. Now the browser changes what the agent may do: stage duel disappears. It cannot bet again until it makes a specific public correction about what it misread.” |
| 1:27–1:47 | Catalogue before and after correction | “That is WebMCP doing product work, not sitting beside the product. The catalogue is the trust meter. A miss changes the agent's actual capabilities, not just the colour of a button.” |
| 1:47–2:08 | Verdict with expandable tap proof | “After enough earned evidence, STING gives a provisional read: what I kept choosing, the tension I have not settled, and what I may be underrating. I can kill a wrong line, and that exact claim cannot return.” |
| 2:08–2:28 | Dare, card, sealed letter | “Then it turns the read into one bounded test this week, with a clear done looks like. A sealed letter is withheld until the due date, so reality settles the next bet. The result is not advice. It is a record of what survived contact with my choices.” |
| 2:28–2:42 | Field brief, shown large enough to read | “Finally, STING writes a field brief for any future AI: treat this as revisable evidence, name the tradeoff, make a bet, and admit what you misread. Less performance. More proof.” |
| 2:42–2:54 | End slate with live and source URLs | “STING. Your AI says it knows you. Prove it wrong.” |

The table above is the canonical spoken script for `demo-assets/STING_DEMO_NARRATED.mp4`; upload `demo-assets/STING_DEMO_NARRATED.srt` with it.

## Submission checklist

**Deadline: 2026-09-03, 1:00pm PDT = 2026-09-04, 01:30 IST.**

- [x] Public repository: https://github.com/SpaarxLab/destiny-ai
- [x] MIT `LICENSE` in repository root
- [x] Stable live URL: https://sting-webmcp.vercel.app
- [x] Source instructions and WebMCP architecture in `README.md`
- [x] Judge-first voiceover script, captions, visual cut, and reproducible audio workflow prepared locally
- [x] Synthetic narration generated locally with the macOS Daniel voice (not an impersonation)
- [x] Final 2:54 `STING_DEMO_NARRATED.mp4` verified with H.264 video and an audible AAC narration stream
- [ ] Upload the final MP4 as a public YouTube video and paste its URL above
- [ ] Add the final video URL and screenshots to Devpost
- [ ] Submit the Devpost entry
- [ ] After submission, freeze the submitted repository SHA, video and live deployment and keep
  them accessible through the judging period ending 2026-09-21, 5:00pm PDT
- [ ] Optional: install and verify a production-bound WebMCP origin-trial token for stock Chrome

## Screenshot order

1. Door: the thesis and **Play** button.
2. Sealed duel: two lives, chip stake, and commitment before the human tap.
3. Tool catalogue after a miss: `stage_duel` absent.
4. Verdict: a line with its three tap references expanded.
5. Card: record, bounded dare, sealed letter, and field brief.

## Honest caveats

- The public deployment uses the deterministic house for its optional in-page model player;
  an external ChatGPT or Chrome agent can still use the native WebMCP tools.
- Without an origin-trial token, stock Chrome needs the WebMCP testing flag. ChatGPT's in-app
  browser supports the challenge path directly.
- The impact case is mechanism-level and product-level, not a claim of clinical benefit or
  validated participant outcomes.
- Match state is stored in browser `localStorage` and writes are serialized with Web Locks when
  available. There is no shipped JSON import/export, multi-tab ownership mode, or remote backup.
- The ready narrated video is a still-based montage. It accurately labels the native Chrome proof,
  but it is not presented as a continuous screen recording of every interaction.
- Tool-change timing belongs to the host. STING also renders every authority change in plain
  language so the human experience does not depend on an inspector refreshing instantly.
