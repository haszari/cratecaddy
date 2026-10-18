# Static site build — publishing a Snapshot

**Status:** built 2026-10-18 — steps 1–8 done; smoke tests documented, device checks outstanding
**Date:** 2026-10-18
**Supersedes:** [20260717d-snapshot-publish-build.md](./20260717d-snapshot-publish-build.md) (early draft, stale assumptions)
**Roadmap:** [20260717a-alternative-build-targets-roadmap.md](./20260717a-alternative-build-targets-roadmap.md) — Step 3

**Decisions:**
- [ADR-0013](../docs/adr/0013-static-site-two-shells-shared-engine.md) — two shells over a shared engine (supersedes archived ADR-0005)
- [ADR-0014](../docs/adr/0014-parallel-filter-implementations-parity-contract.md) — parallel filter implementations with a parity contract
- [ADR-0006](../docs/adr/0006-json-snapshot-static-site.md) — JSON Snapshot for the static site

**Glossary:** [CONTEXT.md](../CONTEXT.md) — **Snapshot** = point-in-time, filtered, read-only copy of the Library. **Export** stays interop with Apple Music.

---

## Goal

Publish a read-only CrateCaddy to GitHub Pages (`lab.cartoonbeats.com/cratecaddy`), with the same browse/search UX as the app, backed by a build-time Snapshot of the `DJing` library. It must work offline after first load and must never get stuck on a stale Snapshot.

One app, one Library, two build targets: API shell (full app) and the static site (read-only).

---

## Current state (verified, not assumed)

- Filtering, pagination, sort and shuffle are **server-side**: `buildSongFilter.ts`, `pagination.ts`, `shuffleHash.ts`, `songService.querySongs`.
- UI pages (`Home`, `GenreDetail`, `Artist`, `Favourited`) share `useSongPage`; filter state is URL search params (`useFilters`, `useSortShuffle`); params are flat dot keys (`genre.all`, `bpm.gte`, …) from `@cratecaddy-api/apiParams`.
- Data access is `src/ui/src/api/client.ts`, imported directly by `useSongs`, `useSongPage`, `Song`, edit components.
- Write surface: `/edit-metadata` route, `EditLayout`, `Single/MultiSongMetadataEditForm` (mutations, history, write-to-Apple), `VersionStatus` → `/api/version`.
- No root `package.json`; cross-package work is shell scripts (`scripts/build-prod.sh`, `scripts/prod/cratecaddy`).

---

## Architecture

```
src/ui/src/
  data/
    client.ts          ← API implementation (moved from api/client.ts)
    snapshotClient.ts    ← Snapshot implementation
    index.ts           ← re-export; Vite alias `@data` selects implementation per mode
  query/
    songQuery.ts       ← shared pure predicate/sort/paginate contract (ADR-0014)
  shell/
    Providers.tsx      ← Mantine + MUI theme + QueryClient
    BrowseRoutes.tsx   ← route table: /, /genre/:genrePath, /artist/:artistName, /favourited, /song/:id
  main.tsx             ← API shell: BrowserRouter, + /edit-metadata, VersionStatus
  main.static.tsx      ← static site: HashRouter, Snapshot bootstrap, no write routes, Snapshot footer
```

Hooks and pages do **not** change: they import `@data`, so the engine is genuinely shared. Only the shell decides which routes exist.

---

## Snapshot contract

- **Filter:** `grouping` **contains** `DJing` (`grouping: { $in: ['DJing'] }`). `[DJing]` and `[DJing, Listening]` included; `[Listening]` and empty/missing excluded. Config is "any of", never AND. Default lives in `snapshot.config.json` at repo root; additional filters reuse the app's existing param vocabulary (`genre.all`, `bpm.gte`, `rating.gte`, `favorite`, `search`, …) composed through `buildSongFilter`, overridable per run by CLI flags.
- **Payload:** wrapper + unchanged `Song` shape.
  ```json
  { "snapshot": { "version": "<sha8>", "takenAt": "ISO", "appVersion": "0.1.0",
                  "commit": "sha7", "filter": { … }, "count": 8123 },
    "songs": [ /* whitelisted Song fields */ ] }
  ```
- **Whitelist** (explicit allowlist in the script; new Song fields never leak by default):

  | Field | Treatment |
  |---|---|
  | `_id` | include (stable Song links) |
  | `title`, `artist`, `album`, `duration` | include |
  | `genres`, `grouping`, `bpm`, `year`, `key`, `rating`, `favorite` | include |
  | `canonicalAppleMusicId`, `appleMusicIds` | include (public IDs; future "show in Apple") |
  | `artistTitleNormalized` | include (soft-index match key; no additional info beyond artist+title) |
  | `sources[]` | keep `sourceType`, `format`, `appleMusicId`; derive `isLocal: boolean` from `filePath`; keep `sourceMetadata.isAppleMusic`, `sourceMetadata.fileType` |
  | `sources[].filePath`, `fileSize`, `bitRate`, `dateModified`, `lastImportDate`, other `sourceMetadata` | **exclude** — absolute paths leak username, drive layout, folder names |
  | `createdAt`, `updatedAt`, `__v` | exclude (internal) |
  | `History` collection | exclude entirely |

  `SourcesIcons` gains a one-line change: use derived `isLocal` instead of regexing `filePath`.
- **Determinism:** sorted by `_id` ascending. Same DB state → byte-identical JSON → same hash → no pointless redeploy or SW update.
- **Identity:** filename `data/snapshot-<sha8>.json`, hash = first 8 hex of SHA-256 over the serialised payload. Old snapshots cleared before write. `public/data/` is gitignored.
- **Validation in the script:** required fields present on every song; banned keys absent from the payload (leak assertion); count > 0; size reported.

---

## Build wiring

- **Entry selection:** one `index.html`; a small Vite plugin swaps the script `src` to `/src/main.static.tsx` when `mode === 'snapshot'`. No second HTML file.
- **Per-mode config:** snapshot → `base: '/cratecaddy/'`, `outDir: 'dist-static'`; normal → `base: '/'`, `outDir: 'dist'`. `define` gains `__SNAPSHOT_FILE__`. Existing git defines stay.
- **Typecheck:** both mains live under `src/`, so `tsc -b` covers them. Both shells build in normal mode too, so neither rots.
- **Scripts:**
  - `src/api`: `npm run snapshot` (`tsx scripts/snapshot.ts`) — writes the versioned JSON into `src/ui/public/data/`.
  - `src/ui`: `npm run dev:static` (`vite --mode static`; clear error + guidance if no Snapshot present), `npm run build:static` (`tsc -b && vite build --mode static`).
  - Root: `scripts/publish-static-site.sh` — snapshot → validate → build → validate → push.

---

## Shared query contract (ADR-0014)

- Extract `src/api/src/helpers/songQuery.ts` (aliased into the UI via `@cratecaddy-api`): `matchesFilters(song, params)`, `sortSongs(songs, sort, direction)`, `paginate(songs, page, limit)`, `computeGenreStats(songs)`. `buildSongFilter` keeps the Mongo implementation.
- Documented compromises in the module header:
  - genre/artist matching is case-insensitive **substring**, not equality;
  - BPM range **includes** songs with no BPM; rating range does not;
  - sort fallback chain mirrors `FALLBACK_SORT_CHAIN`; static site build uses byte-wise comparison (closest to Mongo default), and ordering is **not** parity-asserted.
- Refactor `shuffleHash.ts` into a pure `shuffleHash(id, seed)`; `buildShuffleHashFunction` generates the Mongo `$function` body from it. Static shuffle uses the same function → identical ordering for the same seed.
- **Snapshot/app agreement check:** `src/api/scripts/check-static-site-matches-app.ts`, run via `npm run check:static-site-matches-app` against the Library being published (prod by default); it gates publishing. Fixed param matrix (genre all/any/not, artist, bpm range incl. missing-BPM songs, rating range, favourite, search, combined filters, empty result, pagination boundaries) asserting identical membership, `total`, and genre stats. Sort order and `limit` slicing are out of scope. It also asserts the static site route set from `BrowseRoutes` contains no write-only route.

---

## Static data client

- `snapshotClient.ts` implements the existing `client.ts` read surface only: `fetchSongs`, `fetchSongById`, `fetchGenreStats`. No mutation exports.
- Loads the Snapshot once (`__SNAPSHOT_FILE__` + `BASE_URL`), keeps it in memory, applies `songQuery` functions. React Query stays, so hooks and components are unchanged.
- static site fetches before rendering routes: minimal "Loading library…" splash, then app. First-visit failure with no cache shows an explicit message, not a blank app.
- `genreStats` is computed in the browser per filter change (Map reduce). Fine at 10k songs; revisit only if it shows up in profiling.

---

## Offline and update flow (PWA, Snapshot mode only)

- `vite-plugin-pwa`, enabled only in Snapshot mode. Precache app shell **and** the versioned Snapshot; `cleanupOutdatedCaches: true`; never `CacheFirst` for `index.html` or the Snapshot.
- Manifest so it installs to the home screen. No service worker in the API build (data is live).
- Update flow (`registerType: 'prompt'`, auto-progressed): detect new version on load, on `visibilitychange`, and every ~15 min while online; show "Getting fresh tune data…" with progress while the new precache downloads; then `skipWaiting` + `clientsClaim` + one reload on `controllerchange`. No click-to-update, no zombie tab on old JS.
- **Static version identity = app version + Snapshot timestamp.** Footer: `0.1.0+3cfbcab · snapshot 18 Oct 2026 09:14`, mirrored into `#cratecaddy-version` data attributes (`data-version`, plus snapshot fields) next to the existing ones.
- Offline banner when `navigator.onLine` is false: "Offline · snapshot from 18 Oct".

---

## Publish and rollout

`scripts/publish-static-site.sh` fails closed: snapshot → validate → build → validate → archive → confirm → push. A plain run stops after the local build and asks before publishing; `--publish-to-github` skips the prompt, `--dry-run` never asks. Guard bypasses are named for what they allow: `--allow-smaller-library` and `--allow-dirty-build`.

- Pre-build guards: count > 0; abort if count dropped >20% vs the currently published Snapshot (read from `origin/gh-pages`) unless `--allow-smaller-library`; banned-key assertion; warn on >20 MB.
- Post-build guards: exactly one `data/snapshot-*.json`; filename hash matches `snapshot.version`; `index.html` and `.nojekyll` present; print count, size, `takenAt`, version for a final eyeball.
- Push: `gh-pages -d src/ui/dist-static --no-history --dotfiles -b gh-pages -m "snapshot <sha8> <takenAt>"` over the existing SSH remote. Interactive confirm if the working tree is dirty (footer would read `-dirty`).
- **Rollback:** archive the last 3 built `dist-static/` outputs to `src/data/static-deploys/<sha8>/` (gitignored). Rollback = republish an archive verbatim; re-snapshotting is not a rollback because the DB has moved on.
- **Pages setup (one-time, manual):** publish once to create `gh-pages`, then set it as the Pages source /(root). Custom domain is account-level on the user site (`lab.cartoonbeats.com`), so this repo has no `CNAME`; URL is `https://lab.cartoonbeats.com/cratecaddy` and `base: '/cratecaddy/'` must match. Full setup, per-publish checks and troubleshooting: [docs/smoke-tests.md](../docs/smoke-tests.md#0-github-setup-one-time-before-the-first-publish). Publishing is manual and local; no CI, no secrets, no Mongo in CI. `cratecaddy publish` delegates to the same script; the checkout is required and recommended to keep. Making publishing self-contained in the appliance is a future improvement.

---

## Implementation order (waypoint commits)

1. **Shared query contract:** extract `songQuery.ts` + pure `shuffleHash(id, seed)`; no behaviour change.
2. **Agreement check skeleton:** `check-static-site-matches-app.ts` + `npm run check:static-site-matches-app`, matrix green against the current API.
3. **Data layer:** move `client.ts` → `data/`, add `data/index.ts` + `@data` alias, hooks switch imports. API behaviour unchanged.
4. **Shell split:** `shell/Providers.tsx`, `shell/BrowseRoutes.tsx`, `main.tsx`, `main.static.tsx`; API shell parity with today's routes.
5. **Snapshot script:** config, whitelist, derived `isLocal`, validation, versioned filename, `SourcesIcons` change. Verify by hand against `DJing` counts.
6. **Static client + build wiring:** `snapshotClient.ts`, Vite mode plugin, `base`/`outDir`, `__SNAPSHOT_FILE__`, `dev:static`, `build:static`. Browse check green for Snapshot vs API.
7. **PWA + provenance:** precache, update flow, footer version with Snapshot timestamp, offline banner.
8. **Publish script:** guardrails, rollback archive, Pages setup docs, README/PRODUCTION additions.
9. **Smoke tests:** the checklist in [docs/smoke-tests.md](../docs/smoke-tests.md) covers the app, the appliance and the static site, including device checks (offline, update, touch targets, cold start).

---

## Out of scope

- Playback, playlists, requests, or any write action in the static site build.
- Authentication (out of scope for the app at this stage).
- CI-driven publishing, separate data repo, custom-domain automation.
- The cloud library API; the Snapshot wrapper is designed so a library-scoped API response can reuse it later.

---

## Risks

- **Route drift** between shells — mitigated by `BrowseRoutes` and the parity assertion.
- **Filter drift** — mitigated by ADR-0014's contract + parity matrix; any new filter must be added twice.
- **Cache staleness** — mitigated by content-hashed Snapshot + precache revisions + explicit update flow.
- **Pages `base` mismatch** — checked in the publish script and documented.
- **Sort-order mismatch** between builds — accepted and documented; not user-visible because a client sees one build at a time.
