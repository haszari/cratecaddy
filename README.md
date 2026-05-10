# Crate Caddy

Music metadata exploration tool: React SPA frontend, Express API, and MongoDB database for indexing and discovering your music collection through genre tags.

🤖 *Warning: LLM agents helped build this thing - do not use for club gigs, weddings probably ok* 🚨

## Architecture

- **src/ui/** - Vite + React SPA displaying genre tag clouds from the API
- **src/api/** - Express TypeScript server with Mongoose models, CRUD endpoints at `/api/songs`
  - **MongoDB** - Document database running in Docker, stores song metadata with indexed genre arrays

## Development

### First time setup

Ports and config are in `.env` files (committed, override as needed):

- `src/.env` — API port, MongoDB URI (used by docker compose)
- `src/ui/.env` — API URL, UI port

```bash
# Build Docker image (installs npm deps for the API)
docker-compose up --build -d

# Install frontend dependencies
cd src/ui && npm install
```

### Daily build & run

```bash
# Terminal 1: MongoDB + API server (Docker)
docker-compose up -d

# Terminal 2: Frontend dev server (Vite)
cd src/ui && npm run dev
```

- Frontend: http://localhost:7626
- API: http://localhost:7625/health

#### Hot reload

Code changes are picked up automatically — no restart needed for normal development.

| Code change | How it's picked up |
|---|---|
| UI source (`src/ui/src/`) | Vite HMR — instant browser update |
| API source (`src/api/src/`) | `tsx watch` inside Docker auto-restarts on save. Source is mounted as a volume, so changes sync instantly. |

### Restart, rebuild, clean state

These are for edge cases — you shouldn't need them during normal development.

#### When to restart the API container

If `tsx watch` misses a change or gets stuck, restart the container without rebuilding:

```bash
docker-compose restart api
```

The image is unchanged — this just re-runs the existing container.

#### When to rebuild the Docker image

Rebuild when infrastructure changes. The API's `src/` is mounted as a volume for hot reload, so code changes don't need it.

```bash
docker-compose up --build -d
```

Needed after:
- `package.json` changed (new dependency, script, etc.)
- `Dockerfile` changed
- `docker-compose.yml` changed

#### What state builds up during development

Imports and database changes accumulate in MongoDB, which stores data in a Docker volume (`mongodb_data`). This is persistent across container restarts — your imported songs, genres, and edits survive `docker-compose down` and `docker-compose up`.

#### When to do a full state wipe

Blows away containers **and** the MongoDB data volume, starting completely fresh:

```bash
docker-compose down --volumes
docker-compose up -d
```

Use this when you want a clean slate (no imported songs, start from zero) or suspect volume corruption.

#### Stop

```bash
docker-compose down          # Stop MongoDB + API
# Ctrl+C in Vite terminal    # Stop frontend
```

`docker-compose down` without `--volumes` keeps the database volume intact.

### Import data from Apple Music

Import music library metadata from Apple Music. 

- In Apple Music: `File > Library > Export Library` - generates xml file. 
- `cd src/api && npm run import:applemusic ~/Music/Music/Library.xml` to import xml file.

This will import all song metadata with grouping containing `DJing` or `Listening`. 

See [import-apple-music.ts](./src/api/scripts/import-apple-music.ts) for details.

Song data is merged based on artist + title + duration, and import process updates database (can re-import multiple times safely - idempotent).

#### experimental

- `cd src/api && npm run import:rekordbox src/data/rekordbox.xml` 
- `cd src/api && npm run import:djaypro src/data/dJayPro.csv` 

Experimental import from other sources that include musical key data. As above, can be rerun, data is merged based on key song metadata. Source-specific metadata is stored separately in the mongodb record. 

Not recommended or supported at present, cumbersome flow. 

## Testing

- API health check: `http://localhost:7625/health`
- All songs: `http://localhost:7625/api/songs`
- Genre statistics: `http://localhost:7625/api/songs/stats/genres`
- Frontend: `http://localhost:7626`

## Production build / run - tbc, work in progress

Currently UI and API are built separately:

1. Build UI: `cd src/ui && npm run build` → outputs to `dist/`
2. Build API: `cd src/api && npm run build` → outputs to `dist/`
3. Serve UI from a static host (Vercel, Netlify, S3, etc.)
4. Run API server on a Node.js host with MongoDB connection

**Future:** A Docker Compose setup could containerize both the built UI and API in production for simplified deployment.
