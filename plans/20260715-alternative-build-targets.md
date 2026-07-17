# Alternative build targets: Native app and static site

Analysis and options research for two independent build targets that extend (not fork) the existing web app:

1. **macOS native app** — runs locally, no Docker/services required
2. **Static site** — build-time generated, deployable to GitHub Pages or file host

Both leave the existing `npm run dev` / `npm run build` workflow untouched.

**Decisions captured as ADRs:**
- [ADR-0003: Swift + WKWebView for native app wrapper](../docs/adr/0003-swift-wkwebview-native-app.md)
- [ADR-0004: NeDB for native app database](../docs/adr/0004-nedb-native-app-database.md)
- [ADR-0005: Vite mode for static site build](../docs/adr/0005-vite-mode-static-site.md)
- [ADR-0006: JSON export for static site data](../docs/adr/0006-json-export-static-data.md)

---

## Native app wrapper

### Option A: Swift + WKWebView + Node subprocess (recommended)

A native macOS Swift app that creates a window hosting WKWebView, with a bundled Node.js subprocess running the existing Express server. The WKWebView loads `http://localhost:<port>` — identical to the current web dev setup, but the server is a managed subprocess and the shell is native AppKit.

**Architecture:**

```
┌──────────────────────────────────────────────┐
│  Swift app (main process)                    │
│                                              │
│  ┌────────────────┐  ┌────────────────────┐  │
│  │  WKWebView      │  │  Node.js process   │  │
│  │  (loads UI)     │←─│  (Express server)  │  │
│  │                 │  │  same src/api/ code │  │
│  └────────────────┘  └────────────────────┘  │
│         ↑ localhost HTTP            ↑ spawn  │
│  ┌──────────────────────────────────────────┐│
│  │  AppKit window: title bar, menus, Dock   ││
│  └──────────────────────────────────────────┘│
└──────────────────────────────────────────────┘
```

**What the Swift code does (estimated ~200 lines):**
1. Creates an `NSWindow` with custom title bar, vibrancy, traffic light positioning
2. Hosts a `WKWebView` that loads `http://localhost:<port>`
3. Spawns the Node.js binary (bundled in `.app/Contents/Resources/`) as a subprocess
4. Monitors the subprocess — restarts on crash, kills on app quit
5. Listens for app lifecycle events (willTerminate, didBecomeActive)

**Communication: simplest option is localhost HTTP** — the Node Express server runs on a random available port, Swift opens WKWebView pointed at it. No IPC bridge needed. This is exactly how the app already works in dev, just with the server as a managed subprocess instead of a separate terminal.

Alternative: `WKScriptMessageHandler` for JS→Swift calls (e.g. "open file picker") and `evaluateJavaScript` for Swift→JS. But for the initial implementation, HTTP is sufficient.

**Bundling Node.js:**
- Node binary goes in `CrateCaddy.app/Contents/Resources/node`
- Express server code goes alongside it
- On app launch, Swift spawns `./Contents/Resources/node ./Contents/Resources/server.js`
- Node binary is ~40 MB (can be stripped with `strip -x` to ~25 MB)
- Total app bundle: ~30–40 MB (Swift binary + Node + UI assets)

**Pros:**
- **Right tool for the platform** — Swift/AppKit is the actual macOS native toolkit, not a cross-platform wrapper
- Smallest bundle (~30–40 MB total, vs Tauri ~100 MB, Electron ~200 MB)
- Lowest memory (~50 MB idle for the Swift shell; Node subprocess uses its own)
- Real AppKit window chrome — native menus, Dock integration, Spotlight, AppleScript all first-class
- osascript for Apple Music write works directly from the Node subprocess (already runs on macOS host)
- Zero rewrite of Express API code — same server, same ports, same fetch calls
- No new framework or cross-platform abstraction to learn — Swift is the standard macOS development language
- WKWebView shares system webview infrastructure (shared memory with Safari)

**Cons:**
- Swift is a new language for this codebase (though the Swift code is minimal — window + process management)
- No built-in sidecar lifecycle manager (unlike Tauri) — you write spawn/monitor/kill logic yourself
- macOS only — no cross-platform path (but this is a macOS tool with AppleScript integration, so that's fine)
- WKWebView quirks — some CSS features behave differently than Chromium. Your UI needs testing on WebKit.
- Development workflow requires running Node separately during dev (or a scheme that runs both)

**Development workflow:**
- Terminal 1: `npm run dev` (API on port 7625, UI on 7626) — same as today
- Terminal 2: `swift run` or Xcode "Run" — opens the native window pointed at `localhost:7626`
- The Swift shell is just a container during development — all the real work happens in the existing web dev setup
- Alternatively: Xcode scheme with a "Run Script" build phase that starts the Node server before launching

**Code signing / notarization:**
- Standard macOS process — same as any Swift app
- `codesign` + `notarytool` via Xcode or CLI
- No special handling needed (unlike Electron which requires `electron-builder` signing config)

---

### Option B: Tauri 2 (Rust + system webview)

Tauri 2.x uses Rust for the app shell and the OS-native webview (WKWebView on macOS). Your existing Vite + React UI loads in the webview with no changes. A Node.js sidecar process runs the Express server.

**Architecture:**

```
┌──────────────────────────────────────────────┐
│  Tauri app (Rust main process)               │
│                                              │
│  ┌────────────────┐  ┌────────────────────┐  │
│  │  WKWebView      │  │  Node.js sidecar   │  │
│  │  (loads UI)     │←─│  (Express server)  │  │
│  │                 │  │  same src/api/ code │  │
│  └────────────────┘  └────────────────────┘  │
│         ↑ localhost HTTP    ↑ tauri sidecar  │
│  ┌──────────────────────────────────────────┐│
│  │  Tauri Rust shell: config, permissions   ││
│  └──────────────────────────────────────────┘│
└──────────────────────────────────────────────┘
```

**What the Rust code does:**
- Tauri boilerplate: `main.rs` opens a webview window, configures the sidecar
- Sidecar lifecycle is managed by Tauri (auto-start, auto-stop)
- Sidecar is configured in `tauri.conf.json` with binary path and arguments
- Can add Tauri plugins for file system, clipboard, notifications etc.

**Bundling Node.js as sidecar:**
- Node.js SEA (Single Executable Application) or `pkg` to create a standalone binary
- Binary goes in `src-tauri/binaries/`
- Tauri manages spawn/stop lifecycle automatically
- Node SEA binary is ~90 MB (the Node runtime itself)

**Pros:**
- Very good native feel — WKWebView with Tauri plugins for vibrancy, traffic lights, global shortcuts
- Built-in sidecar lifecycle management (auto-start/stop/crash recovery)
- Cross-platform if you ever want Windows/Linux
- Tauri plugin ecosystem (file system, clipboard, notifications, auto-updater, single-instance)
- Capability-based security model by default
- Active community, good documentation

**Cons:**
- **Rust is a new language for a minimal benefit** — the Tauri shell layer is Rust, but you're not writing Rust logic. You're writing boilerplate to open a window and spawn a sidecar. Swift does the same thing without the cross-platform abstraction tax.
- Node SEA sidecar adds ~90 MB to the bundle (vs ~40 MB for raw Node binary in Swift approach)
- Total bundle ~100 MB (vs ~30–40 MB for Swift)
- Cross-platform benefit is irrelevant — this is a macOS tool with AppleScript/osascript integration
- Rust toolchain is a new build dependency (rustup, cargo, target triples)
- Tauri's sidecar communication is HTTP to localhost anyway — same as the Swift approach, just with a Rust layer in between

---

### Option C: Electron (not recommended)

Electron bundles Chromium + Node.js. Express runs directly in the main process — zero rewrite of API code. See [20260601-native-app-electron.md](20260601-native-app-electron.md) for the full plan.

**Why not recommended:**
- ~200+ MB bundle — five to seven times larger than Swift approach
- 150–300 MB idle RAM — problematic alongside DAWs and DJ software
- Chromium instead of WKWebView — doesn't feel native, extra battery drain
- Electron is increasingly a legacy choice for new macOS-only projects

---

### Comparison matrix

| | Swift + WKWebView | Tauri 2 | Electron |
|---|---|---|---|
| **Bundle size** | ~30–40 MB | ~100 MB | ~200+ MB |
| **Idle memory** | ~50 MB + Node | ~30–80 MB + Node | 150–300 MB |
| **Native feel** | Excellent (real AppKit) | Very good (WKWebView) | Good (Chromium) |
| **New language** | Swift | Rust | None |
| **Lines of new code** | ~200 (window + process) | ~50 (Tauri boilerplate) | ~50 (Electron main) |
| **Sidecar management** | Manual (spawn/monitor) | Built-in | N/A (in-process) |
| **Cross-platform** | No (macOS only) | Yes | Yes |
| **Relevant for this project** | Yes — macOS tool with osascript | Partially — cross-platform not needed | No — too heavy |
| **Build/packaging** | Xcode / `swift build` | `tauri build` | `electron-builder` |
| **Code signing** | Standard macOS | Standard macOS | electron-builder config |
| **Development** | `npm run dev` + `swift run` | `tauri dev` | `electron-vite dev` |

---

## Native app database

### Decision: NeDB for initial native app build

The native app is an experiment. NeDB's MongoDB-like query API makes the migration mechanical — swap `Song.find()` to `db.find()`, replace `aggregate()` with ~15 lines of JS. Estimated 1-2 days of work. This gets a working native app fastest.

SQLite is the better long-term choice (see [SQLite as future pivot](#sqlite-as-future-pivot) below) and may eventually replace NeDB if the native app proves worth investing in.

### NeDB overview

Fork of the original NeDB (`@seald-io/nedb`), maintained as of 2025. MongoDB-like query API in a single embedded file. No process to manage.

**Key properties:**
- Entire dataset kept in memory (~15–20 MB for 10K songs with indexes)
- Append-only persistence with auto-compaction on load
- Single-process only — cannot share across Node workers
- No aggregation pipeline — all group/count/sort is in-memory JS
- `$regex`, `$or`, `$and`, `$nor`, `$gte`, `$lte`, `$exists` all supported
- Insert: ~10K ops/s, Find: ~16K ops/s, Update: ~8K ops/s at 10K docs

### What migrates easily (NeDB)

| Operation | Current (Mongoose) | NeDB equivalent | Effort |
|-----------|-------------------|-----------------|--------|
| Find all songs | `Song.find().sort()` | `db.find({}).sort()` | Trivial |
| Find by ID | `Song.findById(id)` | `db.findOne({ _id: id })` | Trivial |
| Find by Apple Music ID | `Song.findOne({ appleMusicIds })` | `db.findOne({ appleMusicIds: id })` | Trivial |
| Find matching candidates | `Song.find({ artistTitleNormalized, duration: {$gte, $lte} })` | `db.find({ artistTitleNormalized, duration: {$gte, $lte} })` | Trivial |
| Count documents | `Song.countDocuments(filter)` | `db.count(filter)` | Trivial |
| Insert | `new Song(data).save()` | `db.insert(data)` | Trivial |
| Update | `song.save()` | `db.update({ _id }, { $set: data })` | Trivial |
| Delete | `Song.findByIdAndDelete(id)` | `db.remove({ _id: id })` | Trivial |
| History query | `HistoryEntry.find({ songId }).sort()` | `historyDb.find({ songId }).sort()` | Trivial |

**Note on compound queries:** The main compound query (`findMatchingSong` — normalized artist+title + duration range ±2s) translates directly to NeDB. NeDB supports `$gte`/`$lte` on the same query, so no two-step filtering needed. This was an earlier concern that turned out to be invalid for CrateCaddy's actual queries.

### What needs rewriting (NeDB)

| Operation | Current (Mongoose) | NeDB approach | Lines | Effort |
|-----------|-------------------|---------------|-------|--------|
| Genre stats | `Song.aggregate([$unwind, $group, $sort, $project])` | Load all songs, iterate `genres[]`, count with `Map`, sort | ~15 | Low |
| Filtered genre stats | Same with prepended `$match` | `db.find(filter)` then same Map iteration | ~20 | Low |
| Shuffle mode | `Song.aggregate([$addFields: {$function}])` | `db.find(filter)`, compute hash in JS, sort in memory, paginate with `.slice()` | ~25 | Low |
| Pre-validate hook | `songSchema.pre('validate', ...)` | Explicit `normalizeSongForDb()` function called before every insert/update | ~15 | Low |
| Merge/upsert logic | `updateWithHistory()` — 150 lines of Mongoose calls | Same algorithm, swap Mongoose calls for NeDB calls | ~150 | Medium |

**The merge logic (`updateWithHistory`)** is the largest single piece. The algorithm doesn't change — just the data access calls. The function does: find by Apple Music ID → fallback to normalized name + duration range → merge sources array → union-merge genres/grouping → date-based field precedence → format hierarchy for canonical ID → save → push history. Each of those steps becomes a NeDB query instead of a Mongoose query. The logic is unchanged.

**Bonus: the `$function` shuffle** is actually easier to migrate than it looks. The hash function is a simple DJB2 variant (17 lines in `shuffleHash.ts`). In NeDB, you just compute the hash after fetching, then sort in memory. The MongoDB approach runs the hash server-side in the pipeline, but at 10K docs the difference is negligible. The `$function` with `lang: 'js'` is also a portability problem — it wouldn't run on MongoDB Atlas Serverless, so both NeDB and SQLite avoid this entirely.

### Performance: JS aggregation vs MongoDB native

At CrateCaddy's scale (10K songs, 2-3 genres each):

| Operation | MongoDB (indexed) | NeDB (in-memory JS) | Difference |
|-----------|-------------------|---------------------|------------|
| Genre stats (all songs) | ~5–20ms | ~2–5ms | NeDB faster (no network) |
| Filtered genre stats | ~10–30ms | ~50–200ms (regex full scan) | MongoDB faster |
| Shuffle + paginate | ~20–50ms | ~5–15ms (hash in JS) | NeDB faster |
| Find by normalized name + duration | ~2–5ms | ~1–3ms (indexed) | Roughly equal |

The genre stats aggregation is actually faster in NeDB because everything is in memory — no `$unwind` pipeline overhead, just a Map iteration. The filtered genre stats are slower because NeDB does a full scan with regex (no index support for regex queries), but 50-200ms is imperceptible in a UI.

**At 50K songs:** NeDB's in-memory model uses ~100-150 MB with indexes. Still fine for a desktop app. Regex full scans would be ~200-500ms. Noticeable but acceptable.

**At 100K+ songs:** NeDB starts to strain. Memory usage approaches 300+ MB. This is where SQLite becomes necessary — but CrateCaddy is unlikely to reach this scale.

### NeDB concerns and mitigations

| Concern | Severity | Mitigation |
|---------|----------|------------|
| No aggregation pipeline | Medium | 3 pipelines in codebase, all simple group-count-sort, ~15 lines of JS each |
| No schema validation | Low | App already validates at import layer; explicit normalisation function replaces pre-save hook |
| Single-process only | Low (native app), Medium (web service) | Fine for native app (single process). Limits web service scaling. |
| Append-only persistence | Low | 30s data loss window on crash. Acceptable for a personal tool. Auto-compaction on load. |
| Regex queries always full scan | Low | 10K docs: 50-200ms. Imperceptible. At 50K: 200-500ms. Acceptable. |
| Smaller community than SQLite | Low | API is stable, well-documented. `@seald-io/nedb` fork is maintained. |
| No concurrent writes | Low | Import scripts are CLI-only, run sequentially. No conflict with API. |

---

### SQLite as future pivot

If the native app proves worth investing in, or if a web service with multi-user support becomes a goal, SQLite via `better-sqlite3` + Drizzle ORM is the natural next step.

**Why SQLite over NeDB long-term:**

1. **Proper aggregation** — `json_each()` + `GROUP BY` handles genre stats natively in SQL. No JS post-processing. The filtered genre stats query composes naturally: `WHERE <conditions> GROUP BY genre ORDER BY genre`.

2. **FTS5 full-text search** — An actual inverted index for artist/title/genre search. Currently CrateCaddy uses `$regex` which is always a full scan. FTS5 makes search instant regardless of dataset size.

3. **WAL mode** — Concurrent reads while a write is in progress. The import script could run while the API serves requests. NeDB serialises all access.

4. **Single file, zero config** — A `.db` file in `~/.cratecaddy/`. Backup is a file copy. Same simplicity as NeDB, but with proper persistence (WAL + fsync) instead of append-only.

5. **Web service compatibility** — SQLite handles concurrent reads from multiple API workers (WAL mode). NeDB is single-process only. If the web service ever moves off MongoDB, SQLite is a viable replacement.

6. **Relational queries** — "Songs that share a genre with song X", "top artists by song count", "genre co-occurrence matrix" — all trivial in SQL, all require loading all docs in NeDB.

7. **Industry momentum** — Drizzle ORM is actively developed with strong TypeScript support. `better-sqlite3` is the fastest Node.js SQLite driver. NeDB's fork is maintained but niche.

**Migration cost from NeDB to SQLite:** ~4-5 days (27-39 hours). The main work:

| Component | Effort | Notes |
|-----------|--------|-------|
| Schema definition | ~3h | Song table + History table + indexes |
| Service layer rewrite | ~8-12h | Every method uses Drizzle queries instead of NeDB |
| Filter builder rewrite | ~4-6h | MongoDB filter DSL → Drizzle `where` clauses |
| Genre stats | ~2-3h | `json_each()` + `GROUP BY` pattern |
| Data migration script | ~3-4h | NeDB datafile → SQLite `.db` |
| Testing | ~4-6h | Verify all queries, data integrity, edge cases |

The merge/upsert logic (`updateWithHistory`) is the same algorithm regardless of database — only the data access calls change. This is ~150 lines of logic that stays constant across any database choice.

**Key SQLite schema decision:** Store `genres: [String]` as a JSON text column (not a junction table). This matches the current MongoDB model, works with `json_each()` for aggregation, and keeps the migration simple. A junction table would be more "correct" relationally but adds complexity for no practical benefit at this scale.

---

## Static site data strategy

### Option 1: Plain JSON (recommended)

Build-time script exports filtered songs from MongoDB to a JSON file. Browser loads it once and filters in memory.

**Pros:**
- Dataset is small — 10K songs at ~500 bytes each = 5 MB uncompressed, ~500 KB gzipped
- Instant startup — `JSON.parse()` of a fetched file, no WASM initialization
- Zero deploy complexity — just a static file
- Best for mobile DJ use — immediate interactivity, no warmup
- All filtering/sorting/stats are simple `Array.filter()` / `Array.reduce()` operations

**Cons:**
- No full-text search index (but regex on 10K strings is sub-millisecond anyway)
- Data is a snapshot — must rebuild to update
- Grows linearly with song count (but 50K songs would still be ~25 MB uncompressed, fine for gzipped)

### Option 2: SQLite WASM (sql.js)

SQLite compiled to WebAssembly, runs in-browser.

**Pros:**
- Proper SQL queries in the browser
- FTS5 for full-text search
- Familiar SQL for any filtering logic

**Cons:**
- ~1 MB WASM bundle adds to download and startup time (50–100ms init)
- Worker complexity — SQLite runs in a Web Worker to avoid blocking the main thread
- Overkill when `Array.filter()` on 10K items is sub-millisecond
- More complex build and deployment

### Option 3: DuckDB WASM

Embedded analytical database compiled to WebAssembly.

**Pros:**
- Powerful analytical queries, window functions, Parquet support

**Cons:**
- ~6 MB WASM bundle — larger than the entire song dataset
- Heavy startup cost, complex setup
- Designed for millions of rows, not 10K songs
- Overkill for genre tag filtering

---

## Static site structure

### Option 1: Vite mode in existing src/ui/

Add `--mode static` to the existing UI package. A `.env.static` file sets `VITE_STATIC_MODE=true`. The Vite config swaps the API client via alias.

**Pros:**
- Single `package.json`, shared dependencies, no duplication
- All shared components stay in one place
- Minimal config change — one conditional in vite.config.ts
- Easy to maintain — changes to components apply to both builds automatically

**Cons:**
- Slight complexity in vite.config.ts (mode branching)
- Static-specific code (data loading, HashRouter) lives alongside API code
- Edit/write routes still exist in source (just not linked in static mode)

### Option 2: Separate src/static/ package

New package with its own `package.json`, Vite config, and `index.html`. Copies or symlinks shared components from `src/ui/`.

**Pros:**
- Cleaner separation — no mode branching
- Independent dependencies if needed
- Static-specific routes and components don't pollute the main UI

**Cons:**
- Dependency duplication or monorepo tooling required
- Component sharing is awkward (symlinks break on some platforms, copy-paste diverges)
- Two places to maintain shared types and utilities
- More overhead for a feature that is a strict subset of the main UI

### Option 3: Extract shared component library

Extract shared components into `src/shared/` (or `src/lib/`). Both `src/ui/` and `src/static/` import from shared.

**Pros:**
- Cleanest long-term architecture
- True separation of concerns
- Both builds share a single source of truth for components

**Cons:**
- Significant refactor to extract components from `src/ui/`
- Overkill for an initial implementation — the static build is a view-only subset
- Adds build tooling complexity (monorepo, workspace references)

---

## Static site features

### Included (view/exploration)

| Feature | Notes |
|---------|-------|
| Browse songs | Full list, paginated |
| Genre tag cloud | Stats computed from JSON in browser |
| Genre filtering | AND/OR matching, same URL scheme |
| Artist page | Filtered from JSON |
| Song detail | All metadata displayed |
| Search | Client-side text regex |
| Favourited | Filter from JSON |
| Shuffle | Same hash algorithm, ported to JS |

### Excluded (no backend)

| Feature | Notes |
|---------|-------|
| Edit metadata | View only |
| Write to Apple Music | No backend, no osascript |
| Import scripts | No backend |
| Multi-select edit | View only |
| History tracking | No writes |

### Mobile optimisations (all build targets)

- Larger touch targets for genre tags
- Simplified filter UI (fewer controls visible by default)
- Larger text for club use
- Dark mode (already implemented)
- Service worker for offline caching (static build)

---

## Decisions

See ADRs for full rationale and rejected alternatives:

- **Native app wrapper:** [ADR-0003](../docs/adr/0003-swift-wkwebview-native-app.md) — Swift + WKWebView + Node subprocess
- **Native app database:** [ADR-0004](../docs/adr/0004-nedb-native-app-database.md) — NeDB for initial build, SQLite as future pivot
- **Static site structure:** [ADR-0005](../docs/adr/0005-vite-mode-static-site.md) — Vite `--mode static` in `src/ui/`
- **Static site data:** [ADR-0006](../docs/adr/0006-json-export-static-data.md) — Plain JSON export at build time

---

## Proposed combinations

### Native app: Swift + WKWebView + Node subprocess + NeDB

| Layer | Technology | Notes |
|-------|-----------|-------|
| Shell | Swift / AppKit | WKWebView window, ~200 lines, ~5 MB binary |
| Backend | Node.js subprocess (Express) | Existing API code, bundled in .app/Contents/Resources/ |
| Database | NeDB (`@seald-io/nedb`) | MongoDB-like API, embedded file at `~/.cratecaddy/songs.db` |
| UI | Existing src/ui/ | Loads as-is in webview |

**Why this combo:**
- Right tool for the platform — Swift for macOS, not a cross-platform wrapper
- Node subprocess means zero rewrite of Express routes — your existing API runs as-is
- NeDB's MongoDB-like API makes the migration mechanical (1-2 days), not a rewrite
- The `src/macos/` directory sits alongside `src/api/` and `src/ui/` — separate build target, no fork
- SQLite is the future pivot if the app proves worth investing in (see [SQLite as future pivot](#sqlite-as-future-pivot))

**Build command:** `npm run build:desktop` (builds UI, bundles Node, compiles Swift)

### Static site: Vite mode + JSON export

| Layer | Technology | Notes |
|-------|-----------|-------|
| Structure | Vite `--mode static` in src/ui/ | Shared components, single codebase |
| Data | JSON export at build time | `public/data/songs.json` from MongoDB |
| Client | `staticClient.ts` drop-in | In-memory filtering, ~200 lines |
| Router | HashRouter (conditional) | GitHub Pages compatible |
| Offline | Service worker | Cache-first for club use |

**Why this combo:**
- JSON is the simplest, fastest option for a 10K-song dataset
- Vite mode keeps everything in one package — no duplication, no monorepo
- `staticClient.ts` implements the same function signatures as `client.ts` — hooks don't change
- HashRouter is a one-line conditional in App.tsx

**Build command:** `npm run build:static` (runs export script + `vite build --mode static`)

### Effort estimate

| Target | Effort | Notes |
|--------|--------|-------|
| Static site | Low | Export script + staticClient.ts + config changes |
| Native app (Swift) | Medium | Swift shell (~200 lines) + NeDB migration (1-2 days) |
