# STING — YouTube upload pack

## Recommended title

**STING: Make Your AI Prove It Knows You | WebMCP Challenge**

Alternates:

1. **Your AI Says It Knows You. Make It Bet. — STING**
2. **STING — A WebMCP Game Where AI Has to Earn Your Trust**

## Description

Your AI can sound certain after it sees your answer. STING makes it bet before you choose.

STING is a three-minute, no-typing-required WebMCP game. An agent casts possible lives, stakes chips on
your next tap, loses capabilities when it is wrong, and must correct what it misread before it
can bet again. Only your actions can resolve a choice, reject a claim, crown a want, set limits,
accept a dare, or open the sealed letter.

The WebMCP tool catalogue is the trust meter: authority grows or shrinks from the agent's
demonstrated record. Every UI action and tool call goes through the same versioned command
kernel with replay-safe operation IDs, stale-state denials, commit-reveal bets, and
hash-chained receipts.

Try STING: https://sting-webmcp.vercel.app

Source (MIT): https://github.com/SpaarxLab/destiny-ai

Built for the OpenAI WebMCP Challenge.

#WebMCP #OpenAI #AIagents #BuildInPublic

## Chapters

```text
00:00 Make the AI prove it
00:10 Eight lives, no typing required
00:25 WebMCP gives the agent bounded tools
00:43 The sealed chip-staked bet
01:05 Wrong costs chips and capability
01:27 The catalogue is the trust meter
01:47 Earned evidence, rejectable claims
02:08 One reversible test in the real world
02:28 A field brief for any future AI
02:42 Prove it wrong
```

## Pinned comment

The part I care about most is not that the AI can act. It is that the page can make the AI
earn authority—and the person remains the referee. Try the live match and tell me which tool
boundary you would add next: https://sting-webmcp.vercel.app

## Tags

```text
WebMCP, OpenAI WebMCP Challenge, AI agents, agentic web, human AI collaboration,
document.modelContext, ChatGPT, browser agents, Next.js, TypeScript, explainable AI,
AI trust, human agency, STING
```

## Thumbnail

Upload `STING_YOUTUBE_THUMBNAIL.png` (1280×720). The editable source is
`STING_YOUTUBE_THUMBNAIL.svg`.

Design intent:

- Lead with one promise: **MAKE YOUR AI BET**.
- Show the agent's sealed prediction beside the participant's live choice.
- Keep the existing black, warm white, cyan, and orange palette. No faces, robot art, gradients,
  sponsor-logo collage, or small explanatory text.

## Recording and upload checklist

- [ ] After a UI change, rebuild and run the deterministic house capture as a regression check:

  ```bash
  cd web
  npm run build -- --webpack
  STING_PLAYER=off npm run start -- -p 3113
  # In a second terminal, still under web/:
  npm run capture:demo
  ```
- [ ] Keep the montage's proof boundary explicit: `01-door.png` through `05-webmcp-proof.png`
  demonstrate the native Chrome/WebMCP path; `06-card-current.jpg` through
  `08-field-brief-current.jpg` are three views of one completed ChatGPT/IAB room. This is a
  montage of two verified runs, not one continuous recording. Re-run both proofs after source
  changes, then run `bash demo-assets/build-visual-cut.sh`.
- [ ] Record the script in `STING_DEMO_VOICEOVER.md` as one clean file.
- [ ] Leave a short pause between rows; do not read the backticks or say “underscore.”
- [ ] Record without music. A close, calm voice is stronger than trailer narration here.
- [ ] Mux with `bash mux-voiceover.sh /absolute/path/to/voiceover.m4a`.
- [ ] Confirm the final MP4 is exactly 2:54 and the voice starts at 0:00.
- [ ] Watch at 1× with headphones; verify no clipped words and no silent opening or ending.
- [ ] Upload `STING_DEMO_NARRATED.srt`; it is the sidecar that matches the synthetic narration in `STING_DEMO_NARRATED.mp4`.
- [ ] Upload `STING_YOUTUBE_THUMBNAIL.png` as the custom thumbnail.
- [ ] Set visibility to **Public**, not Unlisted, because the challenge requires a public video.
- [ ] Add the live URL and repository URL above the fold in the description.
- [ ] Copy the public YouTube URL into `docs/SUBMISSION.md` and Devpost.
