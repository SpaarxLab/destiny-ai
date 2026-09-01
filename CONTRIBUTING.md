# Contributing to Career Lab

## Setup

```bash
cd web
npm ci
npm run check
```

Use Node 24 from `.nvmrc` or `.node-version`.

## Before coding

Read `PROJECT_STATE.md`, `DECISIONS.md`, `SPEC.md`, `PLAN.md`, `AGENTS.md`, then the
active packet. Confirm the packet owner and owned paths.

## Branches and worktrees

Use `packet/<id>-<short-outcome>`, for example `packet/p1-command-spine`. One lane owns the
branch. Do not mix packets or repair unrelated files.

## Pull requests

- describe the operator-visible outcome;
- link the packet and changed contract;
- list exact commands and results;
- include denial/replay/recovery evidence where applicable;
- state candidate limits and remaining gates;
- never call local checks live WebMCP or participant proof.

## Integration

Harsh integrates dependency-order only. Failed or incomplete packets are parked with a receipt;
they are not partially copied into `main`.
