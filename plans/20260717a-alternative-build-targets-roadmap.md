# Alternative build targets roadmap

Three-step roadmap for CrateCaddy build targets. Each step builds on the previous — sub-plans assume the sequence.

**Decisions captured in ADRs:**
- [ADR-0003: Swift + WKWebView](../docs/adr/0003-swift-wkwebview-native-app.md)
- [ADR-0004: NeDB for native app](../docs/adr/0004-nedb-native-app-database.md)
- [ADR-0005: Vite mode for static site](../docs/adr/0005-vite-mode-static-site.md)
- [ADR-0006: JSON export for static data](../docs/adr/0006-json-export-static-data.md)

**Full analysis:** [20260715-alternative-build-targets.md](./20260715-alternative-build-targets.md)

---

## Step 1: Mongo appliance Docker — human reviewed

**Goal:** Production appliance. No terminals. Starts on OS boot. Open browser to app.

**Sub-plan:** [20260717b-mongo-appliance-docker.md](./20260717b-mongo-appliance-docker.md)

**Scope:**
- CLI wrapper (`cratecaddy start/stop/restart/status/logs/import/install/uninstall`)
- API serves built static UI via Express
- Prod build script (UI → API dist/static/)
- macOS launchd plist for auto-start on login
- Dev/prod isolation (separate MongoDB containers, ports, data dirs)
- Config file (`~/.cratecaddy/config.env`) for ports, data dir, log path

**Key constraint:** API runs on macOS host (`osascript` for Apple Music). Docker is for MongoDB only.

**Exit criteria:** `cratecaddy start` starts everything. Auto-starts on login. Open `http://localhost:7625`.

---

## Step 2: Native app (Swift + NeDB) — early draft

**Goal:** Self-contained macOS .app with Swift shell, Node subprocess, and NeDB. Replaces the MongoDB workflow.

**Sub-plan:** [20260717c-native-app-swift-nedb.md](./20260717c-native-app-swift-nedb.md)

**Scope:**
- Swift/AppKit shell with WKWebView (src/macos/)
- Node subprocess lifecycle management
- Migrate data layer from Mongoose/MongoDB to NeDB
- Bundle Node binary + API code into .app
- Build and packaging scripts
- Mark MongoDB config as deprecated (not deleted)

**Pivot:** MongoDB/Docker workflow from Step 1 is deprecated. The native app replaces it. Docker config and compose files remain but are unmaintained.

**Exit criteria:** `npm run build:desktop` produces a .app that launches, shows the UI, and serves data from NeDB.

---

## Step 3: Static site — early draft

**Goal:** Build-time static site with configurable song list, deployable to GitHub Pages.

**Sub-plan:** [20260717d-static-site-build.md](./20260717d-static-site-build.md)

**Scope:**
- Export script: queries MongoDB, writes filtered JSON at build time
- Configurable song filter (e.g. grouping=DJ, or custom query)
- staticClient.ts: in-memory filtering replacing API calls
- Vite mode config for static build
- HashRouter for static hosting
- GitHub Pages deploy commands
- Service worker for offline use (club DJ use case)

**Depends on Step 1** for the export script to query MongoDB. Could also work standalone if MongoDB is running locally.

**Exit criteria:** `npm run build:static` produces a deployable site. Pushes to a GitHub Pages branch or custom endpoint.

---

## Sequencing

```
Step 1: Mongo appliance     ← current state improvement, no breaking changes
    ↓
Step 2: Native app          ← pivot, deprecates MongoDB workflow
    ↓
Step 3: Static site         ← independent build target, can use either MongoDB or NeDB data
```

Steps 2 and 3 are independent of each other — the static site can work with either data source. But both benefit from Step 1 being done first (clean MongoDB setup for the export script).

---

## Effort estimate

| Step | Effort | Risk |
|------|--------|------|
| 1. Mongo appliance | Small | Low — Docker config, launchd, documentation |
| 2. Native app | Large | Medium — Swift shell + NeDB migration |
| 3. Static site | Medium | Low — well-understood patterns, JSON + Vite |
