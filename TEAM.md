# Career Lab — Team Charter

## Ownership

| Responsibility | Owner | Decision authority |
|---|---|---|
| Product authority and integration | Harsh | scope, contract admission, candidate identity |
| Lane A — domain/commands/persistence | **OWNER INPUT** | invariants, command kernel, migrations, receipts |
| Lane B — human board/collaboration | **OWNER INPUT** | interaction design, accessibility, browser journeys |
| Lane C — agent surface/evals/runtime | Harsh | WebMCP adapters, method, evals, live runtime proof |
| Safeguarding review | **OWNER INPUT** | distress and referral copy |
| Participant recruitment | Harsh until delegated | five adult participant commitments |

Harsh is integration captain for the first four-week programme. This role can be delegated
later by an explicit decision-record update; it does not rotate automatically.

## Working agreement

- One owner, one active packet, one writable worktree per lane.
- Lane A publishes contracts before Lane B/C integrate them.
- Lane B/C consume commands; they do not reproduce policy.
- A contract change needs product-authority approval and updated fixtures.
- Pull requests stay packet-sized and include proof plus rollback/recovery.
- Daily 15-minute check: contract change, evidence, blocker, next integration only.

## Integration order

`domain schema -> command/denial tests -> adapter and UI -> browser journey -> docs/receipt`

## Definition of done for a packet

- named operator outcome and owner;
- prerequisites satisfied;
- focused success, denial, stale, and replay checks where applicable;
- visible after-state and durable receipt;
- recovery or compensation documented;
- branch/SHA/dirty-state receipt;
- explicit `INTEGRATE`, `DEFER`, or `REJECT` disposition.
