# STING — Once and Done

**Status:** PROPOSAL, written 2026-09-03. Not authority. Supersedes nothing until Harsh accepts it as a decision (it would become D-020).
**Builds on:** SPEC 2.0.0 / schema 4, D-017–D-019, P13 frozen candidate on `main`, bones of P12 deck (cards, swipes + dwell, tensions, portraits, 3 routes, receipts, WebMCP).
**Rule:** do not touch the frozen candidate. This is post-submission only, clean tree off `main`.

---

## 1. The whole thing in 20 seconds

One page. No login. No typing. 90 seconds.

> 8 lives. Pick the 2 that sting. Kill the fake part. Keep the hunger. Leave with one page that helps you for life.

No story needed. No homework outside. All crazy happens inside.

---

## 2. Why this, not cards

Likes lie. Envy doesn't.

- "Do you like this?" → polite answer.
- "Does this hurt to look at?" → thumb moves before brain lies.

Tradeoffs beat opinions. Everyone says they want money. Show money-with-no-mornings vs mornings-with-half-money and the truth pops in 2 taps. No quiz gets that.

This works for a 17-year-old and for Elon with the same screen. Both feel sting.

---

## 3. The 90-second flow

### Round 1 — STING (30 sec)

Black screen. 8 faces in a grid. Image + 3 words each. No sentences to read.

```
[ Free One ] [ Rich One ] [ Seen One ] [ Calm One ]
[Needed One] [ Wild One ] [Master One] [Loved One]
```

Top line, huge:

> Which two hurt to look at? Tap them.

Tap = sting. Tap again = un-tap. 2 max. Button lights when 2 picked:

> [ See why it hurts → ]

No timers yet. Let them feel. Measure dwell silently (fast = gut, slow = wound). Never show dwell.

### Round 2 — STRIP (30 sec)

Take sting #1. Strip the fake off.

Example: you picked Rich One.

Card flips, full-screen:

> Rich with money, no mornings. Meetings all day.
> Still sting? [ STILL HURTS ] [ GONE ]

You tap GONE. Next:

> Rich with mornings, half money. Still sting? [ STILL HURTS ] [ GONE ]

You tap STILL HURTS. Done. We learned: you never wanted money. You wanted mornings.

Do same once for sting #2. Max 4 taps. Each duel is 5 sec, tick sound, must pick. No skip — passing *is* data, but here we force the cut. That's the fun.

Plain denial if they try to game it: "Pick one. Both can't survive."

### Round 3 — SHOW (30 sec)

Lights up. Your face in middle sharpens (was blurred, now clearer with each tap — the only viz, alive, no chart).

Three lines, plain words. No lab terms.

```
YOUR HUNGER
To be needed for what you know.

YOUR MASK
Chasing Dubai money to shut the noise. Your taps killed it twice.

YOUR EDGE
Explaining tangled things simply. Feels like nothing to you.
Feels like magic to others.
```

Tap any line → the 3–4 taps that proved it fan out. Kill it if we're lying (long-press → "Killed. Noted."). Killing teaches us, counts as signal.

Then 15-sec fight: your two hungers as two faces argue with your own taps as lines. You crown winner. Loser burns. Feels like directing your own movie.

Then roast (shareable, funny, true):

> "You want depth but check views every 10 minutes. Pick a god."

[ Share hunger card ]  [ Take me to ChatGPT → ]

Done. 90 seconds.

---

## 4. Words we use / words we ban

Use: sting, hurts, gone, hunger, mask, edge, keep, kill, face, life, mornings.

Ban from screen forever: deck, card, probe, tension, portrait, route, hypothesis, evidence, verdict, pattern, receipt, operation, WebMCP, agent, prompt pack, kernel. Those live in code only.

If a 12-year-old doesn't get the word, it doesn't ship.

---

## 5. What you leave with

One page, yours, printable, copyable:

- Your line (your taps, sharpened): "Garage over mall, 3 times."
- Hunger / Mask / Edge (3 lines above).
- Proof (tap to see taps, no JSON).
- Helper button: copies ~800 chars any AI understands in a new chat:

```
I sting for being needed + mornings. Mask is Dubai money.
Edge is explaining tangled things. Proof: kept mornings twice,
killed pure-money twice. Coach me from that. Challenge me with
tradeoffs, not advice.
```

Paste into ChatGPT / Claude / Gemini. No app needed again. Used once here, helped for life there.

Optional: time capsule email ("ask me in 1 year if I kept mornings"). Nothing else. No streaks, no spam.

---

## 6. How it reuses our bones (builder only, never user-facing)

| Old bone | New skin | Change |
|---|---|---|
| `cards` (36 sentences) | 8 lives + 8 strip duels (image + ≤12 words) | content swap, same `deal_cards` |
| `swipe {me,not_me,wish,used_to}` + reasons | `sting {keep, kill}` + dwell only | drop reasons gate, keep dwell |
| `tensions` | hunger / mask / edge (same type, new labels) | no schema break, just claim templates |
| `portrait` | sharpening face (same bundle of 2–3 hungers) | UI only |
| `route set (3)` | 3 lives as posters (same 3-slot type) | UI only |
| activity ledger | fight commentary ("Rich-money died. Mornings survived.") | copy only |
| 6 WebMCP tools | same 6, hidden. No new tools in S1. | invisible |

Schema stays v4. No migration in S1. All existing receipts, replay (`operationId` + `expectedVersion`), stale denial, reload recovery keep working.

Agents become characters, not tools:
- Dealer → casting (picks which 8 lives, which duel splits you fastest)
- Skeptic → roast + strip duels
- Reader → hunger/mask/edge lines
All through same kernel, `chatgpt_webmcp` provenance. User never sees names.

---

## 7. Truth rules (plain, testable)

1. Sting needs 2 picks, max 2. Less = "Pick one more that stings."
2. Strip needs both halves of a duel answered. Same duel twice = replay returns first receipt, no double count.
3. Hunger needs ≥3 stings/duels pointing same way + 1 slow tap or 1 contradiction. Else `not enough yet — one more cut`.
4. Mask needs killed-money-or-fame twice. Never label trauma, parents, money shame beyond what taps show. No diagnosis, no therapy. If words get heavy → stop game, show support line, human gate (existing D-008 boundary stays).
5. Edge needs witness-free signal in S1 (what felt easy + kept). Witnesses come in S3, human-only, consent.
6. No agent ever stings, kills, or crowns for you. Kernel denies it. Only you tap.

---

## 8. Safety + privacy

- Adults 18+ for any test (D-004 stays).
- Local-only in S1. No account, no server, no analytics. Share + copy are explicit taps. Start over wipes both keys with confirmation (existing behavior).
- Images are illustrated archetypes, not real people, not your photo in S1. No camera/mic stored. Voice input deferred to S3 — S1 is tap-only so IQ 80 → Elon equal.
- Distress copy gate (D-008) stays: if mask language touches shame, we soften, stop proposing, point to support. Named reviewer still required before 5-person test.

---

## 9. How we know it worked (5 strangers, 1 hour)

1. 4/5 finish 90 sec with zero help.
2. 4/5 say "shit, that's me" unprompted at SHOW.
3. 3/5 share roast or copy helper without being asked.
4. 3/5 can point to which taps proved their hunger (tap-to-proof works).
5. Zero console errors, reload mid-STRIP recovers same duel, replay same `operationId` doesn't double-count.

Not measuring: retention, daily use, company creation. S1 proves one-shot truth + takeaway. S2/S3 prove compounding.

---

## 10. Build in 3 slices (each shippable, each off `main`)

**S1 — Sting + Strip + Show (fixtures only, no models).**
8 illustrated lives, 8 duels, hunger/mask/edge templates from existing tension logic, sharpening face (CSS only), roast card, helper copy. `npm run check` + 5-stranger hallway test above.

**S2 — Fight + Trailers.**
Two hunger faces argue (fixture script first, lab-assistant optional behind consent, suppressed when ChatGPT connected). 3 lives as posters with 15-sec cut (images + lines). Fake-coin crowning. Same kernel, no schema break.

**S3 — Witness + Helper live.**
Human-only witness ("swipe about Priya"), second-agent dissent (Gemini reads ChatGPT's hungers, files visible note), live helper eval (paste into fresh ChatGPT, does it coach better?). Needs safeguarding reviewer + consent copy before any real content leaves browser.

Each slice: owner, paths, tests, visible proof, rollback (revert to P13 candidate). No slice touches `codex/spx-32-deck` until S1 proves the 5 checks.

---

## 11. Keep / Kill

Keep: one kernel, receipts, human-only tap/crown/kill/copy, bounded reads, replay/stale safety, local-first, no prediction/therapy/send, no-agent mode ( fixtures carry whole game).

Kill from screen: all lab words (§4), reason chips, 4-way reactions, limits-before-value, history JSON, agent-view JSON, counters, footers. Keep them in code, hide them from humans.

---

If Harsh accepts, this becomes D-020 and re-cuts P4–P7/P10 into S1–S3 above. Until then it's brainstorm, not authority.
