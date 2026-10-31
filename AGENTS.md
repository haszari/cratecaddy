# Crate Caddy - Agent Guidelines

Music metadata explorer with genre tag clouds. Two independent packages under `src/`.

## Repo structure

- `src/api/` — Express TypeScript server, `server.ts` is entrypoint
- `src/ui/` — Vite + React SPA. `main.tsx` is the API shell entrypoint, `main.static.tsx` the static site shell
  - `src/ui/src/shell/` — per-build shells, shared routes (`BrowseRoutes`) and providers
  - `src/ui/src/data/` — data sources: `client.ts` (API), `snapshotClient.ts` (Snapshot), swapped via the `@data` alias
- `snapshot.config.json` — Snapshot filter (default: grouping contains `DJing`)
- `scripts/publish-static-site.sh` — snapshot, build and publish the static site to GitHub Pages; needs the checkout
- `cratecaddy publish` — the installed CLI delegates to that script, using `SOURCE_DIR` recorded at install (or `--source`). Publishing needs the checkout; the appliance only holds the built API
- `cratecaddy rebuild-prod` — build from the checkout, install and restart in one step (also resolves `SOURCE_DIR`)
- `cratecaddy install` — copies the built runtime; the installed copy cannot install itself, so run it from the checkout or pass `--source`
- `src/tools/` — sample Library loader (`load-sample-library.sh` + `sample-songs.json`)
- `src/data/` — gitignored user data (import files, CSVs)
- `plans/` — design documents and refactor plans (review before executing)
  - Naming: `YYYYMMDD[a/b/c...]-descriptive-name.md`. Multiple plans on the same day get suffixed `a`, `b`, `c` in chronological order. Current/active plan is always the highest letter.
- `docs/adr/` — architecture decision records, current decisions only. Superseded or withdrawn ADRs move to `docs/adr/archive/`; never reuse a number.
- `CONTEXT.md` — domain language glossary (ubiquitous language)
- `docs/smoke-tests.md` — manual smoke tests for the app, the appliance and the static site; run before trusting a build or publish
- No root `package.json` — each sub-package is independent

## Commands (run from `src/api/` or `src/ui/`)

| Package | Command | Note |
|---------|---------|------|
| api | `npm run dev` | `tsx watch src/server.ts` |
| api | `npm run build` | `tsc` (compiles to `dist/`) |
| api | `npm run import:applemusic <path>` | Needs MongoDB running; filters to songs with "DJing"/"Listening" grouping |
| api | `npm run import:rekordbox <path>` | Experimental, includes musical key |
| api | `npm run import:djaypro <path>` | Experimental, includes musical key |
| api | `npm run inspect:library <cmd>` | Library checks: `count`, `sample`, `with-key`, `sources`, `duplicates`, `search:term` |
| api | `npm run snapshot` | Writes `src/ui/public/data/snapshot-<sha8>.json`; needs MongoDB. See `snapshot.config.json` |
| api | `npm run check:static-site-matches-app` | Checks the static site and the app return the same songs for a query matrix; needs MongoDB with data |
| ui | `npm run dev` | `vite` (serves on port from `src/ui/.env`) |
| ui | `npm run build` | `tsc -b && vite build` (API shell → `dist/`) |
| ui | `npm run dev:static` | Static site at `/cratecaddy/`; requires a Snapshot |
| ui | `npm run build:static` | Static site → `dist-static/`, base `/cratecaddy/` |
| api | `npm run lint` | ESLint 8, config via `eslint src --ext .ts` |
| ui | `npm run lint` | ESLint 9 flat config (`eslint.config.js`) |

**No test framework** is configured. `npm run check:static-site-matches-app` (api) is the contract check for the two query implementations; everything else is covered by the checklist in `docs/smoke-tests.md`. No `typecheck` script exists; use `npx tsc -b` (ui) and `npx tsc --noEmit` (api).

## Architecture notes

- Browse queries are server-side: `buildSongFilter` + `pagination` + `shuffleHash` behind `GET /api/songs` and `GET /api/songs/stats/genres`. The UI keeps filter state in URL search params and calls the API through `@data`.
- Two filter implementations exist on purpose (ADR-0014): Mongo (`buildSongFilter`) for the API and pure JS (`songQuery`) for the static site build. New filters must be added to both and to the parity matrix.
- API routes: `GET /health` (end-to-end: database state, song count, newest `updatedAt`), `GET /api/songs`, `GET /api/songs/stats/genres`, CRUD by `:id`
- Song model has a Mongoose **pre-save hook** that auto-normalizes `artistTitleNormalized` and `genres` — relevant when writing import scripts
- Merge logic in `songService.upsertSongWithMerge` matches on normalized artist+title+duration (±2s tolerance)
- `src/ui/.env` sets `VITE_API_URL` and `UI_PORT`; `.env` is committed
- `src/.env` (root) — API port, MongoDB URI (loaded by API at runtime)
- MongoDB runs in Docker via `docker compose up -d`; API runs on host
  (macOS) so `osascript` is available for Apple Music write round-trip

## Tooling quirks

- API tsconfig uses `moduleResolution: "node"` — imports need `.js` extension (e.g. `import './config/database.js'`)
- UI tsconfig uses `moduleResolution: "bundler"` with `verbatimModuleSyntax: true` and `erasableSyntaxOnly: true` — requires `import type` for type-only imports, no `enum`/`namespace`
- UI uses SCSS (`.scss` files) — `sass-embedded` is a devDependency
- UI has a Vite alias `@cratecaddy-api` pointing to `src/api/src/helpers/` — shared params, `songQuery` and `shuffleHash`
- UI has a Vite alias `@data` — resolves to `data/client.ts` in the API build and `data/snapshotClient.ts` in the static site build. Hooks/pages import `@data`; only the static site imports `snapshotClient` directly
- The build target is chosen by config file, not Vite mode: `vite.config.ts` (API) and `vite.static.config.ts` (static site), both calling `createConfig` in `vite.shared.ts`. Do not add a `--mode` branch for the target
- Shared files under `src/api/src/helpers/` are compiled by both tsconfigs: use `import type` for types (UI has `verbatimModuleSyntax`) and keep `.js` extensions on relative imports
- Genre page URLs use `+` for AND (genre.all) and `,` for OR (genre.any): e.g. `/genre/Techno+Minimal` or `/genre/Techno,Deep`
- Pills render orange for AND mode, sage green for OR mode
- API runs on host (not in Docker) — `osascript` only exists on macOS; this is
  required for the write-to-apple-music endpoint

## Future scope

- **OR-genre builder UI**: The current interface is built for drilling down via AND mode (clicking a tag adds it with `+`). We need a separate UI to build OR genre queries (perhaps a toggle or alternate tag-click mode) since the tag cloud `+` button is conceptually additive/AND.

## Commit format

```
[agent <harness>-<model> <domain-task>] <what changed and why>
```

- `<domain-task>` is the task in business-domain terms, not the type of activity: `snapshot-publish`, `import`, `metadata-editor`, `library-model`, `commit-conventions`.
- The activity type may be included alongside it when useful: `build snapshot-publish`, `docs snapshot-publish`, `fix import`.
- One commit per logical step (waypoint commits).
- Subject line is plain English: what changed and why. No shorthand like `s/foo/bar`.
- Body can add detail if needed.
- **Never amend, rebase, or otherwise edit commit history.** Only ever create new commits.
- **Only commit when explicitly instructed.**

## Boundaries

Default scope is local. You may read, edit, run dev commands, and commit to the current branch. **Touching prod or anything remote requires an explicit request in the current conversation.**

Never run without being asked:
- `cratecaddy start|stop|restart|install|rebuild-prod|publish`, or `./scripts/prod/cratecaddy`
- `./scripts/build-prod.sh` when its output feeds the appliance
- `git push`, force-pushing `gh-pages`, `publish-static-site.sh --publish-to-github`
- any write to the prod database or prod API, including imports and metadata edits

If a fix seems to need a prod or remote action, stop and ask. Say exactly which command you would run and what it changes. Demonstrate the change locally instead: dev DB, `--dry-run`, a local build, `preview:static`.

## Best Practices

- Use `<Link>` over `<button onClick={navigate(...)}>` for navigation elements so cmd-click opens in new tab.

## Style

- Sentence case for all headings, labels, copy
- File references as markdown links with workspace-relative paths
- TypeScript ES modules, `tsx` runner for scripts
- NZ/GB English spelling throughout (favourite, colour, centre, etc.)
- Names and comments capture design intent: why the thing exists and what it guarantees, not the mechanics of how it works
- Name variables, functions and types so the meaning is obvious in user/domain terms — prefer `camelotToMusicalKey` over `indexToNote`, `musicalKeyToCamelot` over `keyToIndex`
- User-facing docs prefer `cratecaddy` commands (`rebuild-prod`, `publish`, `install`, `status`). Repo scripts are implementation detail or first-install fallbacks; mention them only when the CLI cannot be used yet
