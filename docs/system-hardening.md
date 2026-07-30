# System Hardening

This release adds four safety layers around assets, Ranking, progress, and production diagnostics.

## Release asset versions

`version.json` is the human-readable source version. `npm run build:deploy` hashes the deploy bundle and produces a release such as:

```text
20260730-system-hardening-a1b2c3d4e5
```

The generated release is written to `dist/version.json` and every JavaScript/CSS URL in `dist/index.html`. Runtime images use the same version through `assetSrc()`. This permits long-lived immutable image caching without showing stale artwork after a deploy.

Do not edit files in `dist` manually. Build them from source.

## Ranking run sessions

At the start of a run, the browser requests a signed run token from `/api/run-session`. A valid token binds:

- run ID and client ID
- difficulty and mode
- Weekly challenge key
- build version
- issue and expiry time

The leaderboard validates supplied tokens before accepting a score. Missing tokens remain accepted temporarily for compatibility with tabs opened before this release; invalid supplied tokens are rejected.

For key separation, configure this optional Netlify secret:

```text
RANKING_RUN_SECRET=LONG_RANDOM_SERVER_ONLY_VALUE
```

If omitted, the function falls back to the existing Supabase server secret. Never expose either value to browser JavaScript.

## Anonymous error telemetry

`/api/client-events` accepts a small allowlist of client errors:

- JavaScript and promise errors
- asset loading errors
- progress sync errors
- Ranking submission errors
- run-session startup errors

Reports contain the build, page path, viewport, touch state, and sanitized context. They do not include email, player name, user ID, access token, or Authorization headers. The function rate-limits events and writes structured entries to Netlify function logs.

## Verification

Run the complete release gate:

```powershell
npm run verify
npm run build:deploy
```

`verify` includes syntax, asset audit, Supabase contracts, hardening contracts, browser smoke, mobile smoke, the full Map 1-to-3 journey, and Weekly.

The generated deploy bundle intentionally excludes image source files such as `*_source.png` and the PNG masters for WebP signature effects.
