# ChatGPT A/B Tests Your Future — Codex IAB runtime evidence

**Date:** 2026-09-02 IST · **Surface:** Codex in-app browser at `http://127.0.0.1:3000/`
**Proof class:** real page-defined WebMCP in Codex IAB; **not** ChatGPT IAB, deployment or participant
research proof.

## Discovered catalogue

`inspect_room`, `stage_probe`, `propose_hypothesis`, `present_evidence`,
`stage_route_auditions`, `propose_experiment`.

No tool for swipe, hypothesis resolution, Portrait, limits, evidence confirmation, route choice,
commitment or outreach was present.

## Exact observed sequence

1. `inspect_room` -> state v0, `ready_for_first_probe`.
2. `stage_probe` moment -> operation-1, v0 to v1, `awaiting_participant`.
3. Webpage card click -> reason click -> participant `swipe_card`, operation-2, v1 to v2.
4. `inspect_room` returned swipe-2, gesture `me`, dwell `slow`, and operation-2.
5. Duplicate stage with the original operation ID replayed operation-1 without another card.
6. New operation with expectedVersion 0 returned `STALE_STATE`; state stayed v2.
7. `stage_probe` variable isolation -> operation-3, v2 to v3; page reload; `inspect_room` returned
   `awaiting_participant` with the same card ref and operation-3.
8. Webpage response -> operation-4, v3 to v4; participant limits -> operation-5, v4 to v5.
9. `stage_probe` forced tradeoff -> operation-6, v5 to v6; two webpage responses -> operation-7
   and operation-8, ending v8.
10. `propose_hypothesis` -> tension-9 / operation-9, v8 to v9; participant accepted -> operation-10,
    v9 to v10.
11. `stage_probe` variable-isolation counterexample -> operation-11, v10 to v11; participant
    response -> operation-12, v11 to v12; tension-9 became `falsified`.
12. `propose_hypothesis` with `interpretation: replaced`, supporting swipe refs and contradictory
    swipe-12 -> tension-13 / operation-13, v12 to v13; participant accepted -> v14.
13. `present_evidence` showed operation-2/4/7/8 against operation-12 at v14 and did not mutate state.
14. `stage_route_auditions` created exactly three rich routes -> operation-15, v14 to v15.
15. `propose_experiment` returned `decision_ready` at v15 without choosing or committing.

The first stage receipt was timestamped 09:08:20Z and route auditions were committed at 09:16:22Z:
8 minutes 2 seconds for this instrumented implementation/evidence run. It was not a rehearsed
three-minute demo and does not prove the target duration.

## Recovery and interaction result

- The card-click then reason-click path committed the participant response correctly.
- The admitted two-call fallback works in Codex IAB: stage returns immediately; webpage interaction
  remains available; inspect returns the authoritative participant receipt.
- Reload preserved the unresolved probe and its operation receipt.
- Duplicate operation replayed; stale version changed nothing.
- Browser console warnings/errors after the full loop: `[]`.
- Screenshots of initial/reloaded probe, first hypothesis, counterexample, revised hypothesis,
  evidence comparison and route auditions were captured in the Codex IAB task evidence stream.

## D-018 explicit-reaction rerun

After replacing the ambiguous drag/flip flow, the updated page was opened again in the Codex IAB
and in the WebMCP Kit Chrome driver:

1. Both surfaces discovered the same six-tool catalogue and no participant action tools.
2. `stage_probe` wrote operation-1, moved v0 to v1 and rendered four native controls: `Not me`,
   `I wish`, `I used to`, and `That's me`.
3. The participant selected `I wish`; the reason panel repeated `I wish` before any write.
4. Selecting `I want to shape the answer myself.` wrote operation-2 and moved v1 to v2.
5. `inspect_room` returned response code `wish`, its plain-language meaning, the exact selected
   reason, probe uncertainty, changed variable and operation-2.
6. `agentProvenance` reported external ChatGPT through WebMCP, no hidden/embedded/fixture inference,
   zero application-side model calls, and provider token telemetry as unobservable.
7. Chrome driver console readback contained no messages. The local page returned HTTP 200 in 19 ms.

This rerun proves the repaired interaction and page-defined WebMCP boundary. It still does not turn
Codex IAB or Chrome-driver evidence into real ChatGPT-IAB proof.

## Unverified

The real ChatGPT in-app-browser prompt has not been run from this environment. Pending-tool
`run_probe` interaction therefore remains unverified and the fallback remains current. No claim in
this record should be promoted to ChatGPT IAB, public deployment, participant usefulness or
three-minute rehearsal proof.
