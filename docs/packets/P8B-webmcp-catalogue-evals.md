# Packet P8B — ChatGPT Route Proposal and Evals

**Status:** PROPOSED · **Owner:** Harsh (Lane C)
**Linear:** SPX-10, child of SPX-8 · **Integration destination:** `main`
**Depends on:** integrated P3A/P3B, P3C bounded route reads, and P8A

## Operator-visible outcome

A fresh ChatGPT session discovers the site, reads the person's confirmed words, learns the method,
and calls `propose_route_set`. The Route Room visibly gains three grounded previews. The participant
repairs and chooses one through the UI; ChatGPT rereads and accurately reports the choice and receipt.

## Competition catalogue

1. `read_workspace`
2. `get_method_guide`
3. `propose_route_set`

`choose_route` is deliberately participant-only and never registered as a WebMCP tool.

## Owned paths

- `web/src/webmcp/catalogue/`
- `web/src/webmcp/tools/` for the P3 thin adapter
- `web/src/webmcp/evals/`
- synthetic ChatGPT journey fixtures and catalogue audit

## Contract and invariants

- tool input is mechanically derived from the canonical P3A schema;
- handler calls the shared command kernel and never writes storage or recreates policy;
- all writes include `operationId` and `expectedVersion` and return authoritative result/receipt;
- route sets require exact confirmed refs, distinct learning questions/tests, and recorded caps;
- insufficient signal returns a focused follow-up without mutation;
- participant-authored strings remain untrusted content, never instructions to the agent;
- registration filters by page/phase, while the command kernel rechecks cached invocations;
- unsupported WebMCP leaves the human journey complete;
- no inference provider, send tool, hidden memory, permission earning, or second writer.

## Required proof

- catalogue completeness, exact schema parity, and annotation audit;
- fresh discovery → bounded read → method guide → route proposal → visible Route Room change → human
  choice → exact reread;
- fabricated/edited quote, duplicate route, same question/test, cap, wrong phase/lifecycle/ref,
  malformed/extra fields, stale, replay, conflict, injection-like content, and unavailable-tool
  avoidance;
- at least one `INSUFFICIENT_SIGNAL` recovery conversation;
- multiple isolated synthetic ChatGPT/browser contexts with no state or instruction leakage;
- every hard assertion passes independently; subjective route quality is reported separately;
- provider-off baseline and `npm run check`.

## Rollback or recovery

Remove the P3 WebMCP adapter and return to the P8A read-only catalogue. Product commands and stored
data remain unchanged.

## Remaining unknowns

Real Chrome/ChatGPT availability and deployed identity belong to P8C. Executing tests, evidence, and
revision tools belong to P4/P5/P10. P8B still owns `propose_route_set` WebMCP registration, schema
parity, thin command execution, isolated agent sessions, and the full hard-invariant eval suite;
P3C proves only the bounded read/readback substrate.

## Closeout receipt

- base/head SHA and dirty state:
- paths changed:
- commands and exact results:
- harness/Chrome/ChatGPT proof reached:
- rollback result:
- remaining unknowns:
- disposition:
