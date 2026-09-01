# Submission kit — Destiny.AI

Everything a person needs to record the video, write the Devpost description, and run the judge
script. Facts below are true of commit `4b25498` on `codex/spx-18-candidate-v2`; update the SHA
when the candidate is frozen.

## One-line pitch

A governed decision lab where a person who feels stuck and ChatGPT work on the same Route Room:
ChatGPT can read, ask, and propose; only the person can decide; every move leaves a receipt both
can see.

## Devpost description (draft, edit freely)

**What it does.** Most people who feel stuck do not need a prediction. They need one direction
worth testing this week. Destiny.AI asks three questions in your own words, records your real
limits, and hands the room to ChatGPT. ChatGPT reads the room through WebMCP and proposes three
different routes, Closest, Bridge, and Probe. Each route quotes your exact words, stays inside
your limits, and contains a test small enough to reverse in a week. If your words are too thin,
ChatGPT asks one question instead of guessing. You edit, set aside, or choose. ChatGPT may replace
only the route you set aside and must carry the rest over unchanged. The room shows who proposed
what, every receipt, and every denial. You alone choose. ChatGPT reads the decision back.

**Why WebMCP.** The website is the tool server and the shared instrument. The catalogue changes
as the person acts: before words are confirmed ChatGPT can only read; after, it can propose; while
three routes wait, it cannot propose again; after a route is set aside, it can replace exactly that
one; after a choice, the write tool disappears. Every agent write goes through the same command
kernel as every human click, with `operationId` and `expectedVersion`, replay-safe retries, typed
denials, and receipts. The person's answer boxes are declarative WebMCP forms: ChatGPT can draft
into them, but only the person can confirm. Nothing the agent can read is hidden from the person:
a "See what ChatGPT sees" panel shows the exact orientation the agent receives; private notes never
appear in it.

**New human-agent capabilities.** Ask before guessing (a receipted follow-up question the person
answers in the room). Replace only what I set aside (kernel-enforced carry-over). Grounding
highlights (hover a route, see the exact sentence it quotes light up in your words). A live
activity drawer of reads, proposals, denials, and receipts in plain sentences. Reopen a chosen
direction with a receipt. Start over and export at any time.

**How we built it.** Next.js 16, TypeScript, Zod. One versioned local workspace in the browser with
Web Locks. One command kernel that validates, applies once, and writes a receipt. Bounded read
projections with cursors and byte budgets. A thin WebMCP adapter over `document.modelContext`
that registers only phase-relevant tools and re-checks every cached invocation in the kernel. An
optional embedded lab assistant through the AI SDK behind explicit consent and a deterministic
grounding validator, using the same command with `embedded_inference` provenance. A visiting-agent
simulator for evals. Proof: 180 unit and contract tests, a ten-test browser journey suite, and a
six-test suite that drives real Chrome with WebMCP enabled through `getTools` and `executeTool`.

## Video script (under three minutes)

| Time | On screen | Voice |
|---|---|---|
| 0:00 | Welcome screen | "Most people who feel stuck do not need a prediction. They need one direction worth testing this week." |
| 0:12 | Shape, three answers, limits | "I answer three questions in my own words and set my real limits. Nothing here is a form for a model. These are my words." |
| 0:40 | Handoff screen, badge "Agent connected", capability line | "The room now says ChatGPT can propose. Before I confirmed my words, it could only read. The tools change as I act." |
| 0:50 | ChatGPT in-app browser: type "Read my Destiny room and propose three routes" | "ChatGPT reads the room through WebMCP." |
| 1:00 | Follow-up card appears | "It did not guess. It asked one question first, and that question is a receipt in my room." |
| 1:08 | Answer, then routes appear with "Proposed by ChatGPT" | "Three different directions, each quoting my exact sentence." Hover Bridge; highlight. |
| 1:25 | Set Probe aside; type "Replace the route I set aside" | "ChatGPT may replace only what I set aside and must keep the rest unchanged. The kernel enforces it." |
| 1:40 | Try "Propose three new routes" while routes wait; denial notice | "When it tries to overwrite routes I kept, the room says no, and I can see that too." |
| 1:50 | Choose Closest; receipt line | "Only I can choose. One direction moves forward with a receipt." |
| 2:00 | Type "What did I decide?" | "ChatGPT reads my decision back exactly. The write tool is gone." |
| 2:10 | Open "What happened" and "See what ChatGPT sees" | "Every read, proposal, denial, and receipt in plain sentences. And this is everything the agent can see. My private notes are not in it." |
| 2:35 | Start over | "Two chairs, one table. The agent gains evidence, never authority." |

## Judge script (also in README)

1. Open the live URL in the ChatGPT in-app browser (or Chrome with `chrome://flags/#enable-webmcp-testing`).
2. Press Start, pick a shape, answer three questions, confirm your words, set limits.
3. In ChatGPT: "Read my Destiny room and propose three routes."
4. If it asks a question, answer it in the room. Hover a route to see the words it quotes.
5. Set one route aside. In ChatGPT: "Replace the route I set aside."
6. Choose a route. In ChatGPT: "What did I decide?"
7. Open "What happened" and "See what ChatGPT sees".

## Human steps before submitting

See `docs/packets/P11-handoff-tickets.md`, release gate section.
