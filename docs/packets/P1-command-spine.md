# Packet P1 — Command Spine

**Status:** INTEGRATED — PR #1 merged to `main` as `58536ab`
**Owner:** Devarsh (Lane A)
**Branch/worktree:** `codex/p1-command-spine` in the current canonical checkout
**Integration destination:** `main`
**Pull request:** https://github.com/SpaarxLab/destiny-ai/pull/1

## Operator-visible outcome

A participant can save one reflection in the browser and see the authoritative after-state
and operation receipt. A deterministic test adapter invokes the same `save_reflection`
command kernel and produces the same state transition semantics.

## Scope and owned paths

- `web/src/domain/` — P1 workspace, reflection, command, result, error, and receipt contracts;
- `web/src/commands/` — the shared command kernel and `save_reflection` command;
- `web/src/storage/` — versioned workspace authority plus memory and localStorage adapters;
- `web/src/adapters/` — mechanically thin participant and deterministic test adapters;
- `web/src/components/command-spine-demo.tsx` and `web/src/app/page.tsx` — bounded visible proof;
- focused contract fixtures/tests and only the supporting test configuration;
- this packet, `SPEC.md`, and `PROJECT_STATE.md` when the implemented contract changes them.

P2 orientation, WebMCP registration, hypothesis lifecycle, server persistence, auth, sync,
analytics, and participant research are out of scope.

## Prerequisites

- P0A integrated;
- P0B admits P1 and records Devarsh as Lane A owner;
- local-only MVP authority and the UI/WebMCP shared-kernel invariant remain accepted.

## Contract and invariants

- UI and test adapters translate into the same product-owned command; neither writes storage;
- every write carries `operationId` and `expectedVersion`;
- the kernel validates schema, phase, replay identity, and current workspace version;
- same operation id plus the same command intent returns the original receipt without a
  second effect;
- same operation id plus different intent is `OPERATION_CONFLICT`;
- a stale expected version is `STALE_STATE` and requires a reread plus a new operation id;
- an accepted command atomically persists the next snapshot and its immutable receipt;
- browser writes serialize through one same-origin Web Lock before the store rechecks the
  expected version and persists;
- reading an absent workspace does not create an unreceipted bootstrap write;
- participant reflections are committed; agent-transcribed reflections are visible proposals;
- all failures use the shared typed result envelope and preserve current state.

## Success, denial, stale, replay, and recovery proof

- valid participant input creates exactly one confirmed reflection and one `APPLIED` receipt;
- valid agent-transcribed input creates exactly one proposed reflection and one `PROPOSED`
  receipt;
- malformed and extra fields are rejected without mutation;
- wrong-phase invocation is rejected without mutation;
- stale expected version returns current version and reread guidance without mutation;
- same-id replay returns the original receipt and does not increment state;
- same-id/different-payload invocation returns an operation conflict without mutation;
- simulated persistence failure returns a typed storage error while retaining the previous
  snapshot;
- the browser proof renders the saved reflection, receipt, and before/after state versions.

## Verification commands

From `web/`:

```text
npm run test
npm run check
```

Then exercise one participant reflection in the rendered browser page and inspect the
reflection, state version, and receipt.

## Rollback or compensation

Before integration, discard this packet branch. After later integration, revert the packet
commit as one unit. P1 does not expose destructive clear/import operations and does not write
remote state.

## Dirty-state boundary

The branch started from clean `main` at `045af62322fbd1c2816b2da06eb7cf6815361c88`.
Generated `node_modules/` and `.next/` remain ignored. Preserve unrelated changes if they
appear during the packet.

## Remaining unknowns

- live WebMCP runtimes still need to confirm Web Locks availability as part of P8's runtime
  matrix; unsupported browsers fail closed rather than accepting an unsafe write;
- P2 will define the bounded orientation projection and agent-facing read budget;
- participant research remains blocked by the safeguarding reviewer and recruitment gate.

## Closeout receipt

- branch/SHA: `codex/p1-command-spine` / hardened candidate
  `c5ac83c72fd060729390062cd740ecef60edefc7`
- verified: Node 24 `npm run check`; 20 focused contract tests; strict schema, wrong-phase,
  stale, concurrent replay/conflict, cross-tab serialization, bootstrap, corrupt-storage
  preservation, receipt, and
  persistence-failure proof; local production-browser
  journey rendered one confirmed reflection, one `APPLIED` receipt, and state `0 -> 1` with
  no browser errors
- unverified: live WebMCP, deployed runtime, participants, release candidate
- review state: PR #1 is open against `main`; merge and live WebMCP remain unverified
- disposition: `ACTIVE` — implementation is committed and under integration review; the
  packet is not integrated into `main`
- post-receipt update: hardened head `94898ce0c2d0042af837dca9a00d2ed34694023d` passed
  exact-head CI and merged to `main` via PR #1 (`58536ab`); disposition is now `INTEGRATED`
