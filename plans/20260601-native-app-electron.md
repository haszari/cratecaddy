# Native App: Electron + Embedded DB

Take Crate Caddy from Docker/web-dev to a standalone macOS app with Apple
Music write access.

## Architecture

Layer diagram (proposed):

```
┌─────────────────────────────────────────┐
│           Electron (main process)        │
│  ┌─────────────────────────────────────┐ │
│  │  Express (same src/api/ source)     │ │
│  │  - /api/songs routes                │ │
│  │  - osascript write (works on host)  │ │
│  │  - import scripts (CLI only)        │ │
│  └──────────┬──────────────────────────┘ │
│             │ IPC                        │
│  ┌──────────▼──────────────────────────┐ │
│  │  Renderer (React, same src/ui/)     │ │
│  │  - Vite-built SPA                   │ │
│  │  - fetch() to localhost:PORT        │ │
│  └─────────────────────────────────────┘ │
│  ┌─────────────────────────────────────┐ │
│  │  Embedded DB (file-based)           │ │
│  │  e.g. ~/.cratecaddy/data            │ │
│  └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

Key properties:
- Express runs inside Electron's main process (Node.js)
- DB is a file next to the app data (no Docker, no mongod)
- React renderer hits Express via localhost (same as today)
- osascript calls the macOS `Music` app directly

## Two Approaches

### A. Express runs unchanged (recommended)

```
Electron main process:
  1. Start Express server on localhost:<port>
  2. Open BrowserWindow pointing at http://localhost:<port>/
```

- Zero changes to the UI codebase (fetch calls remain)
- Import scripts remain runnable from CLI (separate entry point)
- Trade-off: an extra localhost hop and port allocation

### B. Direct IPC (no HTTP server)

```
Electron main process:
  - Expose ipcMain handlers for every API operation
  Renderer:
  - Replace fetch() with window.electronAPI.* calls
```

- No port, no HTTP overhead, slightly faster
- Trade-off: every UI fetch call must change; import scripts still need a
  separate path (Express or direct); need a preload script with contextBridge

**Verdict**: Approach A unless bundle size or startup time becomes a problem.
The migration cost of B doesn't justify itself for a local-only app.

## Embedded Database

Replacing MongoDB/Mongoose with an embedded file-based DB. The Song model
needs to support:

- Upsert with `updateWithHistory` (find by normalized artist+title+duration)
- Genre stats aggregation (`$group` + `$sort`)
- Pre-save normalization hook
- Array fields: `genres`, `genresAll`, `set`, `stage`, `grouping`,
  `appleMusicIds`, `history`
- Nested object in `history.entry[]`
- Text search on artist/title (for `query:db search:<term>`)

| Need | Support |
|------|---------|
| Compound find (artist+title+duration ±2s) | Query engine |
| Aggregation (genre counts) | MapReduce or manual |
| Pre-save middleware | Yes (app-level) |
| Nested arrays | Both support |
| Indexing | Both support |
| Active maintenance (2026) | Both maintained |

### NeDB

npm: `@seald-io/nedb` (fork of original, maintained as of 2025)

- **API**: Almost identical to MongoDB — `find`, `insert`, `update`, `remove`
  with query selectors (`$or`, `$gte`, `$lte`, `$regex`, etc.)
- **Middleware**: None built-in (need to wrap calls)
- **Aggregation**: No pipeline — need manual `find` + sort in JS
- **Persistence**: Auto-compaction, single file per datastore
- **Indexing**: Compound indexes not supported; single-field only
- **Size**: ~30KB gzipped, zero deps

**Trade-offs**:
  + Minimal migration from Mongoose syntax
  + Tiny, simple, well-understood
  - Compound queries on normalized+duration require a two-step find + filter
  - Genre stats means loading all songs and counting in JS
  - No aggregation pipeline — manual work for any grouped query
  - No schema validation

Migration path: Replace `SongModel.find(...)` → `db.findAsync(...)`. Wrap
pre-save hook in a function called before `db.updateAsync(...)`. Each
model gets its own `.db` file.

### LokiJS

npm: `lokijs`

- **API**: Document store with MongoDB-like queries, but different method
  names (`find` → `find` on `Collection`, uses `$loki` id)
- **Middleware**: None (app-level)
- **Aggregation**: `collection.chain().find().simplesort(...).data()`
  for chained queries; `mapReduce` for aggregation
- **Persistence**: JSON file, configurable autosave
- **Indexing**: Single-field binary index + optional compound via
  DynamicView
- **Size**: ~50KB gzipped, zero deps
- **DynamicViews**: Pre-filtered results that stay in sync — useful for
  genre listing

**Trade-offs**:
  + Chained queries (DynamicView) good for filtering without full reload
  + mapReduce for aggregation
  + Autosave with compression option
  - Different API from MongoDB — more migration work
  - Smaller community than NeDB (though both are small)
  - Binary index only on single fields (compound requires manual filtering)
  - MapReduce is JS functions running in-process; fine for source-count

### Decision Matrix

| Criterion | NeDB | LokiJS |
|-----------|------|--------|
| Mongoose similarity | High | Low |
| Compound find (artist+title+duration) | Manual + filter | Manual + filter |
| Genre aggregation | Manual JS | MapReduce |
| Active maintenance | Good (fork) | Slow updates |
| Bundle impact | ~30KB | ~50KB |
| Setup complexity | Low | Medium |
| Nested doc support | Good | Good |

### Recommendation

**NeDB** — the Mongoose-like query syntax keeps migration mechanical. You
write a wrapper module that mirrors the current `songService` functions
but hits NeDB instead of Mongoose. Genre stats require loading all docs
and counting in JS, which is fine at the current scale (< 10K songs).

If genre stats on 50K+ songs ever matters, revisit LokiJS for its
mapReduce or swap in SQLite with proper aggregation.

## Step-by-step Migration (Reference)

1. Add `electron` + `@seald-io/nedb` + `tsx` bundler to `src/api/`
2. Create `src/api/src/database/nedb.ts` — inits NeDB, exports
   songCollection with async wrappers
3. Create `src/api/src/database/songService.nedb.ts` — mirrors existing
   songService functions, replaces Mongoose calls with NeDB
4. Add `electron/main.ts` — starts Express, opens BrowserWindow, sets
   data path to `app.getPath('userData')`
5. Update `package.json` main/scripts for electron
6. Wire up import scripts as direct Node entry points (still work)
7. Test with existing dataset, retire docker-compose

## Open Questions

- Do import scripts run inside Electron or as standalone Node? (Standalone
  is simpler — they still use NeDB at the same file path.)
- Do we want an auto-launch-on-login option?
- Ship as signed macOS .app via electron-builder or similar?
- How does the user seed initial data? Drag-and-drop XML onto the app?
