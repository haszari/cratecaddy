# Crate Caddy

Music metadata exploration tool: React SPA frontend, Express API, and MongoDB database for indexing and discovering your music collection through genre tags.

🤖 *Warning: LLM agents helped build this thing - do not use for club gigs, weddings probably ok* 🚨

## Architecture

- **src/ui/** - Vite + React SPA displaying genre tag clouds from the API
- **src/api/** - Express TypeScript server with Mongoose models, CRUD endpoints at `/api/songs`
  - **MongoDB** - Document database running in Docker, stores song metadata with indexed genre arrays
- **Docker** - Only MongoDB runs in Docker; the API runs on the host (macOS) so it can call `osascript` for write round-trips to Apple Music

Architecture decisions are recorded in [docs/adr/](./docs/adr/).

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

- Frontend: http://localhost:7626
- API: http://localhost:7625/health

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
