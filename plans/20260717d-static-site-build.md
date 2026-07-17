# Step 3: Static site

**Parent:** [20260717a-alternative-build-targets-roadmap.md](./20260717a-alternative-build-targets-roadmap.md)

Build-time static site with configurable song list, deployable to GitHub Pages or custom endpoint.

**Depends on:** Step 1 for MongoDB access via Docker. Can work standalone if MongoDB is running locally.

**Decisions:** [ADR-0005](../docs/adr/0005-vite-mode-static-site.md), [ADR-0006](../docs/adr/0006-json-export-static-data.md)

---

## Current state

- UI fetches ALL songs from `GET /api/songs` and filters client-side
- All data access goes through `src/ui/src/api/client.ts`
- Vite build outputs to `dist/` (standard web app)
- No static export capability

---

## Plan

### 1. Export script (src/api/scripts/export-static-data.ts)

Queries MongoDB and writes a filtered song list to JSON. This runs at build time, not at runtime.

```typescript
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';

// Configurable filter — reads from env or CLI args
const FILTER = {
  grouping: process.env.EXPORT_GROUPING || 'DJing',
  // Extendable: bpm, rating, genre, etc.
};

async function exportStaticData() {
  await mongoose.connect(process.env.MONGODB_URI!);

  // Build MongoDB filter from config
  const query: any = {};
  if (FILTER.grouping) {
    query.grouping = { $in: FILTER.grouping.split(',') };
  }

  const songs = await mongoose.connection.db!
    .collection('songs')
    .find(query)
    .sort({ artist: 1, title: 1 })
    .toArray();

  const outputPath = path.resolve(__dirname, '../../ui/public/data/songs.json');
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(songs, null, 0));

  console.log(`Exported ${songs.length} songs to ${outputPath}`);
  await mongoose.disconnect();
}

exportStaticData().catch(console.error);
```

**Filter config options:**

| Env variable | MongoDB equivalent | Example |
|---|---|---|
| `EXPORT_GROUPING` | `grouping: { $in: [...] }` | `DJing` or `DJing,Listening` |
| `EXPORT_GENRE` | `genres: { $regex: ... }` | `Techno` |
| `EXPORT_MIN_BPM` | `bpm: { $gte: ... }` | `120` |
| `EXPORT_MAX_BPM` | `bpm: { $lte: ... }` | `140` |
| `EXPORT_FAVOURITE` | `favorite: 'starred'` | `starred` |

**Usage:**

```bash
# Export all DJing songs (default)
npm run --prefix src/api export:static

# Export all songs (no filter)
EXPORT_GROUPING="" npm run --prefix src/api export:static

# Export favourite songs
EXPORT_FAVOURITE=starred npm run --prefix src/api export:static

# Export high-BPM Techno
EXPORT_GROUPING="" EXPORT_GENRE=Techno EXPORT_MIN_BPM=130 npm run --prefix src/api export:static
```

**Add to src/api/package.json:**

```json
"export:static": "tsx scripts/export-static-data.ts"
```

**Open question:** Should the filter config live in a file (e.g. `static-export.config.json`) instead of env variables? Env variables are simpler for CI but less discoverable. A config file is easier to maintain and version.

### 2. staticClient.ts (src/ui/src/api/staticClient.ts)

Drop-in replacement for `client.ts` that operates on the in-memory JSON dataset. Same function signatures — hooks don't change.

```typescript
import type { ApiSongParams, ApiGenreStatsParams } from '@cratecaddy-api/apiParams';
import type { Song } from '../types';
import type { PaginatedResponse } from '../types';

let songsData: Song[] = [];

export async function loadData(): Promise<void> {
  const res = await fetch('/data/songs.json');
  songsData = await res.json();
}

export async function fetchSongs(params?: ApiSongParams): Promise<PaginatedResponse<Song>> {
  let filtered = [...songsData];

  // Apply filters (mirrors buildSongFilter logic)
  if (params?.genre?.all) {
    const genres = params.genre.all.split('+');
    filtered = filtered.filter(s =>
      genres.every(g => s.genres?.some(sg => sg.toLowerCase().includes(g.toLowerCase())))
    );
  }
  if (params?.genre?.any) {
    const genres = params.genre.any.split(',');
    filtered = filtered.filter(s =>
      genres.some(g => s.genres?.some(sg => sg.toLowerCase().includes(g.toLowerCase())))
    );
  }
  if (params?.search) {
    const term = params.search.toLowerCase();
    filtered = filtered.filter(s =>
      (s.artist?.toLowerCase().includes(term) ||
       s.title?.toLowerCase().includes(term) ||
       s.genres?.some(g => g.toLowerCase().includes(term)))
    );
  }
  if (params?.bpm?.gte) filtered = filtered.filter(s => s.bpm && s.bpm >= params.bpm!.gte!);
  if (params?.bpm?.lte) filtered = filtered.filter(s => s.bpm && s.bpm <= params.bpm!.lte!);
  if (params?.rating?.gte) filtered = filtered.filter(s => s.rating && s.rating >= params.rating!.gte!);
  if (params?.rating?.lte) filtered = filtered.filter(s => s.rating && s.rating <= params.rating!.lte!);
  if (params?.favorite) filtered = filtered.filter(s => s.favorite === params.favorite);

  // Sort
  const sortField = params?.sort || 'artist';
  const sortDir = params?.sortDir || 'asc';
  filtered.sort((a: any, b: any) => {
    const av = a[sortField] ?? '';
    const bv = b[sortField] ?? '';
    return sortDir === 'asc'
      ? String(av).localeCompare(String(bv))
      : String(bv).localeCompare(String(av));
  });

  // Paginate
  const page = params?.page || 1;
  const limit = params?.limit || 50;
  const start = (page - 1) * limit;

  return {
    data: filtered.slice(start, start + limit),
    page,
    limit,
    total: filtered.length,
    totalPages: Math.ceil(filtered.length / limit),
  };
}

export async function fetchGenreStats(params?: ApiGenreStatsParams): Promise<{ genre: string; count: number }[]> {
  let songs = [...songsData];

  // Apply same filters as fetchSongs for genre stats context
  if (params?.genre?.all) {
    const genres = params.genre.all.split('+');
    songs = songs.filter(s =>
      genres.every(g => s.genres?.some(sg => sg.toLowerCase().includes(g.toLowerCase())))
    );
  }
  // ... other filters

  const counts = new Map<string, number>();
  for (const song of songs) {
    for (const genre of (song.genres || [])) {
      counts.set(genre, (counts.get(genre) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([genre, count]) => ({ genre, count }));
}

export async function fetchSongById(id: string): Promise<Song | null> {
  return songsData.find(s => s._id === id) || null;
}
```

**Key design decisions:**
- Filter logic mirrors `buildSongFilter.ts` from the API — same semantics, JS array operations
- Genre stats computed the same way as NeDB approach (Map iteration)
- No TanStack Query needed — data is local, loaded once at startup. But keeping TanStack Query for consistency with the main UI is also fine.

**Open question:** The filter logic in `staticClient.ts` needs to mirror `buildSongFilter.ts` accurately. How much of the filter surface should be supported? Start with genre (all/any/not), search, BPM range, rating range, favourite. Edge cases like `genre.not` can be added later.

### 3. Vite mode config

**Create `src/ui/.env.static`:**

```
VITE_STATIC_MODE=true
VITE_API_URL=
```

**Update `src/ui/vite.config.ts`:**

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => {
  const isStatic = mode === 'static';

  return {
    plugins: [react()],
    resolve: {
      alias: isStatic
        ? {
            // In static mode: swap API client for static client
            // The import path in hooks is '../api/client'
            // We alias it to the static version
            [path.resolve(__dirname, 'src/api/client')]:
              path.resolve(__dirname, 'src/api/staticClient'),
            [path.resolve(__dirname, '@cratecaddy-api')]:
              path.resolve(__dirname, '../api/src/helpers'),
          }
        : {
            '@cratecaddy-api': path.resolve(__dirname, '../api/src/helpers'),
          },
    },
    build: {
      outDir: isStatic ? 'dist-static' : 'dist',
    },
    server: {
      port: isStatic ? 7627 : undefined,
    },
  };
});
```

**Open question:** The alias approach swaps `client.ts` for `staticClient.ts` at build time. But `staticClient.ts` imports types from `@cratecaddy-api/apiParams` — the alias needs to resolve that too. Verify that the double alias works correctly in Vite.

**Alternative approach:** Instead of aliasing the module, use a barrel file (`src/ui/src/api/index.ts`) that conditionally exports from `client` or `staticClient` based on the env var. This is simpler but adds a runtime check.

### 4. Data loading at app startup

**Update `src/ui/src/main.tsx`:**

```typescript
import { loadData } from './api/staticClient';

const isStaticMode = import.meta.env.VITE_STATIC_MODE === 'true';

async function bootstrap() {
  if (isStaticMode) {
    await loadData();
  }

  const root = ReactDOM.createRoot(document.getElementById('root')!);
  root.render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <MantineProvider forceColorScheme="dark">
          <App />
        </MantineProvider>
      </QueryClientProvider>
    </React.StrictMode>
  );
}

bootstrap();
```

**Open question:** Should `loadData()` block the entire app startup, or should there be a loading state? For a 5 MB JSON file on a modern phone, loading is <1s. A simple "Loading..." spinner during `loadData()` is sufficient.

### 5. HashRouter for static hosting

**Update `src/ui/src/App.tsx`:**

```typescript
import { BrowserRouter, HashRouter } from 'react-router-dom';

const isStaticMode = import.meta.env.VITE_STATIC_MODE === 'true';
const Router = isStaticMode ? HashRouter : BrowserRouter;

export default function App() {
  return (
    <Router>
      {/* ... existing routes */}
    </Router>
  );
}
```

GitHub Pages doesn't support server-side routing fallback. HashRouter uses `#/` URLs that work with any static host.

### 6. Build scripts

**Update `src/ui/package.json`:**

```json
"scripts": {
  "dev": "vite",
  "build": "tsc -b && vite build",
  "dev:static": "vite --mode static",
  "build:static": "npm run --prefix ../api export:static && tsc -b && vite build --mode static",
  "preview:static": "vite preview --mode static --port 7628"
}
```

**Build command:** `npm run build:static` (runs export script + TypeScript check + Vite build)

**Output:** `src/ui/dist-static/` — self-contained static site, deployable to any static host.

### 7. GitHub Pages deployment

**Option A: Deploy from dist-static/ to gh-pages branch:**

```bash
# Build
cd src/ui && npm run build:static

# Deploy to gh-pages branch
npx gh-pages -d dist-static -r git@github.com:user/cratecaddy.git -b gh-pages
```

**Option B: GitHub Actions workflow (`.github/workflows/deploy-static.yml`):**

```yaml
name: Deploy static site
on:
  push:
    branches: [main]
    paths:
      - 'src/ui/src/**'
      - 'src/api/src/**'

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: cd src/api && npm install && npm run build
      - run: cd src/ui && npm install && npm run build:static
      - uses: actions/deploy-pages@v4
        with:
          artifact_path: src/ui/dist-static
```

**Option C: Custom endpoint (e.g. S3, Netlify, Vercel):**

Just push `dist-static/` to the hosting provider. The build output is a standard static site — no special deployment logic needed.

**Open question:** Which deployment target? The user mentioned "branch of origin repo or custom endpoint." If it's a personal tool, `gh-pages` branch via `npx gh-pages` is simplest. If sharing, GitHub Actions + Pages is more maintainable.

### 8. Service worker for offline use

Add a service worker that caches the JSON data file and app shell. This serves the club DJ use case — unreliable connectivity, need instant startup.

**Approach:** Use `vite-plugin-pwa` (Workbox-based):

```bash
cd src/ui && npm install -D vite-plugin-pwa
```

**Update vite.config.ts:**

```typescript
import { VitePWA } from 'vite-plugin-pwa';

// In static mode config:
plugins: [
  react(),
  isStatic && VitePWA({
    registerType: 'autoUpdate',
    includeAssets: ['data/songs.json'],
    manifest: {
      name: 'CrateCaddy',
      short_name: 'CrateCaddy',
      theme_color: '#000000',
      background_color: '#000000',
    },
    workbox: {
      globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
      runtimeCaching: [
        {
          urlPattern: /\/data\/songs\.json$/,
          handler: 'CacheFirst',
          options: {
            cacheName: 'songs-data',
            expiration: { maxEntries: 1, maxAgeSeconds: 60 * 60 * 24 * 30 },
          },
        },
      ],
    },
  }),
].filter(Boolean),
```

**Open question:** Should the service worker be static-build-only, or should it also work in the main web app? For the main app (with live API), a service worker doesn't make sense — the data changes. Static-only is correct.

---

## Gaps / research needed

1. **Filter parity:** How closely should `staticClient.ts` mirror `buildSongFilter.ts`? The API filter supports `genre.not`, complex `$nor` conditions, and regex escaping. Start with the most-used filters and expand as needed.

2. **Song type sharing:** `staticClient.ts` imports `Song` type from `../types`. The exported JSON must match this type exactly. The MongoDB export includes `_id` as ObjectId — needs to be serialized as a string for JSON. Verify that `JSON.stringify` handles ObjectId correctly (it should, since `.toArray()` returns plain objects).

3. **Shuffle in static mode:** The shuffle algorithm uses a deterministic hash. Port `shuffleHash.ts` to work in the browser — it's pure math, no Node dependencies. Should be a direct copy.

4. **Service worker invalidation:** When the JSON data changes (new export), the service worker needs to pick up the new file. Workbox's `CacheFirst` strategy with a 30-day expiration means stale data for up to 30 days. Consider `StaleWhileRevalidate` instead, or a cache-busting query param on the JSON URL.

5. **Mobile testing:** The static site is optimised for phone use in clubs. Test on actual mobile devices — touch targets, font sizes, dark mode, offline behaviour.

6. **Data size on mobile:** A 5 MB JSON file on a mobile connection could take 2-5 seconds. Consider gzipping the JSON at build time (Vite does this automatically for assets, but `public/data/` files are served as-is). May need to move the JSON into the build output or add gzip compression.

7. **GitHub Pages base path:** If deployed to `username.github.io/cratecaddy/`, the Vite `base` config needs to be `/cratecaddy/`. If deployed to a custom domain or root, `base: '/'` is fine. Make this configurable.
