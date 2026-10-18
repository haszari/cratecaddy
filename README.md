# CrateCaddy

Music metadata exploration tool: React SPA frontend, Express API, and MongoDB database for indexing and discovering your music collection through genre tags.

🤖 *Warning: LLM agents helped build this thing - do not use for club gigs, weddings probably ok* 🚨

Architecture decisions are recorded in [docs/adr/](./docs/adr/).

## Production build / run

CrateCaddy can run as a self-contained service on macOS. MongoDB in Docker, built API serving UI static webapp. Launch with `cratecaddy` command, optional auto-start on boot.

See [PRODUCTION.md](./PRODUCTION.md) for step-by-step install, commands, and what it does to your system.

## Static site

A read-only, offline-capable version of the browse UI can be published from the same library and codebase.

```bash
# Publish: snapshot the prod Library → check → build → confirm → push
cratecaddy publish
cratecaddy publish --publish-to-github     # skip the prompt

# Build locally without publishing, then preview
cratecaddy publish --dry-run
cd src/ui && npm run preview:static        # http://localhost:5328/cratecaddy/

# Develop against the static build with the dev Library
cd src/api && npm run snapshot
cd ../ui && npm run dev:static
```

Published at <https://lab.cartoonbeats.com/cratecaddy> from a single-commit `gh-pages` branch. First-time Pages and custom-domain setup, plus per-publish deploy checks, are in [smoke tests](./docs/smoke-tests.md).

- **Snapshot**: point-in-time, filtered copy of the library, defaulting to songs whose grouping contains `DJing` **and that are owned** (a local file, not cloud-only). Filter lives in `snapshot.config.json`, overridable with `--grouping` / filter flags.
- **Offline**: the app shell and Snapshot are precached; after a first visit it works with no connection. A new Snapshot is fetched and activated automatically, with a "Getting fresh tune data…" signal — no stuck cached version.
- **Read-only by construction**: the site has no edit route, no write-to-Apple Music and no history. Local file paths and import provenance are stripped from the Snapshot.
- **Rollback**: each publish archives its build to `src/data/static-deploys/<sha8>/` (gitignored, last 3 kept). Roll back with `cratecaddy publish --publish-archive=<sha8>`.
- Publishing is manual and local — CI cannot reach the library database.
- The Snapshot is taken from the **prod** appliance database by default (`--use-dev-library` only for wiring checks).

Run the [smoke tests](./docs/smoke-tests.md) before trusting a build or a publish; the ordered dev → prod → publish sequence is the [release run-through](./docs/smoke-tests.md).

See [plans/20261018-static-site-build.md](./plans/20261018-static-site-build.md) and [CONTEXT.md](./CONTEXT.md) for the Snapshot definition.

## Development

### First time setup

Ports and config are in `.env` files (committed, override as needed):

- `src/.env` — API port, MongoDB URI
- `src/ui/.env` — API URL, UI port

```bash
# Start MongoDB (Docker)
docker compose up -d

# Install API dependencies
cd src/api && npm install

# Install UI dependencies
cd src/ui && npm install
```

### Daily build & run

```bash
# Terminal 1: MongoDB (Docker)
docker compose up -d

# Terminal 2: API server (host, macOS)
cd src/api && npm run dev

# Terminal 3: Frontend dev server (Vite)
cd src/ui && npm run dev
```

- Frontend: http://localhost:5325
- API: http://localhost:5326/health

#### Hot reload

Code changes are picked up automatically — no restart needed for normal development.

| Code change | How it's picked up |
|---|---|
| UI source (`src/ui/src/`) | Vite HMR — instant browser update |
| API source (`src/api/src/`) | `tsx watch` — auto-restarts on save |

### Database management

#### Start/stop MongoDB

```bash
docker compose up -d    # Start
docker compose down             # Stop MongoDB + remove container (data persists)
```

#### Reset MongoDB (wipe all data)

```bash
docker compose down --volumes
docker compose up -d
```

### Import data from Apple Music

Import music library metadata from Apple Music. 

- In Apple Music: `File > Library > Export Library` - generates xml file. 
- `cd src/api && npm run import:applemusic ~/Music/Music/Library.xml` to import xml file.

This will import all song metadata with grouping containing `DJing` or `Listening`. 

### Import data from djay Pro

Import from a djay Pro CSV export.

- `cd src/api && npm run import:djaypro src/data/dJayPro.csv`

### Import entry points (dev vs prod)

Import scripts are the same in dev and prod — one source of truth. The two entry points only differ in which database they target:

- `npm run import:applemusic` / `npm run import:djaypro` (dev) — targets the dev database from the root `.env` config
- `cratecaddy import` (prod, see [PRODUCTION.md](./PRODUCTION.md)) — targets the prod database, controlled by `cratecaddy import dev|prod [apple|djay] <file>`

Song data is merged based on artist + title + duration, and import process updates database (can re-import multiple times safely - idempotent).

#### experimental

- `cd src/api && npm run import:rekordbox src/data/rekordbox.xml` 

Experimental import from Rekordbox that includes musical key data. As above, can be rerun, data is merged based on key song metadata. Source-specific metadata is stored separately in the mongodb record. 

## Architecture

- **src/ui/** - Vite + React SPA displaying genre tag clouds from the API
- **src/api/** - Express TypeScript server with Mongoose models, CRUD endpoints at `/api/songs`
  - **MongoDB** - Document database running in Docker, stores song metadata with indexed genre arrays
- **Docker** - Only MongoDB runs in Docker; the API runs on the host (macOS) so it can call `osascript` for write round-trips to Apple Music

