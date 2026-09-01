# P11 handoff tickets

Mirror these into Linear under the Destiny.AI Build & Proof project. Each ticket follows the
CONTRIBUTING reading order: outcome, why unblocked, owner and paths, contract, acceptance
criteria, proof commands, rollback, out of scope, related packet. `HUMAN` marks a step only a
person can do or verify.

## Release gate (Harsh, integration captain)

### SPX-19 · Deploy the exact candidate SHA and read it back

- Outcome: a public URL serves the candidate; `read_workspace` orientation from that URL reports
  `contractVersion 1.2.0`, `schemaVersion 3`, `readContractVersion read-workspace/3.0.0`.
- Why unblocked: `npm run check`, the journey suite, and the real-Chrome suite pass on the branch.
- Paths: hosting config only (Vercel or Netlify); no product code.
- Acceptance: HTTPS URL; `Origin-Agent-Cluster` header absent or `?1` (WebMCP is disabled when
  `document.domain` is enabled via `?0`); no `tools` Permissions-Policy restriction on the page;
  first load shows the welcome screen without console errors.
- Proof: `docs/proof/p11/deploy.md` with URL, SHA, `curl -I` headers, and a screenshot of the
  agent view panel showing the identity block. `HUMAN`.
- Rollback: redeploy the previous SHA; local data is unaffected.

### SPX-20 · ChatGPT in-app browser run, recorded

- Outcome: a fresh ChatGPT session opens the deployed URL in the in-app browser, reads the room,
  asks a question or proposes, replaces a set-aside route, and reads the decision back.
- Script: README "Try it in three minutes". Type the three prompts exactly.
- Proof: screen recording plus the activity drawer screenshot showing receipts; note every
  denial ChatGPT hit and what it did next. Also try the Chrome path with the flag and the
  Model Context Tool Inspector extension (Gemini) to show a second agent reading the same
  receipts. `HUMAN`.
- Related: P8C proof matrix.

### SPX-21 · Public repository, licence, video, Devpost submission

- Outcome: repository public with MIT `LICENSE` visible in the About section; commit history
  shows the WebMCP work inside the submission window; YouTube video under three minutes with
  audio; description covering WebMCP fit, UX improvement, new human-agent capabilities, and
  implementation approach; testing instructions; Devpost submitted by the representative.
- Pre-checks: secret scan (`git log -p | grep -i "api_key"` must be empty; `.env.local` never
  committed), participant-data scan, source ownership review. `HUMAN`.
- Related: D-009, D-013.

### SPX-22 · Live lab-assistant provider proof (optional)

- Outcome: `LAB_ASSISTANT_PROVIDER=openai_compatible` with an OpenCode Go or other
  OpenAI-compatible endpoint returns a grounded proposal through `/api/lab-assistant/propose`.
- Acceptance: status endpoint reports enabled; one grounded proposal; one thin-words request that
  returns `insufficient_signal` or `GROUNDING_FAILED`, never an invented route; one unreachable
  endpoint run returning `502 PROVIDER_FAILED` while the WebMCP path still works.
- Consent: the UI sends participant words only after the consent sentence is ticked; verify by
  watching the network panel. `HUMAN` supplies the key; never commit it.
- Related: D-014, D-015 item 8.

## Lane A · Devarsh (domain, commands, persistence)

### SPX-23 · Review candidate v2 kernel changes against the contract

- Outcome: an independent domain owner has read `web/src/commands/command-kernel.ts` and
  `web/src/domain/*.ts` and either accepted or filed defects.
- Focus: carry-over rules (kept routes must be carried; only set-aside kinds replaced), follow-up
  lifecycle (one open at a time; withdrawn by a routes proposal or a choice), `set_limits`
  denial when a proposed route would exceed new limits, `reopen_exploring` in TESTING only,
  replay data reconstruction for every command, at-rest cap validation only for proposed sets.
- Proof: add at least five adversarial tests you expect to fail and report which ones did.
- Related: D-015, P11.

### SPX-24 · Sourced teachings (P6 slice)

- Outcome: when the participant edits or sets aside a route, the UI can offer "Remember this for
  future proposals"; accepting creates a `HumanTeaching` with `sourceOperationRefs`; orientation
  lists active teachings; the kernel denies a proposal that violates an active `constraint`
  teaching (start with money and hours ceilings and a "never propose kind X" rule).
- Paths: `web/src/domain`, `web/src/commands`, migration to schema 4, fixtures, tests.
- Acceptance: replay the same fixture before and after a teaching; the proposal must differ and
  the catalogue must be identical.
- Out of scope: UI (SPX-28) and WebMCP exposure (SPX-30).

### SPX-25 · Evidence return (P4/P5 slice, post-submission)

- Outcome: `log_evidence` (participant-only) and `propose_hypothesis_revision` (agent) as typed in
  `SPEC.md` §7; revisions may cite only confirmed evidence; confidence never 0 or 1.
- Acceptance: contract, denial, replay, and ledger validation tests; migration to schema 5.

## Lane B · Tirth (human experience)

### SPX-26 · Mobile header and drawer polish

- Outcome: on widths under 42rem the four header actions collapse into one "Room" menu; the
  activity drawer becomes a bottom sheet; the skip link shows only on keyboard focus (fixed in
  v2, verify).
- Acceptance: 390px screenshots at 100% and 200% text; no horizontal scroll; keyboard reachable.
- Paths: `web/src/components/journey/destiny-journey.tsx`, `web/src/components/room/*`,
  `web/src/styles/destiny.css`, `web/tests/journey.spec.ts`.

### SPX-27 · Route card comparison and notes review

- Outcome: an optional side-by-side comparison of private notes that never gates choosing; card
  height balance so three cards align at 1440px; a "why this quote" tooltip on the quote slip.
- Acceptance: Playwright checks that Choose is enabled without opening the comparison.

### SPX-28 · Teach the assistant UI (depends on SPX-24)

- Outcome: after an edit or set-aside, a quiet offer to keep a rule; the room shows active rules
  with their source receipts; the agent view panel shows them under `teachings`.

### SPX-29 · Distress boundary copy in the journey

- Outcome: the safeguarding notice from `docs/SAFETY_AND_PRIVACY.md` appears on the welcome and
  question screens in a way that does not diagnose or guess location. `HUMAN`: the named
  safeguarding reviewer approves the wording before any participant session.

## Lane C · Harsh (agent surface, evals, runtime proof)

### SPX-30 · Expose teachings and evidence tools (P10 slice, depends on SPX-24/25)

- Outcome: phase-gated registration for the new commands; method guide 2.1.0; evals for every
  denial; live-Chrome coverage.

### SPX-31 · Agent behaviour suite with a real model

- Outcome: run `runVisitingAgent` against the real catalogue in the harness with a live model
  for at least 15 scripted sessions across the SPEC §12 list; report hard-invariant pass rate and
  subjective route quality separately. `HUMAN` supplies the key.

### SPX-32 · Declarative tools for the limits form

- Outcome: the limits form becomes a declarative tool that stages values without submitting;
  the human confirms; the live suite proves the browser fills the number inputs correctly.

## Human oversight checklist (before submission)

1. Watch one full run in the ChatGPT in-app browser and confirm every agent move appears in the
   activity drawer with a receipt.
2. Read every sentence on every screen; anything that sounds like prediction, ranking, or
   therapy is a defect.
3. Confirm private notes never appear in the agent view panel.
4. Confirm "Start over" removes both localStorage keys and nothing else.
5. Confirm the public repository contains no keys, no participant data, and the MIT licence.
6. Name the safeguarding reviewer and the five adult participants (pseudonymous IDs only).
