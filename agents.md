# Crate Caddy - Agent Guidelines

Music metadata explorer with genre tag clouds. Two independent packages under `src/`.

## Repo structure

- `src/api/` — Express TypeScript server, `server.ts` is entrypoint
- `src/ui/` — Vite + React SPA, `main.tsx` is entrypoint
- `src/tools/` — seed scripts (`seed-db.sh` + `sample-songs.json`)
- `src/data/` — gitignored user data (import files, CSVs)
- `plans/` — design documents and refactor plans (review before executing)
  - Naming: `YYYYMMDD[a/b/c...]-descriptive-name.md`. Multiple plans on the same day get suffixed `a`, `b`, `c` in chronological order. Current/active plan is always the highest letter.
- `docs/adr/` — architecture decision records. Create/link one when a plan's decision lands (see existing `0001`–`0006`).
- `CONTEXT.md` — domain language glossary (ubiquitous language)
- No root `package.json` — each sub-package is independent

## Commands (run from `src/api/` or `src/ui/`)

| Package | Command | Note |
|---------|---------|------|
| api | `npm run dev` | `tsx watch src/server.ts` |
| api | `npm run build` | `tsc` (compiles to `dist/`) |
| api | `npm run import:applemusic <path>` | Needs MongoDB running; filters to songs with "DJing"/"Listening" grouping |
| api | `npm run import:rekordbox <path>` | Experimental, includes musical key |
| api | `npm run import:djaypro <path>` | Experimental, includes musical key |
| api | `npm run query:db <cmd>` | `count`, `sample`, `with-key`, `sources`, `duplicates`, `search:term` |
| ui | `npm run dev` | `vite` (serves on port from `src/ui/.env`) |
| ui | `npm run build` | `tsc -b && vite build` |
| api | `npm run lint` | ESLint 8, config via `eslint src --ext .ts` |
| ui | `npm run lint` | ESLint 9 flat config (`eslint.config.js`) |

**No test framework** is configured. No `typecheck` script exists.

## Architecture notes

- UI fetches ALL songs from `GET /api/songs` and filters client-side with `useMemo` hooks. No server-side search/filter endpoints beyond genre stats.
- API routes: `GET /api/songs`, `GET /api/songs/stats/genres`, CRUD by `:id`
- Favourite sync (ADR 0013) is **heart-only and one-way Apple → DB**: the `/favourited` button reads Loved tracks via AppleScript and stars/un-stars/creates DB songs accordingly. `Disliked` is untouched; DB hearts are never written back to Apple.
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
- UI has a Vite alias `@cratecaddy-api` pointing to `src/api/src/helpers/` — used for sharing API param type definitions (`@cratecaddy-api/apiParams`)
- Genre page URLs use `+` for AND (genre.all) and `,` for OR (genre.any): e.g. `/genre/Techno+Minimal` or `/genre/Techno,Deep`
- Pills render orange for AND mode, sage green for OR mode
- API runs on host (not in Docker) — `osascript` only exists on macOS; this is
  required for the write-to-apple-music endpoint

## Future scope

- **OR-genre builder UI**: The current interface is built for drilling down via AND mode (clicking a tag adds it with `+`). We need a separate UI to build OR genre queries (perhaps a toggle or alternate tag-click mode) since the tag cloud `+` button is conceptually additive/AND.

## Commit format

```
[agent <harness>-<model> <agent_skill_task_or_step>] <what changed and why>
```

- One commit per logical step (waypoint commits).
- Subject line is plain English: what changed and why. No shorthand like `s/foo/bar`.
- Body can add detail if needed.
- **Never amend, rebase, or otherwise edit commit history.** Only ever create new commits.
- **Only commit when explicitly instructed.**

## Best Practices

- Use `<Link>` over `<button onClick={navigate(...)}>` for navigation elements so cmd-click opens in new tab.

## Style

- Sentence case for all headings, labels, copy
- File references as markdown links with workspace-relative paths
- TypeScript ES modules, `tsx` runner for scripts
- NZ/GB English spelling throughout (favourite, colour, centre, etc.)
