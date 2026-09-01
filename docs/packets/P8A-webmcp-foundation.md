# Packet P8A — WebMCP Foundation and Read Tools

**Status:** PROPOSED — ADMITTED NEXT IN LANE C · **Owner:** Harsh (Lane C)
**Linear:** SPX-9, child of SPX-8 · **Integration destination:** `main` · **Depends on:** integrated P2

## Operator-visible outcome

On a supported page, a visiting browser agent discovers bounded `read_workspace` and
`get_method_guide` tools. Unsupported browsers retain the complete human application.

## Scope and owned paths

- `web/src/webmcp/`: capability detection, catalogue definitions, registration lifecycle,
  thin read handlers, result serialization, compatibility boundary;
- deterministic in-page harness and focused tests;
- agent-status UI may display detected/not-detected without claiming runtime execution.

## Contract and invariants

- no domain rule or persistence writer exists in `src/webmcp/`;
- `read_workspace` delegates to the integrated bounded projection;
- `read_workspace` preserves the P2 projection limits: at most 20 summaries, at most 20
  recent entities, at most 6,000 characters of quoted content, and at most 3,000 bytes per
  evidence capture;
- `get_method_guide` returns the versioned method and contract identity;
- registration/annotations are discovery hints; unsupported or changing runtimes fail closed;
- page/phase lifecycle aborts old registration while cached calls remain command/read denied;
- no EVE, AI SDK, OpenCode, model key, or network inference is required.

## Required proof

- feature absent/present, registration, unregister/abort, navigation/remount, duplicate setup,
  malformed input, every projection bound, typed failure, and no-mutation tests;
- harness shows the same orientation as the UI and correct method versions;
- app journey passes with WebMCP missing; `npm run check` passes.

## Rollback or recovery

Remove the isolated adapter and registration entrypoint. No product state migration is involved.

## Remaining unknowns

Live Chrome and ChatGPT proof belongs to P8C. Write tools wait for their product commands and P8B.

## Closeout receipt

- branch/SHA:
- dirty state:
- verified:
- unverified:
- disposition:
