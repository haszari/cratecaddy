# Crate Caddy

Music metadata exploration tool: React SPA frontend, Express API, and MongoDB database for indexing and discovering your music collection through genre tags.

🤖 *Warning: LLM agents helped build this thing - do not use for club gigs, weddings probably ok* 🚨

## Architecture

- **src/ui/** - Vite + React SPA displaying genre tag clouds from the API
- **src/api/** - Express TypeScript server with Mongoose models, CRUD endpoints at `/api/songs`
  - **MongoDB** - Document database running in Docker, stores song metadata with indexed genre arrays

## Development

### Start

- `docker-compose up --build -d` - Start MongoDB and API server (from project root)
- `cd src/ui && npm run dev` - Start Vite frontend dev server (in another terminal)

### Stop

- `docker-compose down` - Stop MongoDB and API server
- `Ctrl+C` in Vite terminal - Stop frontend dev server

### Clear database

- `docker-compose down --volumes` - Stop containers and remove MongoDB volume

### Import data

- `cd src/api && npm run import:applemusic` - Import Apple Music XML library from `src/data/Library.xml`
- `cd src/api && npm run import:applemusic /path/to/file.xml` - Import from custom path

## Testing

- API health check: `http://localhost:3000/health`
- All songs: `http://localhost:3000/api/songs`
- Genre statistics: `http://localhost:3000/api/songs/stats/genres`
- Frontend: `http://localhost:5173`

## Production build / run - tbc, work in progress

Currently UI and API are built separately:

1. Build UI: `cd src/ui && npm run build` → outputs to `dist/`
2. Build API: `cd src/api && npm run build` → outputs to `dist/`
3. Serve UI from a static host (Vercel, Netlify, S3, etc.)
4. Run API server on a Node.js host with MongoDB connection

**Future:** A Docker Compose setup could containerize both the built UI and API in production for simplified deployment.
