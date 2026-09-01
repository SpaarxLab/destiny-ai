# Packet P9 — Optional Inference Adapter Experiment

**Status:** DEFERRED · **Owner:** Harsh (Lane C)
**Linear:** SPX-12, separate optional ticket · **Integration destination:** undecided
**Depends on:** admitted P8C candidate; **Not required for competition completion**

## Operator-visible outcome

Determine on synthetic fixtures whether AI SDK with OpenCode Go `gpt-5.6-luna` improves route
proposal quality enough to justify cost, latency, privacy, and failure complexity.

## Scope and owned paths

- isolated provider adapter and synthetic evaluation fixtures only;
- no direct persistence, command policy, permissions, hidden memory, or participant data;
- compare against the existing visiting-agent/no-provider baseline.

## Contract and invariants

- the candidate starts and completes every journey with no provider configured;
- the adapter receives bounded projections and returns typed proposals only;
- missing credentials, timeout, quota, or provider failure falls back without state corruption;
- the adapter is disabled by default; real participant content remains browser-local until a
  separate consent, minimisation, retention, deletion, provider-terms, and failure decision;
- EVE has no admitted dependency or packet. Reconsider it only for a proven durable workflow need.

## Required proof

- frozen baseline versus adapter evaluation on quality, quote fidelity, tool arguments, latency,
  tokens/cost, failure recovery, and privacy surface;
- synthetic data only until separately admitted;
- explicit `ADOPT`, `DEFER`, or `REJECT` decision with evidence.

## Rollback or recovery

Remove the adapter/configuration. The product and WebMCP candidate remain unchanged.

## Remaining unknowns

Provider retention, account limits, live cost, and any durable-session need require fresh verification.

## Planning snapshot — recheck when P9 is admitted

Live npm and local-runtime readback on 2026-09-01 found: `ai` 7.0.87,
`@ai-sdk/openai` 4.0.53, `opencode-ai` 1.18.25, and `eve` 0.47.7. The installed OpenCode CLI is
1.18.25; a local OpenCode Go credential record exists, but its secret was not displayed. The
documented OpenCode Go Responses endpoint is `https://opencode.ai/zen/go/v1/responses` and the model
identifier is `gpt-5.6-luna`. Use an OpenAI-compatible AI SDK provider behind the server-only
adapter; never run the OpenCode CLI as the application API. These are dated planning facts, not
dependency pins, a successful authenticated inference call, or an adoption decision.

## Closeout receipt

- branch/SHA:
- baseline and candidate configs:
- verified:
- unverified:
- disposition:
