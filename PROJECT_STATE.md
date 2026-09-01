# Destiny.AI — Project State

**Last updated:** 2026-09-01

## Objective

Deliver a strong ChatGPT WebMCP competition candidate. A career-stuck adult moves through a short,
guided Destiny Journey, sees three grounded routes in a shared Route Room, chooses one to test, and
retains control of every durable decision. ChatGPT uses the site's WebMCP tools to read and change
the same governed state the participant sees. The product does not predict a career.

## Current authority

- **Contract:** `SPEC.md`
- **Accepted decisions:** `docs/DECISIONS.md`, through D-014
- **Delivery programme:** `docs/PLAN.md`
- **Active packets:** `docs/packets/P3-hypothesis-collaboration.md` and
  `docs/packets/P8A-webmcp-foundation.md`
- **Canonical repo:** `/Users/harsh/career-lab`; Next.js app in `web/`; integration branch `main`
- **Current authority branch:** `chore/docs-declutter`; the exact A0 head is recorded in PR #4 and
  SPX-14 at closeout
- **Execution tracker:** [Linear — Destiny.AI Build & Proof](https://linear.app/harsh-shah/project/destinyai-build-and-proof-5987c83d1c4c/overview)

Repository documents are product authority. Linear mirrors owners, dependencies, and delivery
status. A task is not complete because a ticket says so; its packet and PR must contain the proof.

## Accepted experience

- Promise: “You do not have to choose your whole career. Find one direction worth testing next.”
- Audience: adults who feel stuck; the first choice adapts the journey without labelling the person.
- Primary surface: ChatGPT conversation through WebMCP.
- Shared visual surface: the Route Room on the website.
- First reveal: Closest, Bridge, and Probe route previews with exact quote sources, constraints, and
  a test of seven days or less. They are not ranked answers.
- Human gate: the participant edits or rejects previews, then `choose_route` is the single acceptance
  command that creates the accepted P3 hypothesis and receipt.
- Inference: OpenCode Go Luna through AI SDK is optional and replaceable. EVE is deferred because no
  durable orchestration need has been proven.

## Integrated base

P0A, P1, and P2 are integrated on `main` through PR #1 and PR #2. The base currently provides:

- one schema-versioned local workspace;
- a shared command kernel with `operationId`, `expectedVersion`, replay protection, stale denial,
  typed results, and receipts;
- `save_reflection`;
- bounded `read_workspace` projections and fixtures.

On the integrated P2 head, 36 focused tests, lint, types, build, CI, and a local browser journey
passed. On this documentation branch at `5247199`, `npm run check` also passed before the current
authority revision. This is local/CI base proof only—not P3, live WebMCP, deployment, participant,
public-source, video, or submission proof.

## Active dependency-closed work

1. **SPX-14 / A0 authority:** this D-014 experience, contract, tickets, and PR stack must land first.
2. **SPX-15 / A1 / P3A domain:** Devarsh owns `propose_route_set`, participant-only
   `revise_route_set` and `choose_route`, route and
   accepted-hypothesis schemas,
   migration, fixtures, denials, replay, compensation, and receipts.
3. **B1 / P8A WebMCP foundation:** Harsh owns feature detection, abort-safe registration, bounded
   reads, method guide, deterministic harness, and absent-runtime behavior. It may run from the
   exact A0 head in parallel with A1.
4. **SPX-16 / A2 / P3B journey:** Tirth stacks the guided onboarding and Route Room on the frozen A1
   contract.
5. **C1 / P8B:** Harsh combines integrated P3 and P8A into the ChatGPT write journey and evals.
6. **C2/C3 / P8C:** harden, freeze, deploy, prove in ChatGPT, and assemble exact submission receipts.
7. **D1 / P9:** AI SDK plus OpenCode Go Luna remains a separate optional adapter PR and never blocks
   the provider-free candidate.

## Chief-of-Staff coordination

The `Destiny.AI Chief of Staff` thread heartbeat is active every 30 minutes. It reviews completed
task results and repository gates before sending follow-ups or opening dependency-ready work. Four
first-wave reviews—product, WebMCP, runtime, and PR stack—are complete. Their accepted conclusions
are reflected in D-014 and the current packet sequence.

## Remaining gates

- P3 domain and human journey: not implemented.
- Native WebMCP registration and tool execution: not implemented or runtime-proven.
- OpenCode Go Luna adapter: not implemented or live-proven.
- Human usefulness: not tested; a qualified safeguarding reviewer and adult commitments remain
  required before participant sessions.
- Deployment, public repository/license, public video, testing instructions, and submission: not
  completed.
- Current A0 check: 36 tests, lint, types, and production build passed on 2026-09-01. It must run
  again on every implementation and candidate SHA.

## Owner input still required before participant testing

1. Name the qualified safeguarding reviewer for distress copy.
2. Record five adult participant commitments using pseudonymous IDs only.
3. Keep Linear Free with all three users as admins or authorize paid member roles.

These do not block synthetic-fixture implementation and deterministic testing.

## Supersession receipt

D-014 supersedes the sterile linear presentation of the competition flow and the earlier Career
Investigation Board draft. D-013's official deadline and truthful narrow-candidate boundary remain
current. Pre-2026-09-01 whiteboards, the student seven-day-plan MVP, and the eight-internal-agent
concept remain archived under `docs/archive/2026-09-01-foundation/`.
