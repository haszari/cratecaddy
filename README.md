# Crate Caddy

Music metadata exploration tool: React SPA frontend, Express API, and MongoDB database for indexing and discovering your music collection through genre tags.

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

## Database schema

Songs are stored with genres as an array for efficient indexing and aggregation. Import scripts perform incremental upserts by `trackId`, so re-importing updates existing songs and adds new ones without duplicates.

**To import your Rekordbox library:**
1. Export your library as XML from Rekordbox (File → Export Collection → save as `src/data/rekordbox.xml`)
2. Run: `cd src/api && npm run import`

**Filename:** The import script looks for `src/data/rekordbox.xml` by default. To specify a different file: `npm run import /path/to/custom.xml`

**Schema:**

```typescript
{
  trackId: "unique-id",        // Unique identifier from source (e.g., Rekordbox)
  name: "Song Name",
  artist: "Artist Name",
  genres: ["House", "Deep"],   // Array for fast queries and tag cloud generation
  album: "Album Name",
  bpm: 128,
  tonality: "Dm",
  // ... additional metadata
  lastImportDate: Date          // Timestamp of last import
}
```

## Production

Currently UI and API are built separately:

1. Build UI: `cd src/ui && npm run build` → outputs to `dist/`
2. Build API: `cd src/api && npm run build` → outputs to `dist/`
3. Serve UI from a static host (Vercel, Netlify, S3, etc.)
4. Run API server on a Node.js host with MongoDB connection

**Future:** A Docker Compose setup could containerize both the built UI and API in production for simplified deployment.
