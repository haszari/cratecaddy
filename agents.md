# Crate Caddy - Agent Guidelines

Music metadata explorer with genre tag clouds. Two independent packages under `src/`.

## Repo structure

- `src/api/` — Express TypeScript server, `server.ts` is entrypoint
- `src/ui/` — Vite + React SPA, `main.tsx` is entrypoint
- `src/tools/` — seed scripts (`seed-db.sh` + `sample-songs.json`)
- `src/data/` — gitignored user data (import files, CSVs)
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
- Song model has a Mongoose **pre-save hook** that auto-normalizes `artistTitleNormalized` and `genres` — relevant when writing import scripts
- Merge logic in `songService.upsertSongWithMerge` matches on normalized artist+title+duration (±2s tolerance)
- `src/ui/.env` sets `VITE_API_URL` and `UI_PORT`; `.env` is committed
- `src/.env` (root) is used by docker-compose for API side

## Tooling quirks

- API tsconfig uses `moduleResolution: "node"` — imports need `.js` extension (e.g. `import './config/database.js'`)
- UI tsconfig uses `moduleResolution: "bundler"` with `verbatimModuleSyntax: true` and `erasableSyntaxOnly: true` — requires `import type` for type-only imports, no `enum`/`namespace`
- UI uses SCSS (`.scss` files) — `sass-embedded` is a devDependency
- Dockerfile `EXPOSE 3000` is misleading — actual port is `API_PORT` from `.env` (default 7625)
- Docker compose mounts `./src/api/src:/app/src` for hot reload in the API container

## Style

- Sentence case for all headings, labels, copy
- File references as markdown links with workspace-relative paths
- TypeScript ES modules, `tsx` runner for scripts
