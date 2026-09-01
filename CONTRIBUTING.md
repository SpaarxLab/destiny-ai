# Contributing to Destiny.AI

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

Include the Linear identifier in the branch name, for example
`packet/spx-1-command-spine`. One lane owns the branch. Do not mix packets or repair
unrelated files. Existing published packet branches may retain their names when the linked
pull request and commits carry the identifier.

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
