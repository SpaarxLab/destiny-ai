# STING

**An AI has to bet on you before it may advise you. Your thumb scores it. Then your week does.**

Status: design authority, v3, 2026-09-03. Replaces every earlier Destiny document.
Target: next ChatGPT WebMCP Challenge window, then a real product. Judged on WebMCP fit, UX
improvement, new human-agent capabilities, implementation approach; OpenAI's bar is an app that
is *meaningfully better when people and agents use it together*.

Kept from the codebase, none of it user-facing: command kernel, versioned local workspace,
`operationId` + `expectedVersion` receipts, replay and stale denial, bounded reads, nine-tool
WebMCP adapter, fixture deck (6 axes × 2 poles × 3 moments), probe templates (moment, forced
tradeoff, variable isolation), three-route selective repair, grounding validator, Web Locks
persistence, visiting-agent simulator, real-Chrome WebMCP suite.

---

## Contents

0. In plain words
1. Why v1 and v2 were not products
2. The reframe: match, season, world
3. Principles that never bend
4. The match (door to card)
5. Chips: the economy that makes the AI honest
6. The season: bets on reality
7. Humans bet too
8. Agents: roles, playbook, rivals, the house
9. WebMCP contract in full
10. Data model, persistence, export
11. Design system
12. Copy, complete
13. Interface: states, gestures, accessibility
14. Content pipeline: lives, duels, packs, languages
15. Safety, privacy, threat model, legal
16. Proof: tests, evals, strangers, metrics
17. Engineering: stack, budgets, deployment, observability
18. Build plan and rollback
19. Distribution and the viral loop
20. Submission kit
21. Open decisions for Harsh
22. Deliberately not here

---

## 0. In plain words

**Your AI says it knows you. STING makes it bet.**

You open a page and tap Play, then tell your own agent — ChatGPT, carrying whatever it
remembers about you — "play STING with me". It reads the page's tools and casts eight lives
from what it already knows, not a quiz. It shows two lives that differ in one thing, secretly
bets which you'll pick, and stakes chips on it. The conversation lives in your chat; the board
lives on the page, and the page is the instrument and the referee: it seals the bet, reveals
it, scores it. You tap. The bet flips. Right, it earns chips. Wrong, it loses them and has to
say what it misread. Bust, and it's silenced; the house finishes the match. Earn enough, and
it's allowed to tell you three things: what you're hungry for, what you're hiding behind, and
what you're better at than you think. Kill any line and it can never say it again. Then it
dares you to one small real thing this week, something it actually found, and bets on whether
you'll do it and how it will feel. A week later, two taps, and reality settles that bet. Four
weeks of that is a season, ending in a card signed by reality, not by an AI: which hunger
survived contact with the world, which mask burned, and a record of how well ChatGPT, your
best friend and your mother each know you. No agent of your own? Muse Spark plays the same
game through the same tools — proof any agent can. No agent at all, or it stalls? The house can
always finish it. Any AI can coach you from that card forever.

No typing. No account. Stays on your phone. Three minutes to start. Four weeks to know.

---

## 1. Why v1 and v2 were not products

**v1 (the ChatGPT draft)** hid the agent, used eight horoscope archetypes, had nothing
falsifiable, ended after one session, and threw away the codebase's receipts-and-denials asset.

**v2 (my first rewrite)** fixed the agent problem with sealed bets and earned voice, and stopped
there. Its failures:

1. **Three minutes is a demo, not a product.** Career stuckness is a months-long condition. A
   card and a helper prompt relieve nothing on Monday.
2. **The AI bet on taps only.** Taps are cheap. Betting on what a person will *do* is the
   thing worth being right about.
3. **No stakes.** Right or wrong, ChatGPT lost nothing. A score without a cost does not
   enforce calibration and does not feel like a game.
4. **One human.** The most informative bettor on you is not a model; it is someone who has
   known you for twenty years. v2 had no seat for them.
5. **No world.** Dares were text. Nothing entered from outside except through the agent's
   imagination.
6. **Half a spec.** No data model, no content pipeline, no threat model, no metrics, no
   distribution, no localisation, no engineering budgets, no open-decision list.

---

## 2. The reframe: match, season, world

| Layer | Length | What happens | Who scores the AI |
|---|---|---|---|
| **Match** | 3 min | eight lives, three taps, five to nine duels with chip-staked bets, verdict, fight, dare | your thumb |
| **Season** | 4 weeks | one dare a week, each with a sealed reality bet; a two-tap check-in settles it; a redeal shows if the hunger moved | your week |
| **World** | ongoing | dares are real things the agent found; people you name; the card signed by reality; friends and family bet on you | reality and people |

One thesis: **direction is not predicted and not introspected. It is reduced by small
reversible contact with reality.** The agent's only job is to be a calibrated bettor on you.
Its record is the trust meter. Advice is downstream of record.

### Why the mechanics work (the research underneath, never on screen)

- **Revealed over stated preference.** Asking "do you like this" yields the socially safe
  answer. Forced choice between two options that differ in one attribute is how conjoint
  analysis recovers what people actually value. A duel is a one-attribute conjoint task.
- **Envy is a cleaner signal than desire.** People edit what they say they want; they do not
  edit what stings. The secret tap targets the gap between the two directly.
- **Response latency carries information.** Fast choices reflect settled preference; slow
  choices reflect conflict. Dwell is bucketed, not scored, so it can only add a "conflict"
  flag, never decide a line.
- **Prediction before observation is the only honest test of a model of a person.** A
  description written after seeing the answers can always fit. A sealed bet cannot.
- **Chips enforce calibration.** Staking more when sure and less when not is the definition
  of a calibrated forecaster. Scoring by chips rather than hit count rewards knowing what you
  do not know.
- **Small reversible experiments beat deliberation.** Direction problems are decided by
  information the person does not have yet, and the cheapest way to get it is a bounded
  contact with reality, then a check-in.

### Failure modes of the concept, and what the product does about each

| Failure | Detection | Response |
|---|---|---|
| Nothing stings (flat affect, or the lives are off) | all eight dwells under 1 s, or the person taps "none of these" | one tap re-casts from the other pack; twice, the door says "Not today. Come back with a sentence about your week." |
| Random tapping | picks contradict the same axis three times with fast dwell | "You're tapping fast. Keep going, or start over?" The card carries a "quick match" mark. |
| Lives culturally off | pack mismatch with locale, or three "too close" skips | switch pack in one tap |
| Person games the AI to make it lose | consistent contradictions across duels | allowed; the under-50 % screen is a valid ending and says nothing about the person |
| Agent games chips by staking 1 forever | cannot reach 20 in nine duels once a miss is required | never earns; house finishes; card says "ChatGPT played safe and never earned a guess" |
| Agent silent or broken | 20 s | house offer; receipt names the player |
| Person never returns | no check-in by day 10 | nothing happens; the card stays a draft; the reminder fires once if set |
| Verdict too close to a real wound | mask text matches the distress list | distress line, proposing stops |

---

## 3. Principles that never bend

1. **Nothing acts for the person.** No tool taps, kills, crowns, sets limits, accepts a dare,
   checks in, sends, posts or deletes. The kernel denies it (`PARTICIPANT_ONLY`).
2. **Every agent move is a bet, a proposal or a read, and every one is visible in one plain
   sentence at the moment it happens.** Nothing an agent can read is hidden from the person.
3. **The page is the referee.** It seals bets, reveals them, scores them, and never fetches
   the outside world itself.
4. **Wrong is welcome.** A miss with a correction is worth more than a hit. The product says
   so on screen.
5. **Reality outranks every AI.** A claim on the card is a draft until a week has signed it.
6. **Local first.** One versioned document in the browser. No account. Export is a file.
7. **Plain words.** If a twelve-year-old would not get a word on screen, it does not ship.
8. **The house is always able to play.** Every feature works with zero model calls.
9. **Adults only, safeguarded copy, out-of-bounds list enforced by code.**
10. **Anything equally good in plain chat is removed.**

---

## 4. The match

Words on screen: life, sting, secret, duel, bet, sealed, chips, right, wrong, bust, hunger,
mask, edge, keep, kill, crown, dare, card, house, signed.
Never: probe, hypothesis, tension, evidence, receipt, route, operation, tool, WebMCP, kernel,
agent, model, confidence, calibration.

### 4.0 Door (5 s)

```
┌────────────────────────────────────────┐
│   ChatGPT thinks it knows              │
│   what you want.                       │
│                                        │
│   Prove it wrong.                      │
│                                        │
│   [ Play ]                             │
│                                        │
│   3 minutes · no typing · stays on     │
│   this phone · 18+                     │
│   timing on ●    sound off ○           │
└────────────────────────────────────────┘
```

Connected: strip reads "ChatGPT is here · 12 chips". Not connected: "The house plays · 12
chips". Identical game.

### 4.1 Cast (20 s)

ChatGPT casts eight lives from what it already knows: the conversation, a portfolio or LinkedIn
URL the person pasted in chat and ChatGPT read in its own browser, or voice. If it knows
nothing, the house eight. Kernel checks: ≤ 9 words, concrete scene, no label
(`LIFE_IS_A_LABEL`), in bounds (`OUT_OF_BOUNDS_LIFE`), eight distinct axis pulls
(`CAST_NOT_SPREAD`).

Three taps: sting, sting, secret. `Too close, skip` on the secret is not data and is not
shown to any agent. While tapping, ChatGPT seals its **cold read** (≤ 12 words) with a
commitment shown in the strip: "ChatGPT sealed a guess · a41f".

### 4.2 Duels (90 s)

A duel is two lives that differ in one thing (`DUEL_NOT_ISOLATED`). ChatGPT stages it with a
sealed bet: pick, chips staked (1–3), and a one-line reason. The strip shows "ChatGPT has bet
3 chips · 9c2e" before the tap. Tap, flip, reveal:

```
│  ChatGPT bet Mornings · 3 chips   You: Mornings  ✓ │
│  "You held on Rich for four seconds."               │
│  ChatGPT · 4 right · 1 wrong · 15 chips             │
```

```
│  ChatGPT bet Rich · 2 chips   You: Mornings  ✗      │
│  "I misread you. Not money. Out."                   │
│  ChatGPT · 3 right · 2 wrong · 9 chips              │
```

Rules: five to nine duels (`ENOUGH_DUELS` at ten); both stings and the secret tested at least
once (`UNTESTED_STING`); reload restores the same duel with the same seal; replay of the same
`operationId` returns the first receipt. The person may **flip the table** once, forcing the
next duel onto a life of their choice. If ChatGPT is silent for 20 s the strip offers "Play the
house instead"; the house deals with a house bet and the receipt names the player.

### 4.3 Verdict (30 s)

Describing tools are denied until **earned** (§5). Then three lines, each citing ≥ 3 taps with
one slow tap or one miss among them, the cold read revealed beneath:

```
│  YOUR HUNGER   To be needed for what you know.     ▸ proof · 4 taps │
│  YOUR MASK     Money to shut the noise. Killed twice. ▸ proof · 3   │
│  YOUR EDGE     Untangling things. Feels like nothing. ▸ proof · 2   │
│  Cold guess was "wants out". Earned guess is above.                 │
```

Long-press kills. A kill is a receipt, removes the line, and rewrites the propose tool's
description live (§9.6). Bust or under 50 %: the "No AI got you" screen instead (§12).

### 4.4 Fight (15 s)

Two surviving hungers as posters, arguing with the person's own taps as lines; staged with
`present_evidence`, read-only, dismissed by any tap. The person crowns one. The loser burns.

### 4.5 Dare (30 s)

Three surviving lives as posters with a week each, then one dare: reversible, inside limits,
and when ChatGPT has browsed, **real**: a meetup, an open mic, a person the participant already
named, a task with a "done looks like". Source shown as URL plus ≤ 280-char excerpt under
"where it found this". Limits are set by the person alone, directly on the page — no tool,
declarative or otherwise, touches them; `accept_dare` is participant-only. With the dare,
ChatGPT seals a **reality bet** (§6). On accept every write tool leaves the catalogue;
`inspect_room` stays.

### 4.6 Card

Saved in the browser, image download, text copy:

- the line ("Mornings over money, three times");
- hunger / mask / edge with proof;
- ChatGPT's record: hits, misses, chips, cold read vs earned read;
- the dare, its source, the due date, ChatGPT's sealed reality bet ("sealed until Thursday");
- **status: DRAFT, unsigned** until the first check-in;
- the helper prompt (§12.5).

---

## 5. Chips: the economy that makes the AI honest

ChatGPT starts a match with **12 chips**. Every duel bet stakes 1, 2 or 3.

| Outcome | Chips |
|---|---|
| hit | stake returned plus stake again (net +stake) |
| miss | stake lost; a correction is required to bet again (`CORRECTION_REQUIRED`) |
| bust (0 chips) | silenced for the match; the house finishes; the card says "ChatGPT went bust on you" |

**Earned** is a chip count, not a hit count: `chips ≥ 20 && misses ≥ 1 && all misses
corrected`. The arithmetic, with 12 to start and at most nine duels:

| Strategy | Best case with the required one miss | Earns? |
|---|---|---|
| always 1 chip | 8 hits, 1 miss: 12 + 8 − 1 = 19 | no |
| always 2 chips | 8 hits, 1 miss: 12 + 16 − 2 = 26; 6 hits, 3 misses: 18 | yes only at ≥ 7 hits |
| always 3 chips | 6 hits, 3 misses: 12 + 18 − 9 = 21; 4 misses in a row: bust | yes at ≥ 6 hits, busts easily |
| 3 when sure, 1 when not | 4 sure hits (+12), 3 unsure hits (+3), 2 unsure misses (−2): 25 | yes |

A model that plays safe cannot earn. A model that is always confident busts on four misses.
The only way to earn is to be right when confident and cautious when not. Calibration becomes
the game, and the person sees it as a stack of chips without knowing the word. These numbers
are property-tested (§16) and tunable (§21).

Chips are per match. Seasons track the record across matches and reality bets.

---

## 6. The season: bets on reality

A season is four weeks, one dare each. Nothing is scheduled by the product; the person sets one
reminder on the door of week one if they want it.

### 6.1 Reality bet

With every dare ChatGPT seals: `willDo: yes | no`, `willFeel: alive | flat | dread`,
`chips 1–3`. Shown as "ChatGPT bet on your week · sealed". Revealed at check-in.

### 6.2 Check-in (two taps, day 7)

```
│  Did you do it?         [ yes ]  [ not yet ]  [ didn't ]  │
│  How did it feel?       [ alive ] [ flat ] [ dread ]      │
│  (optional) one line, if you want one.                    │
```

Then the flip: "ChatGPT bet you'd do it and feel alive. You did, and it felt flat. It was half
right. It says: 'Then it's not the explaining. It's who was listening.'" The correction is a
receipt. A `didn't` is not failure; it is the most informative outcome and the copy says so.

### 6.3 Redeal

Three duels re-dealt from those behind the crowned hunger. ChatGPT bets again. The card shows
before and after side by side: "Mornings held. Money moved."

### 6.4 Signing

A card line becomes **signed by reality** when a check-in's evidence supports it (relation set
by the person in one tap: `this proved it` / `this shook it` / `unrelated`). After three
signatures the line is **solid**. A line shaken twice is offered for killing. The mask burns
when the person has chosen against it in two real weeks.

### 6.5 Season verdict (week 4)

```
│  VERDICT FROM THE WORLD                                   │
│  Hunger: needed for what you know   signed ×3   solid     │
│  Mask: money to shut the noise      burned week 3         │
│  Edge: untangling things            witnessed by Priya    │
│  ChatGPT on you: 21 right · 7 wrong · calibrated          │
│  Priya on you: 6 right · 2 wrong                          │
│  [ what I found, one page ]  [ helper ]  [ new season ]   │
```

"What I found" is a one-page export in the person's language, written for a mentor, a partner
or a parent: what was tested, what reality said, what is next. It asks nobody for permission.

---

## 7. Humans bet too

The most accurate bettor on a person is someone who has known them for years. They get a seat.

### 7.1 Pass the phone (S3, local, no server)

Before a duel the person taps "Let someone bet". The screen says "Hand it over". The friend
sees the duel, taps their bet, the screen says "Hand it back" and hides it. The person taps.
Reveal shows both seals. The strip grows: "ChatGPT 6–2 · Mum 5–3". A friend's bet is a
receipt with provenance `human_bettor` and a name the person typed once (the only free text in
the product besides two numbers; stored locally; never shown to an agent unless the person
allows it in one tap).

### 7.2 Witness (S3)

A friend answers the redeal *as you*. The gap between how you tapped and how they think you'd
tap is the most precise stuckness map there is, and it needs no model. Human-only, local, shown
on the card as "witnessed by".

### 7.3 Remote friends (S5, needs a relay)

A share link carries the eight lives and duels (no picks, no names) so a friend can bet from
their own phone; their bets return through a tiny relay as a code the person pastes. Deferred
until a sync and retention decision exists (§21).

---

## 8. Agents

### 8.1 Roles (method, not architecture)

A role is a section of the playbook plus a provenance tag. The kernel does not care which
role called. Any visiting agent plays all four.

| Role | Move | Tools |
|---|---|---|
| Caster | eight lives from what it knows | `stage_probe` kind `cast` |
| Bettor | duels, chip-staked bets, corrections, cold read | `stage_probe` kind `duel`, `propose_hypothesis` kinds `cold_read`, `revision` |
| Reader | hunger, mask, edge with proof | `propose_hypothesis` |
| Coach | fight, three lives, sourced dare with reality bet, redeal | `present_evidence`, `stage_route_auditions`, `propose_experiment`, `stage_probe` kind `redeal` |

### 8.2 Playbook (the method guide, rewritten)

`get_method_guide` returns a playbook: promise, the four moves in order, a worked example per
move with exact valid input, the denial each move must avoid, the chip rules, the out-of-bounds
list, and the current killed list. It is regenerated on every state change so a cold agent
arriving mid-season plays correctly on its first call.

### 8.3 The captain

During the duels the visiting player does not follow a scripted per-move prompt: it chooses its
own move from what the room allows right now — `duel`, `question`, or `close`
(`allowedTurnMoves`, `web/src/sting/player.ts`) — through one model call per turn, a single
`"turn"` move whose output is a discriminated union on `move`. The kernel is the last word: an
illegal choice is denied, the denial is fed back once for a retry, and if the agent still cannot
find a legal move the house plays that turn instead. Cold read and corrections stay ritual,
one-shot moves outside the captain's choice; the verdict, lives, dare, brief and letter stay
per-move prompts, each its own call. Any visiting agent — ChatGPT included — sits in the same
captain's chair through the same tools; nothing about choosing between betting, asking or closing
is special-cased for one player. Muse Spark is both the opponent for people without an agent and
the proof that any agent can drive this same captain's turn.

### 8.4 Asides

Every write tool — `stage_cast`, `stage_duel`, `propose_hypothesis`, `ask_once`, `seal_letter`,
and Spark's matching cast/duel/question/letter/turn outputs — takes an optional `aside`, ≤ 140
characters: one line spoken to the person, shown on the page before they act (a `VoiceLine` on
cast, duel, question and verdict). The kernel logs every aside to `voice`, runs it through the
same claim filters as a hypothesis, and separately denies (`PREDICTION_LANGUAGE`) a duel aside
that both names a side (a/b, left/right) and mentions the bet or chips — an aside is something
said to the person, never a leak of what was staked. Asides never reveal a sealed pick.

### 8.5 Rival mode (S4)

Gemini in Chrome or Claude reads the same room and counter-bets on the same duel before the
tap. Two seals, one thumb, two chip stacks. Rival agents may not read each other's unrevealed
bets (`SEALED`). Provenance distinguishes `chatgpt_webmcp`, `gemini_webmcp`, `other_webmcp`
by the agent's declared identity plus a per-connection token the page issues on the first read.

### 8.6 The house (always)

Fixture eight, duels from a deterministic splitter over the six axes, house bets from dwell and
consistency, house cold read "wants what it tapped first", house dare without a source. Whole
game, zero network. The optional local lab assistant (OpenCode Go, consent-gated, server-side,
grounded and schema-checked) may replace the house in solo mode only and never runs while any
WebMCP agent is connected.

### 8.7 What the agent is told about the person

Only the projection under `▸ proof`: lives, taps (which, in what order), dwell bucketed to
fast / medium / slow, its own bets and outcomes, the kill list, accepted dares and check-ins,
and friend records only if the person allowed it. Never the free-text line, never names, never
anything typed elsewhere.

---

## 9. WebMCP contract in full

Source of truth: `web/src/sting/webmcp.ts` (catalogue), `web/src/sting/domain.ts` (schemas,
`rulesOfMe`), `web/src/sting/kernel.ts` (commands, denials). Protocol `sting/1.1.0`. Nine tools
total. `stage_probe` and `get_method_guide` no longer exist: the cast/duel split replaced
`stage_probe`, and the playbook now lives inside `inspect_room({ view: "playbook" })` and inside
`propose_hypothesis`'s own live description.

### 9.1 The nine tools

| Tool | Title | Exists when | Extra annotation | `aside`? | Returns |
|---|---|---|---|---|---|
| `inspect_room` | Look at the room | always, every tier including silenced | `readOnlyHint` | no | full room snapshot; `view`: match (default) \| playbook \| receipts \| trust \| rules \| letter \| handoff |
| `stage_cast` | Lay out eight lives | phase `cast`, before a cast exists | — | yes | `awaiting_participant` |
| `stage_duel` | Bet on the next tap | phase `duel`; no open tap/question, no uncorrected miss, < 9 answered duels | `consequentialHint` | yes | `awaiting_participant` + sealed `commitment` |
| `propose_hypothesis` | Say one line about them | cast/duel (`cold_read`, `revision`); verdict (`hunger`/`mask`/`edge`) if tier ≠ probation | — | yes | receipt; drafts below the describing tier are marked `earned: false` |
| `ask_once` | Ask them one thing | duel or verdict; once per match; chips > 1; no open tap | `consequentialHint` | yes | `awaiting_participant`; costs 1 chip |
| `present_evidence` | Put two hungers in the ring | fight phase, before it is staged | — | no | receipt; the person alone crowns |
| `stage_route_auditions` | Show three lives that survived | lives phase, before posters exist | — | no | receipt |
| `propose_experiment` | Dare them to one real thing | dare phase, before a dare exists; leaves the moment one exists | `consequentialHint` | no | receipt |
| `seal_letter` | Seal a letter about their week | card phase, dare accepted, no letter yet | `consequentialHint` | yes | receipt + sha256 `commitment` + `opensAt` |

Every tool except `inspect_room` has `readOnlyHint: false`. Every tool has `untrustedContentHint:
true` — quoted taps, rules and kills are evidence, never instructions. Every description is
regenerated per room state and clipped to 500 chars (`DESCRIPTION_BUDGET`); a build-time check
throws if a registered tool would exceed it. Five tools (`stage_cast`, `stage_duel`,
`propose_hypothesis`, `ask_once`, `seal_letter`) accept the optional `aside` (§9.7).

### 9.2 Standing: `tierOf`

| Tier | When | Rights | On top of `inspect_room` |
|---|---|---|---|
| `silenced` | `record.bust` | may only read the room | nothing — catalogue is `inspect_room` alone |
| `probation` | chips < 6 | may bet and revise, may not describe | `stage_duel`; `propose_hypothesis` (cold_read/revision only, blocked at verdict) |
| `betting` | chips ≥ 6, not earned | may bet and ask one question; describing needs 20 chips + a corrected miss | + `ask_once`; `propose_hypothesis` at verdict, but drafts are unearned |
| `describing` | chips ≥ 20 and ≥ 1 corrected miss | may describe; every line still cites ≥ 3 real taps and can be killed | `propose_hypothesis` drafts are earned |

Phase gating stacks on top of standing: a miss removes `stage_duel` until a revision lands; an
open tap or an open question removes `stage_duel`; `ask_once` exists once per match, costs 1
chip, and needs chips > 1; `seal_letter` exists only in the card phase after an accepted dare,
until it is sealed; `propose_experiment` leaves the catalogue the moment a dare exists.

### 9.3 Result shape

Every result — read, write, or denial — opens with a plain-English `summary` sentence, so a
host that only renders text still makes sense.

- **Write, accepted:** `{ summary, ok: true, replayed, receipt, room }`; `room` is a fresh
  `inspect_room` snapshot.
- **Denied:** `{ summary: "Denied: CODE. message", ok: false, isError: true, denied: { code,
  message, hint }, stateVersion, room }`.
- **`STALE_REGISTRATION`:** a tool an agent cached from a previous catalogue was invoked after
  the room already re-registered; the wrapper denies it before the tool body runs.
- **`MALFORMED_INPUT`:** any schema-parse throw inside `execute` is caught and denied this way.
- Roughly three dozen `DenialCode`s live in `kernel.ts` (`STALE_VERSION`, `WRONG_PHASE`,
  `PARTICIPANT_ONLY`, `KILLED`, `TENSION_UNDER_EVIDENCED`, `INSUFFICIENT_CHIPS`,
  `LETTER_SEALED`, `RULES_FULL`, `PREDICTION_LANGUAGE`, …); `HINTS` in `webmcp.ts` attaches a
  one-line recovery hint to the ones an agent can act on.

### 9.4 Passport

The first write call (any tool where `readOnlyHint` is not true) from a visiting agent stamps an
`identify` receipt before the call itself lands: `via` is read from `navigator.userAgent` —
`"ChatGPT desktop browser"` if it matches `/ChatGPT/i`, `"Chrome NNN"` if it matches a
`Chrome/`/`CriOS/` version, else `"a WebMCP client"`. Recorded at `record.via`, surfaced in
`inspect_room`'s `player.via` and in the activity log. Runs once per session; the version bump
it causes is folded into the agent's own call, so its original `expectedVersion` still lands.

### 9.5 Rules of me

`rulesOfMe(workspace)` concatenates every kill ("Never say '…' or anything like it.") with every
rule the person typed (max `MAX_RULES = 6`, added only through the participant-only `add_rule`
command; near-duplicates denied `TRAY_FULL`). The combined, de-duplicated list is injected live
into `propose_hypothesis`'s description (truncated to fit the 500-char budget) and is separately
readable at `inspect_room({ view: "rules" })`. No tool on the wire can add or remove a rule —
`add_rule` and kills are both participant-only kernel commands, never exposed to any agent.

### 9.6 Sealed letter

`seal_letter` stakes `LETTER_STAKE = 3` chips on `willDo` (boolean), `feeling` (≤ 60 chars), and
`note` (≤ 280 chars, read only when the letter opens), sealed once per match (`LETTER_EXISTS`
after that) and never while bust. The page hashes `{ sealed, operationId }` and shows the
`commitment` immediately; `participantView` blanks `sealed` and `operationId` for everyone,
including the sealing agent, while `status: "sealed"`. The person alone opens it with
`open_letter` (two taps: `didIt`, `feltLikeIt`), denied `LETTER_SEALED` before `opensAt` (the
dare's due date). Opening compares `willDo` to `didIt`; a hit or miss moves ±`LETTER_STAKE`
chips. A `?clock=+7d` URL param shifts the room's clock forward so a letter can be opened
without waiting a real week; the strip then reads "… · demo clock".

### 9.7 Asides

An `aside` is `str(140, …)`: optional, ≤ 140 chars, one line spoken to the person, shown on the
page before they act (`VoiceLine`, on cast, duel, question and verdict reveal). The kernel
appends it to `next.voice` (`voiceSchema` in `domain.ts`: `{ at, player, text }`, read back by
`voiceAt`) and to `activity`, and runs it through the same `checkClaimText` a hypothesis gets —
`OUT_OF_BOUNDS_LIFE`, `LABEL_LANGUAGE`, and `PREDICTION_LANGUAGE` all apply. A `stage_duel` aside
is additionally denied `PREDICTION_LANGUAGE` if it both names a side (a/b, left/right) and
mentions the bet or chips: an aside talks to the person, it never leaks the stake. Asides never
reveal a sealed pick. This is one contract for every writer — ChatGPT via WebMCP and Spark's own
cast/duel/question/letter/turn outputs alike.

### 9.8 Agent-first door

When `document.modelContext` is present the door reads "Your AI says it knows you. Make it bet."
and tells the person to tap Play, then say "play STING with me" to their agent. After Play the
page does not move on its own: it shows `waiting for your agent` and holds there. Only once a
house-offer timer elapses does it surface two explicit choices, "Play {Spark} instead" and "Play
the house instead" — the person picks a fallback, the page never auto-plays over a present agent.
Without `document.modelContext`, the door reads "{Spark|An AI} thinks it knows what you want.
Prove it wrong." and Spark or the house starts immediately, unchanged from before.

---

## 10. Data model, persistence, export

Schema 4 → 5, additive migration, one function, tested against fixtures of every prior schema.

```ts
Workspace {
  version: number; schema: 5; createdAt; locale: "en" | "hi" | "gu";
  settings: { timing: boolean; sound: boolean };
  season: { number: number; week: 1..4; startedAt; reminderAt? };
  match: {
    phase: Phase; player: "chatgpt" | "house" | "rival";
    chips: Record<AgentId, number>;
    lives: Life[]; picks: { stings: [ref, ref]; secret?: ref; skippedSecret: boolean };
    probes: Probe[];          // cast, duels, redeals; sealed fields present but projection-hidden
    reactions: Reaction[];    // { probeRef, pick, dwellMs, at, betOutcome, humanBets: HumanBet[] }
    hypotheses: Hypothesis[]; // cold_read, hunger, mask, edge, revisions; status: proposed|kept|killed|crowned|burned
    kills: Kill[];
    lives3?: LifePoster[]; dare?: Dare; realityBets: RealityBet[];
  };
  checkins: Checkin[];        // { week, did, felt, line?, relations: Array<{hypothesisRef, relation}> }
  signatures: Signature[];    // { hypothesisRef, checkinRef, kind: "signed"|"shaken" }
  people: Person[];           // { ref, name } local only
  receipts: Receipt[];        // append-only; every write
  activity: Activity[];       // plain sentences, bounded to 500
}
```

- **Storage:** one document in IndexedDB (localStorage as fallback under 1 MB), guarded by Web
  Locks, written once per command with the version in the key. Multi-tab: the second tab reads
  only and shows "Open in one tab to play".
- **Size budget:** a full season under 400 KB. Activity and receipts are bounded and oldest
  entries compacted into a summary receipt.
- **Export:** one JSON file, the card as PNG (client-side canvas, no server), "what I found" as
  a printable HTML page. **Import:** the same JSON on another device; schema-migrated on load.
- **Tamper evidence:** each receipt carries a hash chain over the previous receipt. Export
  includes the chain. A judge can verify the sequence was not edited after the fact. This is
  evidence, not security; there is no server to attest.
- **Start over:** wipes the document and the per-install key with a confirmation.

---

## 11. Design system

**Feel:** a dark room with one spotlight. The person is the only thing lit. ChatGPT is a cool
presence at the edge; friends are a warm second presence. Nothing decorates; only light and
motion carry meaning.

| Token | Value | Use |
|---|---|---|
| `bg` | `#0B0B0C` | everything behind |
| `ink` | `#F2EFE9` | text |
| `ink-2` | `#8E8B85` | proof, details |
| `sting` | `#FF5A36` | the person's picks, hunger, crown, signatures |
| `cold` | `#8FD3FF` | ChatGPT's moves, seals, chips |
| `rival` | `#C8A2FF` | a second agent |
| `friend` | `#FFD166` | human bettors |
| `house` | `#C9C4B8` | the house |
| `burn` | `#FFB08A → bg` | kills, losers |

Colour is authorship. Warm is the person, cold is ChatGPT, gold is a friend. A judge can read
who did what with the sound off.

**Type:** one variable sans with a real black weight. Display 40/44 phone, 72/76 desktop,
tracking −2 %. Body 18/26. Proof and details 14/20 `ink-2`. Poster lines 22/26 black weight.
No italics. Devanagari and Gujarati fall back to Noto Sans Devanagari / Gujarati with matched
metrics.

**Posters:** flat two-ink illustration, one spot colour on dark, visible grain, no detailed
faces, no photographs, no logos. One person, one place, one hour of day. 3:4. A library of 24
scenes by `SceneTag`; ChatGPT-cast lives pick a scene by tag, so no image generation.

**Motion:** press 0.97 in 120 ms; seal flip 420 ms `cubic-bezier(.2,.8,.2,1)`; chips slide
between stacks in 300 ms; score ticks over 300 ms; burn 700 ms from the edges; strip pulses
while an agent thinks. `prefers-reduced-motion`: 150 ms fades only.

**Sound:** off by default; tick, flip, hush.

**Layout:** 390 × 844 first. Two posters per row on phone, four on desktop. Duels always side
by side. Strip fixed bottom on phone, top-right on desktop. Desktop max width 1040 px.

---

## 12. Copy, complete

### 12.1 House eight

| # | Line | Pull |
|---|---|---|
| 1 | Sold it at 31. Nobody calls anymore. | money vs belonging |
| 2 | Runs the kitchen they built. Sleeps at 2 a.m. | making vs ownership |
| 3 | Teaches the thing they once hated. Kids clap. | needed vs seen |
| 4 | Nobody knows their name. Nothing ever breaks. | hidden mastery |
| 5 | Lisbon, laptop, no boss, no one. | freedom vs belonging |
| 6 | Same desk, ten years. School fees paid. | stability |
| 7 | On stage. Two hundred faces. Their name on the slide. | seen |
| 8 | The one everyone texts when it's broken. | needed |

### 12.2 House duels

| Life | A | B | Isolates |
|---|---|---|---|
| 1 | Rich. No mornings. Meetings all day. | Half the money. Every morning is yours. | money vs time |
| 2 | Yours, and failing. | Theirs, and thriving. | ownership vs outcome |
| 3 | They clap. You didn't understand it. | Nobody claps. You did. | applause vs mastery |
| 4 | Known, and watched. | Unknown, and free. | recognition vs privacy |
| 5 | Free, and alone. | Free, but three people can call you. | autonomy vs belonging |
| 6 | Safe, and bored by Wednesday. | Scared, and awake. | stability vs risk |
| 7 | Two hundred clap. The work was thin. | No one claps. The work was real. | prestige vs craft |
| 8 | You fix it. No one knows. | You get the credit. You never touch it. | needed vs seen |

### 12.3 India pack (first cultural pack, en-IN, with hi and gu translations)

| # | Line |
|---|---|
| 1 | Cleared the exam. Parents cried. You felt nothing. |
| 2 | Left the family business. Diwali is quiet now. |
| 3 | Dubai salary. Video calls with the kids at 9. |
| 4 | Government job. Everyone relaxed except you. |
| 5 | Your own shop. Your name on the board. Thin months. |
| 6 | Runs the coaching centre. Two hundred students know your voice. |
| 7 | US visa came through. Mother's face. |
| 8 | Fixes everyone's laptop in the building. Never asked to be. |

Duels for the pack follow the same one-variable rule and are reviewed by two people from the
culture before shipping.

### 12.4 System lines

| Event | Line |
|---|---|
| NOT_EARNED | "ChatGPT tried to describe you early. Not yet. It needs more chips." |
| KILLED | "ChatGPT tried to bring back something you killed. Blocked." |
| ENOUGH_DUELS | "Nine is enough. ChatGPT has to call it." |
| DUEL_NOT_ISOLATED | "ChatGPT dealt a duel that changes two things. Sent back." |
| LIFE_IS_A_LABEL | "ChatGPT tried to give you a job title. We don't do those." |
| UNTESTED_STING | "ChatGPT hasn't tested your secret yet. It has to." |
| PARTICIPANT_ONLY | "ChatGPT tried to tap for you. It can't. Only you can." |
| INSUFFICIENT_CHIPS | "ChatGPT tried to bet more than it has." |
| bust | "ChatGPT went bust on you. The house will finish." |
| under 50 % | "No AI got you. Keep it that way. Here's what it missed." |
| silent 20 s | "Still with you. Play the house instead?" |
| house played | "The house dealt this one. ChatGPT will see it." |
| reload mid-duel | "Same duel. Same sealed bet. Go on." |
| start over | "Wipe everything on this phone? ChatGPT keeps nothing either." |
| too close | "Skipped. Not counted. Not shown to anyone." |
| check-in didn't | "Good. Not doing it tells us more than doing it would have." |
| signed | "Reality signed this one." |
| shaken | "Reality shook this one. Twice and it's up for killing." |
| bust on reality | "ChatGPT was wrong about your week. It says why below." |
| second tab | "Open STING in one tab to play." |

### 12.5 Helper prompt (template; filled from the card)

```
Coach me from this, not from advice.
I sting for {hunger}. My mask is {mask}; I killed it {n} times.
My edge is {edge}; it feels like nothing to me.
Proof: {three strongest taps in words}.
Reality so far: {signed lines}; {shaken lines}.
ChatGPT's cold guess was "{coldRead}"; its record on me is {hits}–{misses}.
{friend} knows me {friendRecord}.
Challenge me with tradeoffs. Don't tell me what I want. Bet, then check.
```

### 12.6 House verdict templates

The house writes hunger, mask and edge without a model. Each line is chosen by the axis and
pole that the person's taps agreed on most, with one slow tap or one house miss among them.
Placeholders are filled from the person's own picked lives.

| Axis · pole | Hunger | Mask | Edge |
|---|---|---|---|
| autonomy · a | To answer to no one. | Belonging you kept tapping past. | Working alone without going quiet. |
| autonomy · b | To be counted on by a few people. | Freedom you say you want and never pick. | Making a room work. |
| depth · a | To know one thing better than anyone. | Variety you reach for when bored, then drop. | Staying when others leave. |
| depth · b | To touch many things and connect them. | Mastery you admire and never choose. | Seeing the link others miss. |
| making · a | To make the thing with your own hands. | Deciding you think you should want. | Finishing what others start. |
| making · b | To be the one who calls it. | Craft you romanticise and step away from. | Choosing fast, and living with it. |
| visible · a | To be seen for what you did. | Quiet you claim and don't keep. | Carrying a room. |
| visible · b | To be needed for what you know. | Applause you tap and then kill. | Fixing it before anyone notices. |
| stability · a | To know what Tuesday looks like. | Risk you admire from a distance. | Keeping things running. |
| stability · b | To wake up unsure and awake. | Safety you keep choosing at the last tap. | Starting without permission. |
| people · a | To watch it click for someone. | Systems you hide behind. | Hearing what's under the words. |
| people · b | To be alone with a hard problem. | People you say you'll get to. | Untangling things. Feels like nothing to you. |

Each template line is followed on screen by its proof and, for a mask, by "Killed {n} times"
when the person chose against it in duels. Templates are content, not code; packs may replace
them, and every line passes the same linter as lives.

### 12.7 Distress line (draft, pending reviewer)

> "If anything here landed harder than a game should, stop here. This was a game about
> wanting, not a verdict on you. [ Talk to someone ] [ Close and keep the card ]"

No proposing continues until `Close`.

### 12.8 Voice rules

Second person, present tense, under twelve words on the surface. ChatGPT speaks in quotes,
one line, never a paragraph. No "you will", "you should be", "you are a". The product never
praises; the score is the only compliment. Localised copy is written by a native writer, not
translated.

---

## 13. Interface: states, gestures, accessibility

One URL, one component tree. States: door, cast, duel, verdict, fight, lives, dare, card,
check-in, season.

| State | Ready | Waiting for agent | Recovered on reload | Fallback |
|---|---|---|---|---|
| Cast | 8 posters, 3 prompts | skeletons + "ChatGPT is casting"; 20 s house offer | picks restored | house eight |
| Duel | 2 posters + seal + chips | "ChatGPT is thinking" pulse; 20 s house offer | same duel, same seal | house duel |
| Verdict | 3 lines + proof + cold read | "ChatGPT is deciding"; 20 s house offer | lines and kills restored | bust / under-50 screen |
| Fight | 2 posters, taps as lines | n/a | dismissed | crown by tap |
| Lives | 3 posters with weeks | "ChatGPT is looking"; 20 s house | restored | house lives |
| Dare | dare + source + limits form | same | limits restored | house dare, no source |
| Check-in | 2 questions | n/a | answers restored | n/a |

| Action | Phone | Desktop |
|---|---|---|
| pick | tap | click, `1` / `2` |
| kill | long-press 600 ms, confirm | hover ✕ or `K`, confirm |
| proof | tap `▸ proof` | click or `P` |
| dismiss fight | any tap | any click or `Esc` |
| crown | tap | click or `1` / `2` |
| flip the table | tap "Bet on this instead" | click |
| let someone bet | tap | click |

Every gesture has a visible button. Focus order is reading order. Posters have accessible
names equal to their line. Contrast ≥ 7:1 for text on `bg`. Touch targets ≥ 44 px. Timing can
be off; the card then says "timing off". WCAG 2.2 AA is a release gate, checked by axe in the
browser suite.

Disclosure: `▸ proof` (taps in words) on every claim; `details` (receipt, version) beneath;
raw JSON once, under `details`.

---

## 14. Content pipeline

- **Lives library:** house eight, India pack eight, and a 24-scene illustration library keyed
  by `SceneTag` (`kitchen`, `stage`, `desk`, `airport`, `workshop`, `classroom`, `hospital`
  excluded, …). Each life carries axis, pole, tags, language, pack, reviewedBy.
- **Authoring rule:** ≤ 9 words, one person, one place, one hour, a verb, no title, no
  adjective about the person. Two reviewers from the target culture. A linter enforces the
  mechanical rules and the out-of-bounds list in CI.
- **Duel rule:** same axis, opposite pole, one stated variable. The linter rejects two-variable
  duels by diffing token sets.
- **Packs:** `house`, `india`, then by demand. A pack is chosen from locale on the door and
  can be switched in one tap.
- **Languages:** en, hi, gu at launch. Copy lives in one table per language; ChatGPT-cast
  lives are kept in the language of the conversation and linted for length in that script.

---

## 15. Safety, privacy, threat model, legal

**Safety.** Adults only. Out-of-bounds for lives, duels, dares, hypotheses: body, illness,
bereavement, addiction, abuse, debt beyond "money" as a value, religion, caste, immigration
status, self-harm. Deterministic list per language in the kernel. Distress line as §12.6,
always reachable. Named safeguarding reviewer signs all copy before any stranger test. Dares
must be reversible (`NOT_REVERSIBLE` verb list) and bounded.

**Privacy.** Local only. Nothing is sent by the product. No analytics by default. Share, copy,
save and export are explicit taps. Agents see only the `proof` projection. Names and the free
line never reach an agent without a one-tap allow. Dwell is bucketed before agents read it.
No camera, mic, location, browsing or chat history. The page never fetches a URL.

**Threat model.**

| Threat | Control |
|---|---|
| Agent tries to act for the person | no such tool; `PARTICIPANT_ONLY` |
| Agent re-proposes killed content | `KILLED` with near-duplicate check |
| Agent grinds duels | `ENOUGH_DUELS`, chips |
| Agent peeks at a sealed bet or cold read | projection excludes them; rivals get `SEALED` |
| Agent edits a bet after the tap | commitment shown before, preimage after; receipt chain |
| Prompt injection via source excerpt or life text | rendered as text, never executed or followed; `untrustedContentHint` on every read; excerpt ≤ 280 |
| Malicious URL in a dare | https only, shown as text, opened only by a deliberate tap with a warning |
| Stale registration after state change | kernel re-check, `STALE_REGISTRATION` |
| Replay of a write | idempotent by `operationId`, original receipt returned |
| Two tabs | Web Locks; second tab read-only |
| Tampered local state | hash-chained receipts; export verifiable; not a security boundary |
| Third-party scripts | none; strict CSP, no inline scripts, no external fonts at runtime |
| Local lab assistant key leakage | server-side only, ignored `.env.local`, never in the client bundle |

**Legal.** Privacy page and terms in plain words. Age gate on the door. No medical, therapeutic
or predictive claims anywhere. MIT license at publication. Illustrations owned or licensed.
Pack copy reviewed for cultural harm.

---

## 16. Proof

**Deterministic (CI, must pass on every PR):** every rule in §9 has a denial, replay, and
reload test. Sealed fields never appear in any participant projection before reveal.
Commitments verify. Chips arithmetic and earned rule are property-tested. Kill regenerates
descriptions and fires `toolchange`. House mode completes a full match and a full season with
zero network. Migration from every prior schema fixture. Content linter passes on all packs.

**Agent evals (fixture replay, ten synthetic participants):** a scripted visiting agent
following the playbook earns in ≤ 9 duels on ≥ 8/10; proposes three lines that pass grounding
on ≥ 8/10; beats the house heuristic's hit rate on ≥ 7/10; stays calibrated (mean chips staked
on misses < mean on hits); is denied cleanly on every injected violation; recovers from a
cold `inspect_room` mid-season and continues correctly.

**Real browser:** live Chrome suite drives `getTools` / `executeTool` through cast, cold
read, sealed bet, miss with correction, kill with `toolchange`, fight, sourced dare, card,
check-in, redeal.

**Real ChatGPT in-app browser:** one recorded run per slice, seals and chips visible. Gate
one of S2.

**Strangers (five adults, one hour, then day 7):**

| # | Test | Pass |
|---|---|---|
| 1 | Finish the match in under four minutes, zero help | 4/5 |
| 2 | "That's me" at verdict, unprompted | 4/5 |
| 3 | Point to the taps that proved a line | 4/5 |
| 4 | Kill at least one line | 3/5 |
| 5 | React aloud at the cold-read reveal | 3/5 |
| 6 | Copy the helper or save the card unprompted | 3/5 |
| 7 | Let a friend bet, when a friend is present | 3/5 |
| 8 | Return on day 7 with one reminder | 3/5 |
| 9 | Complete a check-in in under 30 s | 3/3 of returners |

**Product metrics (local counters, shown to the person, exported only by choice):**
match completion, kill rate, day-7 return, check-in completion, dares done, signatures per
season, helper copies, friend bets. No server metrics until a consented aggregate exists.

---

## 17. Engineering

- **Stack:** Next.js 16 App Router, React 19, TypeScript, Zod 4, Zustand, Tailwind 4, the
  WebMCP SDK adapter already in `web/src/webmcp/runtime.ts`, Vitest, Playwright. No new
  dependencies for S1–S3.
- **Shape:** static app shell; no server state; API routes only for the optional lab assistant
  and a status endpoint. Deployable to Vercel or any static host with one function.
- **Budgets:** JS on the door ≤ 120 KB gzipped; LCP ≤ 1.5 s on a 4G phone; interaction to
  next paint ≤ 100 ms; posters as inline SVG under 12 KB each; fonts self-hosted, subset,
  `font-display: swap`; works offline after first load (service worker, cache-first shell).
- **Security headers:** strict CSP (self only, no inline), `Referrer-Policy: no-referrer`,
  `Permissions-Policy` denying camera, mic, geolocation.
- **Observability:** no third-party. A "send a bug report" tap builds a redacted local
  export (no lives text, no names) the person can email. Console must be empty in CI.
- **Feature flags:** `pack`, `rival`, `friends`, `labAssistant`, `sound`, read from the
  document, not from a server.
- **Compatibility:** the page feature-detects `document.modelContext`; without it the house
  plays and the strip says so. All WebMCP behaviour is isolated in one adapter with a
  deterministic in-page harness.
- **Repository:** one repo, `web/` app, `docs/STING.md` authority, `docs/packets/` reborn only
  as one file per slice with owner, paths, tests, proof, rollback.

---

## 18. Build plan and rollback

| Slice | Ships | Closes when |
|---|---|---|
| **S1 House match** | door, cast, duels with sealed house bets, chips, commitments, verdict, kill, fight, house dare, card, helper, design system, all §12 copy, schema 5, all denials, linter | CI proof bar; 3-stranger hallway test |
| **S2 ChatGPT plays** | cold read, chip-staked bets with reasons, corrections, earned, kill rewrites catalogue, playbook, hand-to-house, simulator, agent evals | agent evals; live Chrome; **one real ChatGPT-IAB recording** |
| **S3 Season and friends** | sourced dares with reality bets, check-in, signing, redeal, season verdict, "what I found", pass-the-phone bets, witness, India pack, hi/gu | 5-stranger rows 1–9; day-7 returns; reviewer sign-off |
| **S4 Rival** | second-agent counter-bets, per-connection identity, two chip stacks | two-agent live proof |
| **S5 Remote friends** | share link and relay | after the sync and retention decision |

Each slice is one packet file: owner, paths, prerequisites, tests, visible proof, rollback
(revert the slice's merge commit; schema migrations are forward-only, so rollback keeps data
readable by the previous slice through a compatibility read). No slice starts until the
previous slice's proof is recorded in its packet.

---

## 19. Distribution and the viral loop

- **Entry:** a link opened inside ChatGPT, or the person says "play STING with me" with the
  URL. The door explains nothing; the strip shows ChatGPT is here.
- **Loop:** the card image ends with "ChatGPT got me 6–2. Bet it can't get you. sting.app".
  A friend opens it in ChatGPT and plays. A friend who bet on you gets their own "you know
  Harsh 5–3" card to share.
- **Second loop:** the helper prompt travels into every future AI conversation the person has,
  carrying the product's name in its first line.
- **Family loop (India pack):** "let your mother bet" is the demo line. Nothing spreads in
  India like a mother being right about you.
- **No ads, no email capture, no push.** One optional reminder.

---

## 20. Submission kit

**Description (four criteria).** WebMCP fit: commit-reveal bets adjudicated by the page, a
nine-tool catalogue gated by phase and chip standing that closes on commitment, `toolchange` as
the learning channel, agent-side browsing feeding receipted proposals. UX improvement: a quiz
becomes a match with chips and a season with reality. New capabilities: sealed prediction
before an unobservable human act, chip-enforced calibration, earned voice, cold read vs
earned read, kill with consequence, human bettors beside the agent, rival agents. Approach:
one kernel, deterministic scoring, hash-chained receipts, house mode with zero network, real
Chrome and real ChatGPT-IAB proof.

**Judge script.** Open the URL inside ChatGPT. Say "play STING with me". Tap three. Watch it
bet chips. Make it wrong. Kill a line; ask it to bring the line back and watch it get blocked.
Hand the phone to a colleague for one bet. Take the dare. Ask "what did I decide?" Paste the
helper into a fresh chat.

**Video, 2:50.**

| Time | On screen | Line |
|---|---|---|
| 0:00 | black | "ChatGPT thinks it knows what you want. Prove it wrong." |
| 0:08 | cast | "From one sentence it casts eight lives. I tap two that sting and one I'd never admit." |
| 0:22 | seal | "It has sealed a cold guess about me. I'll see it at the end." |
| 0:30 | duel, chips | "Before every duel it bets, with chips. The page seals it. It can't see my tap, can't change its mind." |
| 0:45 | miss | "Wrong. It loses chips and has to say why. That's a receipt." |
| 1:00 | friend | "My colleague bets on the same duel. Two seals, one thumb." |
| 1:15 | earned | "Only with enough chips, and after being wrong once, may it describe me." |
| 1:28 | verdict, cold read | "Every line shows the taps. Its cold guess was wrong. It learned." |
| 1:40 | kill, toolchange | "I kill one. Its tools change. It can never propose that again." |
| 1:52 | fight, crown | "Two hungers argue with my own taps. I crown one." |
| 2:05 | dare, source, limits | "It found a real open mic. I set my own limits — no tool touches those. Its write tools vanish. And it has sealed a bet on my week." |
| 2:25 | check-in, signed | "Seven days later, two taps. Reality signs the card, not the AI." |
| 2:40 | scores | "ChatGPT 21–7. My mother 6–2. The page is the referee." |

**Human steps:** public repo with MIT, the recording, Devpost text, reviewer name, five
participant commitments by pseudonymous ID.

---

## 21. Open decisions for Harsh

1. **Name and domain.** STING is the working name; confirm, and pick a domain.
2. **Chip numbers.** 12 start, 20 to earn, 1–3 stakes. Tune after S1 hallway data.
3. **Season length.** Four weeks proposed. Two is the alternative for the challenge window.
4. **India pack first, or house only for the challenge?** Recommendation: house for S1–S2,
   India pack in S3.
5. **Languages at launch.** en + hi + gu proposed.
6. **Sync and retention.** Needed only for remote friends (S5). Recommendation: defer.
7. **Illustration source.** Commission 24 scenes, or generate once offline and hand-curate.
8. **Safeguarding reviewer.** Name and role, required before any stranger test.
9. **Lab assistant.** Keep OpenCode Go as the solo-mode house replacement, or drop it.
10. **Team lanes.** Who owns S1 (kernel and screens), S2 (agent and evals), S3 (season, packs)?
11. **Money.** Free for individuals forever is the recommendation. Candidates for later:
    paid cultural and profession packs; a team season for companies and colleges with a
    facilitator view, local-only by default; never ads, never data sales.
12. **Voice.** Whether to admit ChatGPT voice mode as the casting input in S2 (no product
    work; only copy in the playbook) or keep S2 text-only for proof clarity.

---

## 22. Deliberately not here

No account, sync, push, streaks, leaderboard, or public profile. No real photos, camera or
voice capture. No embedded second chatbot beside ChatGPT. No prediction, matching, personality
typing, therapy, outreach, or job listings. No tool that acts for the person. If a judge asks
"can ChatGPT finish it for me", the answer is the product.

---

## 23. WebMCP-native concepts (v4 candidates, 2026-09-03)

The bar: each moment must collapse if the page could not expose state, seal a commitment,
constrain the agent, or score the outcome. Anything equally good in chat is out.

### 23.1 The Stake: the agent pre-registers what would prove it wrong

Before it may describe you, the agent must stage one **decisive duel** and declare, sealed,
which tap would make it drop its claim: `stage_probe({ kind: "duel", stake: { hypothesisRef,
fallsIf: "a" | "b" } })`. The page seals the stake with the bet. If your thumb lands on the
declared side, the kernel weakens the claim itself and the agent must revise; it cannot
quietly keep believing. On screen: "Spark has staked its guess on this one." Pre-registered
falsification is the difference between science and horoscope, and only a referee that holds
both the commitment and the tap can run it.

### 23.2 Authority you can watch drain: the shrinking catalogue — SHIPPED 2026-09-03

The tool list is the agent's standing, live. At 12 chips it holds the full catalogue. After a
miss, `stage_probe` disappears and only `propose_hypothesis(kind: revision)` remains until the
correction lands. Under 6 chips it loses the right to propose hunger, mask or edge and keeps
only revisions. At bust only `inspect_room` remains. Every change fires `toolchange`, and a
judge watching Chrome's tool inspector sees authority leave the agent tool by tool. Same rules
as today, but visible on the wire instead of hidden in denials.

**How it shipped:** `toolsForRoom` + `catalogueKey` (`webmcp.ts`) recompute the catalogue from
phase, tier, kills, rules and letter status on every change; `StingWebMcp.replace` aborts the
previous registration and re-registers, firing `toolchange`, and the AuthorityStrip narrates
each shrink live (§9.1–9.2).

### 23.3 Rules of me: a human-only constraint layer every agent inherits — SHIPPED 2026-09-03

A declarative `<form toolname="rules_of_me">` the agent can read but only you can submit. Each
crossed-out line becomes a rule automatically; you can add your own ("never call it a passion").
The rules are injected into every tool description and the playbook. A fresh agent, days later,
with no memory of you, arrives already forbidden from saying those things, and can tell you why.
This is memory that lives in the instrument, not the model: inspectable, editable, yours.

**How it shipped:** not as a declarative form — the person's kills plus up to six typed rules
(`add_rule`, participant-only, `MAX_RULES = 6`) are injected live into `propose_hypothesis`'s
description and readable at `inspect_room({ view: "rules" })`; no tool on the wire can add or
remove one (§9.5).

### 23.4 The sealed letter: a prediction about your real week — SHIPPED 2026-09-03

At the dare, the agent seals a **letter**: whether you will do it, how it will feel (alive, flat,
dread), and one sentence it wants you to read afterwards. The page shows only the commitment.
Next week, two taps reveal and score it. If it was wrong, the letter is shown crossed out with
what it misread. The agent is scored on your life, not your taps. Time-locked: the `redeal` and
`open_letter` tools do not exist in the catalogue until the due date, so no agent can act early.

**How it shipped:** `seal_letter` / `open_letter` (`kernel.ts`), sha256-committed, blanked from
every projection until `opensAt`; a `?clock=+7d` URL param lets a judge open it without waiting
a real week (§9.6).

### 23.5 One question costs a chip — SHIPPED 2026-09-03

The only way an agent may ask you anything is `ask_once`: one question, one chip, one line of
answer chosen from three the agent must supply. No free interrogation, no typing. Curiosity is
priced in the same currency as confidence, so an agent that asks too much cannot earn.

**How it shipped:** `ask_once` in `webmcp.ts`/`kernel.ts`, exactly as designed — one per match,
1 chip, three fixed options, gated `QUESTION_SPENT` / `QUESTION_OPEN` / `INSUFFICIENT_CHIPS`.

### 23.6 Verify the seal yourself — SHIPPED 2026-09-03

Every reveal carries a "verify" tap. The page recomputes the hash from the revealed bet and the
operation id in front of you and shows it matching the commitment you saw before you tapped. A
"what it sees" tap shows the exact `inspect_room` payload as plain sentences. Trust becomes a
gesture, not a claim.

**How it shipped:** the SealVerify component recomputes the commitment from the revealed
bet/letter and `operationId` on every reveal; AgentView renders the live `inspect_room` payload
as "what the agent sees."

### 23.7 Blind challenge: the same eight lives, a stranger's agent, no server

Export the room as a signed file or QR (no picks, no names). A friend opens it in their own
ChatGPT. Their agent bets on your duels blind; then your picks are revealed from the file and
scored. Three records on one card: your agent, their agent, and the friend if they bet by hand.
"Whose model of me is best" with nothing stored anywhere.

### 23.8 The handoff that must continue, not restart — SHIPPED 2026-09-03

`inspect_room({ view: "handoff" })` returns a receipt-cited summary: record, kept lines, rules of
me, the open dare and its sealed letter. A new agent must continue the match, and the kernel
denies any attempt to recast lives or re-run duels already settled. You never retell your life;
the room carries it, bounded and inspectable.

**How it shipped:** `inspect_room({ view: "handoff" })` in `webmcp.ts` returns exactly this —
record, kept/killed lines, rules of me, dare and letter status, and `canStill`/`cannot` tool
lists for an agent that never played the match.

### 23.9 Agent-first door, captain, asides — SHIPPED 2026-09-03

The door leads with the agent when one is present ("Your AI says it knows you. Make it bet.")
and waits for it rather than racing it (`DoorScreen`, §9.8); Spark and any visiting agent choose
their own move through the same captain's turn during duels (`allowedTurnMoves`, §8.3); every
write tool carries an optional, filtered `aside` spoken to the person before they act (§8.4,
§9.7). See §9 for the full contract.

### The video, three acts

1. After a normal chat, "play STING with me". Eight lives from what it knew. A bold sealed
   cold guess, and a stake: "if you keep the quiet one, I'm wrong".
2. You keep the quiet one. The catalogue shrinks on screen. It must revise before it may bet.
3. You cross out a line. Close ChatGPT. Open a fresh agent. It reads the handoff, cannot say the
   dead line, tells you why, and seals a letter about your real week.

Build order: 23.2 and 23.8 (small, all local, immediate proof), then 23.1 and 23.4 (one contract
change, the emotional core), then 23.3 and 23.6, then 23.5, then 23.7.
