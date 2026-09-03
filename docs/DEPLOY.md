# Deploy

STING is a Next.js 16 App Router app in `web/`, deployable to any host with a live Node
response pipeline (not a static export — the origin-trial header and the optional lab-assistant
API route both need a real per-request server). Primary target is Vercel; Netlify is the backup.

## Environment variables

| Var | Required | Effect |
|---|---|---|
| `OPENCODE_GO_API_KEY` | no | enables the optional local lab assistant (solo-mode house replacement, server-side only, never in the client bundle); unset means the deterministic house plays and the whole game still works with zero network calls |
| `STING_PLAYER_MODEL` | no | overrides the lab assistant's model name; default is set in `web/src/sting/spark/provider.ts` |
| `WEBMCP_ORIGIN_TRIAL_TOKEN` | recommended for judging on stock Chrome | sent as the `Origin-Trial` response header on every route (see `web/next.config.ts`), so `document.modelContext` exists without a judge flipping a flag |

Set `STING_PLAYER=off` on any environment to force the house even when `OPENCODE_GO_API_KEY` is present (used for CI and for demoing the zero-network path deliberately).

Root directory for the build: **`web`**. Node version: **24** (the repository-root `.nvmrc` and `.node-version` both pin 24; also select Node 24 explicitly in the host's project settings).

## Vercel (primary)

1. `cd web && vercel link` — link the repo, root directory `web`.
2. `vercel env add OPENCODE_GO_API_KEY` (optional), `vercel env add STING_PLAYER_MODEL` (optional), `vercel env add WEBMCP_ORIGIN_TRIAL_TOKEN` (see below for where the token comes from) — add each for Production (and Preview if you want previews to carry the header too, though the token is origin-bound, see caveat).
3. `vercel --prod` to deploy. Vercel is first-party for Next.js: no adapter, no static-export gotchas, `headers()` in `next.config.ts` reaches every request as written.
4. Attach the stable production domain (the project's persistent `*.vercel.app` alias or a custom domain) — register the origin trial token against **this exact domain**, not a preview URL.

## Netlify (backup)

1. `netlify init` or connect the Git repo in the dashboard; set the base directory to `web`.
2. Netlify's OpenNext-based adapter gives "Full Support" for App Router, SSR, Route Handlers and Server Actions from Next 13.5 up, auto-updated on each build unless pinned. Next 16 is not explicitly named as tested — verify a preview deploy builds cleanly before relying on it for judging.
3. Add the same three env vars under Site configuration → Environment variables; redeploy to pick them up.
4. `netlify deploy --prod`.
5. **Verify the `Origin-Trial` header actually reaches the deployed route** before trusting it — Netlify's middleware/redirect ordering differs from vanilla Next.js, so a `next.config.ts` `headers()` entry that works on Vercel is not guaranteed identical here without a live check (`curl -sI https://<site>/ | grep -i origin-trial`).

## Registering the WebMCP origin trial token

Without a token, `document.modelContext` only exists in Chrome behind the
`chrome://flags/#enable-webmcp-testing` flag or inside ChatGPT's built-in browser — stock Chrome
visitors silently fall back to the house. The token removes that friction for judges running plain
Chrome 149–156.

1. Register at `https://developer.chrome.com/origintrials/#/register_trial/4163014905550602241` (trial name `WebMCP`, feature id `5117755740913664`).
2. **The token is bound to one exact origin: scheme + host + port.** Register it against the
   stable production domain chosen above, after that domain is live — not a Vercel preview URL,
   which gets a fresh random subdomain per deploy and would need its own token.
3. Set the issued token as `WEBMCP_ORIGIN_TRIAL_TOKEN` in the host's environment variables for
   Production. `web/next.config.ts` sends it as an `Origin-Trial` response header on every route
   when the env var is present; it sends nothing if the var is unset, so local dev and unconfigured
   previews are unaffected.
4. The trial covers Chrome/Edge/Android/webview milestones 149–156 only; if Chrome has shipped
   past 156 by judging time, the token silently stops working and Chrome visitors need the flag
   again. Check the current stable Chrome version before the deadline.
5. This step is irrelevant to the ChatGPT built-in browser path — that surface does not check the
   origin-trial token at all, only the model (GPT-5.6 Sol or Terra) and the workspace tier.

See `/tmp/sting-research/03-origin-trial.md` for the full source trail behind these facts.
