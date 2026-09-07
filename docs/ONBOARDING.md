# STING contributor onboarding

STING is the current Destiny.AI web experience. The design and safety contract is `docs/STING.md`; read it and `web/AGENTS.md` before changing behavior. The app is a Next.js application under `web/` and has no database or account setup.

## Requirements and first run

Use Node.js 24 (the repository pins this in `.nvmrc`/`.node-version`) and npm. From a clean clone:

```sh
git clone https://github.com/SpaarxLab/destiny-ai.git
cd destiny-ai/web
npm ci
npm run dev
```

Open `http://localhost:3000`. The fixture deck and deterministic house path work with no credentials. Copy `.env.example` to `.env.local` only if you need an optional local assistant; leave `LAB_ASSISTANT_PROVIDER=disabled` for ordinary development.

For a fork:

```sh
git remote rename origin upstream
git remote add origin https://github.com/<you>/destiny-ai.git
git switch -c codex/<short-topic>
```

## Checks

Run commands from `web/`:

```sh
npm run typecheck
npm run test
npm run lint
npm run build -- --webpack
npm run check
```

`test:browser` runs the Chromium house-match journey. `test:chrome` needs Chrome 149+ with `chrome://flags/#enable-webmcp-testing` enabled and a locally started production server on port 3111. `test:live` and `test:sting-live` require an explicitly supplied deployment/provider endpoint and are optional.

## Optional providers

The default fixture deck and house player make zero provider calls. The current configuration uses `LAB_ASSISTANT_PROVIDER`, `LAB_ASSISTANT_BASE_URL`, `LAB_ASSISTANT_API_KEY`, and `LAB_ASSISTANT_MODEL`. `EMBEDDED_ROLES=on` enables the optional server-side role path and requires the OpenCode Go variables. Never commit `.env.local` or a real key, and do not enable provider calls on a public deployment without authentication and rate limits.

## Structure and boundaries

- `web/src/sting/` — STING command kernel and WebMCP tool contracts.
- `web/src/webmcp/` — browser adapter over the shared kernel.
- `web/src/app/` — Next.js routes and UI.
- `docs/STING.md` — current design authority; `docs/DEPLOY.md` — deployment procedure.

Tools are proposal/command adapters. Participant-only actions, `operationId`, `expectedVersion`, receipts, and phase checks belong to the kernel. A passing local test is not deployment, live WebMCP, participant, or submission proof.

## Troubleshooting

- Missing module or stale generated Next types: remove only `web/.next` and rerun `npm ci`.
- Port 3000/3111 is occupied: stop the owning local process or choose another dev port; `test:chrome` expects 3111 unless its config is changed.
- WebMCP tools do not appear: use supported Chrome 149+, enable the testing flag, relaunch Chrome, and inspect DevTools → Application → WebMCP.
- Assistant calls are unavailable: confirm the provider is intentionally enabled and the endpoint/key/model are set; fixture mode remains the credential-free path.
