# Step 2: Native app (Swift + NeDB)

**Parent:** [20260717a-alternative-build-targets-roadmap.md](./20260717a-alternative-build-targets-roadmap.md)

Self-contained macOS .app with Swift shell, Node subprocess, and NeDB. Replaces the MongoDB workflow.

**Depends on:** Step 1 complete (MongoDB workflow stable before pivoting away from it).

**Decisions:** [ADR-0003](../docs/adr/0003-swift-wkwebview-native-app.md), [ADR-0004](../docs/adr/0004-nedb-native-app-database.md)

---

## Current state

- API uses Mongoose/MongoDB for all data access
- 24 distinct Mongoose operations across `src/api/src/services/songService.ts`
- 3 aggregation pipelines (genre stats, filtered genre stats, shuffle)
- Import scripts (Apple Music, Rekordbox, dJay Pro) all use Mongoose via `songService`
- UI runs on host, API runs on host, MongoDB runs in Docker

---

## Plan

### 1. Create Swift project (src/macos/)

New directory alongside `src/api/` and `src/ui/`:

```
src/macos/
  Package.swift
  Sources/
    CrateCaddy/
      main.swift
      AppDelegate.swift
      WebViewController.swift
      NodeProcessManager.swift
```

**`Package.swift`** — SPM project with AppKit dependency:

```swift
// swift-tools-version: 5.9
import PackageDescription
let package = Package(
  name: "CrateCaddy",
  targets: [
    .executableTarget(
      name: "CrateCaddy",
      path: "Sources/CrateCaddy"
    )
  ]
)
```

### 2. Implement Swift shell (~200 lines)

**`AppDelegate.swift`:**
- Creates `NSApplication`, sets up app delegate
- Configures main menu (File, Edit, View, Window, Help)
- Sets app icon, activates as agent (optional — no Dock icon if desired)

**`WebViewController.swift`:**
- Creates `NSWindow` with title bar, minimum size (800x600)
- Hosts `WKWebView` filling the window
- Loads `http://localhost:{port}` when ready
- Handles window lifecycle (close → quit app)

**`NodeProcessManager.swift`:**
- Spawns Node.js binary as subprocess on app launch
- Waits for the Express server to respond on the health endpoint before loading the webview
- Monitors subprocess — restarts on crash (with backoff)
- Kills subprocess on app termination (`applicationWillTerminate`)
- Logs stdout/stderr to file or console

**Open questions:**
1. **Window vibrancy/transparency:** Should the window use `NSVisualEffectView` for vibrancy? Adds ~30 lines of ObjC bridge code. Deferred to v2 if time-constrained.
2. **Traffic light positioning:** Move traffic lights into the webview content area (like Electron apps)? Requires subclassing `NSWindow` and overriding `contentLayoutRect`. Nice-to-have, not essential.
3. **Single instance:** Should the app enforce single instance (prevent launching two copies)? Tauri has a plugin for this; in Swift it's a `NSRunningApplication` check on launch. Worth doing.

### 3. Migrate data layer from Mongoose to NeDB

This is the main work — ~1-2 days estimated.

**3a. Add NeDB dependency:**

```bash
cd src/api && npm install @seald-io/nedb
```

**3b. Create database module (`src/api/src/database/nedb.ts`):**

```typescript
import Datastore from '@seald-io/nedb';
import path from 'path';
import { app } from 'electron'; // or use userData path resolution

// Resolve data directory: ~/.cratecaddy/ or app.getPath('userData')
const dataDir = process.env.CRATECADDY_DATA_DIR || path.join(os.homedir(), '.cratecaddy');

export const songDb = new Datastore({
  filename: path.join(dataDir, 'songs.db'),
  autoload: true,
});

export const historyDb = new Datastore({
  filename: path.join(dataDir, 'history.db'),
  autoload: true,
});

// Create indexes
songDb.ensureIndex({ fieldName: 'artistTitleNormalized' });
songDb.ensureIndex({ fieldName: 'duration' });
songDb.ensureIndex({ fieldName: 'title' });
songDb.ensureIndex({ fieldName: 'artist' });
songDb.ensureIndex({ fieldName: 'genres' });
songDb.ensureIndex({ fieldName: 'key' });
songDb.ensureIndex({ fieldName: 'canonicalAppleMusicId' });
songDb.ensureIndex({ fieldName: 'appleMusicIds' });

historyDb.ensureIndex({ fieldName: 'songId' });
```

**Open question:** How does the data directory path work when running as a .app bundle vs running in dev? The `.app` bundle should use `app.getPath('userData')` or `~/Library/Application Support/CrateCaddy/`. In dev mode, `~/.cratecaddy/` is simpler. Need a resolution strategy that works for both.

**3c. Rewrite `songService.ts`:**

Replace every Mongoose call with NeDB equivalent. The algorithm doesn't change — just the data access.

| Mongoose | NeDB |
|----------|------|
| `Song.find({}).sort({ createdAt: -1 })` | `songDb.find({}).sort({ createdAt: -1 })` |
| `Song.findById(id)` | `songDb.findOne({ _id: id })` |
| `Song.findOne({ appleMusicIds: id })` | `songDb.findOne({ appleMusicIds: id })` |
| `Song.find({ artistTitleNormalized, duration: {$gte, $lte} })` | `songDb.find({ artistTitleNormalized, duration: {$gte, $lte} })` |
| `Song.countDocuments(filter)` | `songDb.count(filter)` |
| `new Song(data).save()` | `songDb.insert(data)` |
| `song.save()` | `songDb.update({ _id: song._id }, { $set: updates })` |
| `Song.findByIdAndDelete(id)` | `songDb.remove({ _id: id })` |
| `HistoryEntry.find({ songId }).sort(...)` | `historyDb.find({ songId }).sort(...)` |
| `HistoryEntry.findOne({ songId })` | `historyDb.findOne({ songId })` |
| `HistoryEntry.create(data)` | `historyDb.insert(data)` |

**Aggregation rewrites** (3 pipelines):

1. **Genre stats** (~15 lines of JS):
```typescript
async function getGenreStats() {
  const songs = await songDb.find({});
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
```

2. **Filtered genre stats** — same as above with pre-filtered `songDb.find(filter)`.

3. **Shuffle mode** (~25 lines):
```typescript
async function querySongsShuffle(params) {
  const filter = buildSongFilter(params);
  const songs = await songDb.find(filter);
  const seed = params.shuffleSeed || Date.now();
  const hashFn = buildShuffleHashFunction(seed);
  const sorted = songs.sort((a, b) => hashFn(a._id) - hashFn(b._id));
  const paginated = sorted.slice(params.skip, params.skip + params.limit);
  return { data: paginated, total: songs.length, shuffleSeed: seed };
}
```

**3d. Remove Mongoose imports and model files:**

- Delete `src/api/src/models/Song.ts`
- Delete `src/api/src/models/History.ts`
- Remove `mongoose` from `package.json`
- Remove MongoDB connection code from `src/api/src/config/database.ts`
- Replace with NeDB initialization

**3e. Pre-validate hook → explicit normalization:**

Replace the Mongoose pre-validate hook with a function called before every insert/update:

```typescript
function normalizeSongForDb(data: Partial<ISong>): Partial<ISong> {
  if (data.artist && data.title) {
    data.artistTitleNormalized = normalizeArtistTitle(data.artist, data.title);
  }
  if (data.genres) {
    data.genres = normalizeGenres(data.genres);
  }
  return data;
}
```

Call this in `songService.createSong()`, `songService.updateWithHistory()`, and `songService.updateSongMetadata()`.

### 4. Bundle Node binary + API code

**4a. Create a bundled server entry point:**

```typescript
// src/api/src/server-bundled.ts
// Same as server.ts but with NeDB instead of Mongoose
// This is the entry point for the .app bundle
```

**4b. Package Node.js binary:**

Options:
- **Node SEA (Single Executable Application):** Node 20+ feature. Bundle server code into a standalone binary. ~40 MB.
- **`pkg` (deprecated but still works):** Third-party tool. Produces similar result.
- **Ship Node binary + source:** Include the Node binary and source files in the .app bundle. User needs Node installed. Simpler but worse UX.

**Recommended:** Node SEA. Follow the [Node.js SEA docs](https://nodejs.org/docs/latest-v20.x/api/single-executable-applications.html).

**4c. .app bundle structure:**

```
CrateCaddy.app/
  Contents/
    Info.plist
    MacOS/
      CrateCaddy              # Swift binary
    Resources/
      node                     # Node.js SEA binary (~40 MB)
      server.js                # Bundled Express server (from SEA)
      package.json             # Dependencies manifest
      node_modules/            # Pre-installed dependencies
      ui/                      # Built Vite UI (from dist/)
```

**Open question:** Should the Node binary and dependencies be embedded in the Swift binary (via resource embedding) or shipped as loose files in Resources? Loose files are simpler to update but easier to tamper with.

### 5. Build and packaging scripts

**`scripts/build-desktop.sh`:**

```bash
#!/bin/bash
set -e

echo "Building UI..."
cd src/ui && npm run build
cd ../..

echo "Building API..."
cd src/api && npm run build
cd ../..

echo "Bundling Node SEA..."
# Follow Node.js SEA process to create standalone binary
cd src/macos && swift build -c release
cd ../..

echo "Assembling .app bundle..."
# Copy Swift binary, Node binary, API code, UI dist into .app structure

echo "Done: dist/CrateCaddy.app"
```

**`package.json` script:**

```json
"build:desktop": "./scripts/build-desktop.sh"
```

### 6. Mark MongoDB as deprecated

- Add `## DEPRECATED — see native app` header to `docker-compose.yml`
- Add deprecation notice to root `.env` and `.env.example`
- Update README to note the pivot
- Keep all Docker/config files (don't delete)
- Import scripts remain functional (they'll use NeDB after migration)

---

## Gaps / research needed

1. **Swift + Node subprocess communication:** The research discusses localhost HTTP (simplest) vs WKScriptMessageHandler (more native). Start with HTTP. If the port conflict risk is unacceptable, research Unix socket communication.

2. **Node SEA packaging:** The Node.js SEA docs describe the process but it's relatively new. Research the exact steps, test on macOS, verify the resulting binary works. Potential gotchas: native modules (better-sqlite3 if we pivot later), file permissions.

3. **Data directory resolution:** How does the app find `~/.cratecaddy/` in dev mode vs .app bundle mode? The `process.env.CRATECADDY_DATA_DIR` fallback covers dev, but the .app should use a standard macOS location.

4. **Import scripts in .app context:** Import scripts (`import:applemusic`, `import:rekordbox`, `import:djaypro`) currently run as CLI commands against MongoDB. In the NeDB world, they need to run against the same NeDB file. Should they be CLI commands that the user runs separately, or integrated into the app UI? CLI is simpler for v1.

5. **osascript in .app context:** The `writeToAppleMusic` function uses `osascript`. This should work from a .app bundle (osascript is available in the app's PATH), but needs testing. The app may need the `com.apple.security.scripting-targets` entitlement.

6. **Swift learning curve:** The Swift code is ~200 lines, but if neither of us has Swift experience, there's ramp-up time. Consider using a Swift template or starter project.

7. **Testing on different macOS versions:** WKWebView behavior varies across macOS versions. The app should target macOS 13+ (Ventura) for modern WebKit features.

8. **Auto-update:** Should the .app auto-update? Out of scope for v1, but note that Sparkle framework is the standard macOS auto-update library.
