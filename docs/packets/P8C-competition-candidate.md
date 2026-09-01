# Packet P8C — Immutable WebMCP Competition Candidate

**Status:** PROPOSED · **Owner:** Harsh (Lane C / integration captain)
**Linear:** SPX-11, child of SPX-8 · **Integration destination:** `main`
**Depends on:** integrated P8B (which transitively requires P3 and P8A)

## Operator-visible outcome

One immutable deployed candidate demonstrates the governed route-proposal and human-choice story in
the deterministic harness, Chrome, and ChatGPT in-app browser, with rollback available and
every official submission artifact present.

## Scope and owned paths

- candidate proof receipts under `docs/proof/p8c/`: runtime matrix, release manifest,
  deployed identity/readback, demo script, rollback/reset;
- final end-to-end browser/runtime evidence and candidate documentation;
- feature fixes are routed back to their owning packet and lane; P8C does not become a
  second owner of product or WebMCP code.

## Contract and invariants

- candidate SHA, contract version, schema version, URL, and data identity match every receipt;
- harness, Chrome, ChatGPT, deployed, participant, and submission proof are reported separately;
- the submitted journey works with no embedded provider configured and never requires a second
  acceptance after `choose_route`;
- no video or submission claim precedes fresh candidate readback;
- rollback and local data reset remain usable.

## Required proof

- `npm run check` on the exact candidate;
- under-three-minute journey: guided answers -> ChatGPT `propose_route_set` -> visible three-route
  reveal -> participant repairs/chooses -> receipt -> ChatGPT reread;
- discovery, tool execution, approval, authoritative after-state, receipt, denial/retry;
- fresh harness, Chrome, ChatGPT, deployed readback, reset, and rollback receipts;
- complete deadline agent suite on the candidate;
- public licensed repository, WebMCP-period commit evidence, live URL, English description,
  public YouTube video with audio, testing instructions, and Devpost submission receipt.

## Rollback or recovery

Before admission, record the previous immutable candidate identity and exact redeploy/reset
commands in the release manifest. If no previous candidate exists, record the known-good
deployment-removal or baseline-restoration procedure instead. Exercise that procedure before
closing the packet.

## Remaining unknowns

Competition acceptance and judging are external outcomes. Report submission status factually.

## Closeout receipt

- branch/SHA/candidate URL:
- dirty state:
- verified by runtime:
- unverified:
- rollback result:
- disposition:
