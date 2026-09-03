# Native WebMCP proof behind the demo card

`05-webmcp-proof.svg` is a labelled visualization of real values returned by
`document.modelContext.getTools()`; it is not presented as a DevTools screenshot.

The values were read on 2026-09-03 from the user's Chrome 152 session against
`http://localhost:3113`. The page was driven through the native
`document.modelContext.executeTool()` surface:

1. `inspect_room`
2. `stage_cast`
3. three participant-only cast taps
4. `propose_hypothesis` with `kind: cold_read`
5. `stage_duel` with a sealed two-chip bet
6. the participant selected the opposite side, producing `react-9`

Chrome then returned:

```json
["ask_once", "inspect_room", "propose_hypothesis"]
```

The valid next move reported by `inspect_room` was
`propose_hypothesis kind revision`. After the native tool call filed “I misread
you: the quiet won.”, Chrome returned:

```json
["ask_once", "inspect_room", "propose_hypothesis", "stage_duel"]
```

The machine-readable capture is `STING_WEBMCP_PROOF.json`. The repository's
repeatable Chrome journey in `web/tests/sting-chrome.spec.ts` exercises the same
miss → revoke → revision → restore boundary through the native API.
