# AGENTS.md

## Runtime
- Use Bun for everything. This repo is a single Bun package rooted at `legajox-scrapper`.
- `src/index.ts` is the only HTTP entrypoint. It is a thin Elysia wrapper around exported request-imitator adapter functions from `request_imitator/api.ts`, so API-shape changes usually require touching both layers.
- API auth is two-layered: every route needs `Authorization: Bearer <API_KEY>`, and routes resolve Legajox credentials from `user` / `password` query params first, then fall back to `DEFAULT_USER` / `DEFAULT_PASSWORD`.
- The server exits immediately if `API_KEY` is missing.
- Every scraper launches Puppeteer with `channel: 'chrome'`; local Google Chrome must be available.
- To see the browser, set `DEBUG_HEADLESS=false`. Any other value, including unset or `true`, still runs headless.

## Commands
- Start the API with `API_KEY=xd bun run api`. It listens on `PORT` or `3000`; `3000` matches the checked-in tests/examples.
- `bun run test` currently runs the full Bun test suite in this package.
- `bun run validate <user> <password>` is the quickest login sanity check before longer scrapes.
- The scraper CLIs are the `package.json` scripts: `user-info`, `employees`, `org-chart`, `liquidaciones`, `ausencias`, and `documentos:*`.
- The request-imitator CLIs take a `ci_session` cookie as their first positional argument. Use `bun run validate <user> <password>` to obtain one.
- `bun run check` runs `biome check --fix --unsafe --verbose`; it rewrites files. There is no non-mutating lint script in `package.json`, and `biome` is not declared there.
- After code changes, run `bun run test` and `bun run check` unless the task explicitly says not to.

## Test Gotchas
- `tests/api.test.ts` is a live integration test, not a unit suite. Start the API first, then run the test with real `DEFAULT_USER`, `DEFAULT_PASSWORD`, and the same `API_KEY` value the server uses.
- Tests default to `API_BASE_URL=http://localhost:3000`.
- `SKIP_SCRAPE=true` skips Puppeteer-heavy suites, but the file still fails in `beforeAll` unless credentials are set and the API is reachable.
- Tests and `DOCUMENTS_API_EXAMPLES.md` often assume `API_KEY=xd`, but `.env.example` uses `API_KEY=dev-api-key-change-in-production`; keep server and client/test values aligned.

## Filesystem Side Effects
- `/documents/download` and `bun run documentos:download ...` write to `outputs/_descargas_tmp/`. Existing files are returned as `estado: "duplicado"`, so old downloads change later results.
- Login timeouts in `request_imitator/get_cookies.ts` save screenshots to `request_imitator/outputs/debug/`; this is separate from the gitignored root `outputs/` directory and can leave stray untracked files.

## Source Of Truth
- `DOCUMENTS_API_EXAMPLES.md` is useful for request examples, but trust `api/index.ts` for the current `/documents/*` response contract. The markdown is already stale in places, for example `extra.fecha` vs `extra.fechaRaw`.
- All HTTP scraper routes are wrapped in a 5-minute `Promise.race`; long runs fail with `Scrape timeout after 5 minutes` even if the underlying scraper would have kept working.
