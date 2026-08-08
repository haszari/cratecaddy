# Step 1: Mongo appliance Docker

**Parent:** [20260717a-alternative-build-targets-roadmap.md](./20260717a-alternative-build-targets-roadmap.md)

**Decisions:** [ADR-0007](../docs/adr/0007-api-serves-static-ui-same-origin.md), [ADR-0008](../docs/adr/0008-daemon-mode-launchd-auto-start.md), [ADR-0009](../docs/adr/0009-env-file-config-cratecaddy-env.md), [ADR-0010](../docs/adr/0010-dev-prod-isolation-opaque-volumes.md), [ADR-0011](../docs/adr/0011-mongo-published-loopback-only.md)

Production appliance. No terminals. Starts on OS boot. Open browser to `http://localhost:$API_PORT`.

**Depends on:** Nothing — this is the first step.

**Key constraint:** The API uses `osascript` to write to Apple Music (`src/api/src/services/appleMusicWrite.ts:34`). This only works on the macOS host. **The API cannot run inside Docker.**

---

## Architecture

```
┌──────────────────────────────────────────────┐
│                  macOS host                   │
│                                               │
│  launchd (com.cratecaddy.startup)             │
│    └── cratecaddy start                       │
│          ├── docker compose up -d (MongoDB)   │
│          │     └── port 127.0.0.1:$MONGO_PORT │
│          └── node dist/server.js (API+static) │
│                ├── Express API, port $API_PORT│
│                ├── Serves built static UI at /│
│                └── osascript (Apple Music)    │
│                                               │
└──────────────────────────────────────────────┘
```

Docker runs MongoDB. API runs on the macOS host and serves the built static UI through Express. The `osascript` call for Apple Music integration executes on the host where it has access to macOS scripting.

---

## Configuration

All values configurable: environment target, API port, MongoDB port, log file. Defaults apply when unset. **Prod and dev use deliberately distinct default ports so they never collide on one host.**

| Setting | Prod default | Dev default |
|---|---|---|
| `API_PORT` | `7640` | `7625` (root `.env`) |
| `MONGO_PORT` | `27018` | `27017` (root `.env`) |
| `CRATECADDY_LOG` | `~/.cratecaddy/cratecaddy.log` | — |
| `CRATECADDY_ENV` | `prod` (default) | `dev` (root `.env`) |

Database data is deliberately not user-configurable — it lives in Docker named volumes (see Decisions 11).

- `CRATECADDY_ENV` — `prod` (default) or `dev`; drives the default target for `cratecaddy import` and any command that needs to know which environment it belongs to. Prod sets it in `~/.cratecaddy/config.env`, dev sets it in the root `.env`.

Dev uses Docker Compose's automatic `.env` loading from the project root. Prod values come from `~/.cratecaddy/config.env`, which the CLI sources at startup — the resulting env vars flow into the compose command and the API process.

**Prod/dev isolation.** The two environments are completely separate: distinct compose projects (`cratecaddy-prod` / `cratecaddy-dev` via the `name:` top-level key), distinct containers, distinct volumes, and distinct default ports. Docker Compose never reconciles across projects, so running one environment cannot touch the other's containers.

**LAN exposure (documented, accepted).** The API binds all interfaces with no auth, and the Mongo port is published loopback-only (`127.0.0.1`). On a shared network, other devices could reach the unauthenticated API on `API_PORT` — including the write-to-apple-music endpoint, which runs `osascript` on the host. This is accepted for a single-user home machine; it is not a supported multi-user or internet-facing deployment.

---

## Plan

### 1. API serves static UI

**File:** `src/api/src/server.ts`

Add static file serving after API routes, before the 404 handler. When the `static/` directory exists alongside `server.js` (i.e. in a prod build), Express serves those files at the root URL.

```typescript
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// The API package is ESM ("type": "module"), so `__dirname` is not defined at
// runtime. Derive it from import.meta.url (same pattern as
// src/api/scripts/import-apple-music.ts).
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// After API routes:
const staticPath = path.join(__dirname, 'static');
if (fs.existsSync(staticPath)) {
  app.use(express.static(staticPath));
  // SPA fallback — must come after express.static and API routes
  app.get('*', (req, res) => {
    res.sendFile(path.join(staticPath, 'index.html'));
  });
}
```

Vite's default `base: '/'` produces asset paths relative to root. Express static serves from root. The two match — the built UI works without Vite config changes.

The `fs.existsSync` guard also keeps dev safe: under `tsx watch`, `__dirname` is `src/` and no `src/static` directory exists, so static serving is skipped in dev automatically.

### 2. Prod build script

**File:** `scripts/build-prod.sh`

```bash
#!/bin/bash
set -e

echo "Building UI..."
cd src/ui
npm run build

echo "Building API..."
cd ../api
npm run build

echo "Bundling static UI into API dist..."
mkdir -p dist/static
cp -r ../ui/dist/* dist/static/

echo "Prod build complete: src/api/dist/"
```

### 2a. UI API base URL (port-agnostic)

**Files:** `src/ui/src/api/client.ts` (edit), `src/ui/.env.production` (create)

`client.ts` reads `import.meta.env.VITE_API_URL`, baked at build time. In dev that's `http://localhost:7625` from `src/ui/.env` — correct, because the Vite dev server (7626) and the API (7625) are different origins. But in prod the built UI is served by Express from the **same origin** as the API, so an absolute URL is wrong: a custom `API_PORT` would silently break every API call.

Fix: default to relative URLs, and force `VITE_API_URL` empty for production builds.

```typescript
// src/ui/src/api/client.ts
const API_URL = import.meta.env.VITE_API_URL || '';
```

```bash
# src/ui/.env.production  — used only by `vite build` (mode=production)
VITE_API_URL=
```

Vite loads env files per mode in precedence order `.env` < `.env.local` < `.env.production` < `.env.production.local`, with `process.env` winning over all (verified against Vite's `loadEnv`). An empty `VITE_API_URL` in `.env.production` therefore overrides the dev value from `.env`, so prod builds emit relative `/api/...` requests that resolve on whatever port Express listens on.

### 3. CLI wrapper

**File:** `bin/cratecaddy`

```bash
#!/bin/bash
set -e

# Config — source ~/.cratecaddy/config.env if it exists (dotenv-style KEY=VALUE
# lines, valid shell). Sourcing makes every value visible to this script and to
# the env vars we export into child processes below.
CONFIG="$HOME/.cratecaddy/config.env"
[ -f "$CONFIG" ] && . "$CONFIG"

# Prod defaults are deliberately distinct from the dev defaults (dev: API 7625,
# Mongo 27017 from the root .env / README). Prod runs on its own ports so the
# two environments never collide on one host.
API_PORT="${API_PORT:-7640}"
MONGO_PORT="${MONGO_PORT:-27018}"
MONGO_CONTAINER="cratecaddy-mongodb-prod"
LOG_FILE="${CRATECADDY_LOG:-$HOME/.cratecaddy/cratecaddy.log}"
PID_FILE="$HOME/.cratecaddy/api.pid"

# The CLI is installed as a symlink (/usr/local/bin/cratecaddy →
# ~/cratecaddy/bin/cratecaddy), so $0 alone would resolve to the shortcut's
# directory, not the real script. Follow the symlink chain to the real file
# (BSD readlink has no -f, hence the loop) before computing SCRIPT_DIR.
resolve_script() {
  local source="$1"
  while [ -L "$source" ]; do
    local dir target
    dir="$(cd -P "$(dirname "$source")" && pwd)"
    target="$(readlink "$source")"
    case "$target" in
      /*) source="$target" ;;
      *)  source="$dir/$target" ;;
    esac
  done
  echo "$source"
}

REAL_SCRIPT="$(resolve_script "$0")"
SCRIPT_DIR="$(cd -P "$(dirname "$REAL_SCRIPT")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

start_mongodb() {
  # At OS boot, launchd may fire `cratecaddy start` before Docker Desktop is up.
  # Wait for the daemon (bounded) instead of failing instantly under set -e.
  echo "Waiting for Docker..."
  local dtries=0
  until docker info > /dev/null 2>&1; do
    dtries=$((dtries + 1))
    if [ "$dtries" -ge 60 ]; then
      echo "ERROR: Docker daemon is not reachable after 60s. Start Docker and re-run." >&2
      exit 1
    fi
    sleep 1
  done
  # `docker compose up -d` is idempotent: if the container is already up it
  # prints "running" and exits 0, so no separate already-running guard is needed.
  docker compose -f "$PROJECT_DIR/docker-compose.yml" -f "$PROJECT_DIR/docker-compose.prod.yml" up -d
  echo "Waiting for MongoDB..."
  # mongosh runs inside the container (it ships with mongo:7.0), so no host
  # mongosh prerequisite. Port inside the container is always 27017 — the host
  # mapping is external. Give up after 60s so a dead Docker daemon fails the
  # command instead of hanging forever.
  local tries=0
  until docker exec "$MONGO_CONTAINER" mongosh --quiet --port 27017 --eval 'db.runCommand("ping").ok' > /dev/null 2>&1; do
    tries=$((tries + 1))
    if [ "$tries" -ge 60 ]; then
      echo "ERROR: MongoDB did not become ready within 60s. Is Docker running?" >&2
      exit 1
    fi
    sleep 1
  done
  echo "MongoDB ready on port $MONGO_PORT."
}

start_api() {
  cd "$PROJECT_DIR/src/api"
  # Export the resolved prod config into the Node process. server.ts skips
  # dotenv.config() when NODE_ENV=production, so the repo .env (dev config) is
  # never read into the prod API.
  export NODE_ENV=production
  export API_PORT
  export MONGODB_URI="mongodb://127.0.0.1:${MONGO_PORT}/cratecaddy"
  nohup node dist/server.js > "$LOG_FILE" 2>&1 &
  echo $! > "$PID_FILE"
  echo "API started on port $API_PORT (PID: $(cat $PID_FILE))"
}

stop_api() {
  if [ -f "$PID_FILE" ]; then
    kill "$(cat "$PID_FILE")" 2>/dev/null || true
    rm -f "$PID_FILE"
  fi
}

case "${1:-}" in
  start)
    if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
      echo "CrateCaddy is already running on port $API_PORT."
      exit 0
    fi
    mkdir -p "$(dirname "$LOG_FILE")"
    start_mongodb
    start_api
    echo ""
    echo "CrateCaddy is running: http://localhost:$API_PORT"
    ;;
  stop)
    stop_api
    docker compose -f "$PROJECT_DIR/docker-compose.yml" -f "$PROJECT_DIR/docker-compose.prod.yml" down 2>/dev/null || true
    echo "CrateCaddy stopped."
    ;;
  restart)
    stop_api
    docker compose -f "$PROJECT_DIR/docker-compose.yml" -f "$PROJECT_DIR/docker-compose.prod.yml" down 2>/dev/null || true
    sleep 1
    mkdir -p "$(dirname "$LOG_FILE")"
    start_mongodb
    start_api
    echo ""
    echo "CrateCaddy restarted: http://localhost:$API_PORT"
    ;;
  status)
    if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
      echo "CrateCaddy is running on port $API_PORT (PID: $(cat $PID_FILE))"
    else
      echo "CrateCaddy is not running."
      rm -f "$PID_FILE" 2>/dev/null
    fi
    ;;
  logs)
    tail -f "$LOG_FILE"
    ;;
  import)
    # Consume the "import" subcommand word so $1 becomes the first real arg.
    shift
    # Target environment. Explicit positional arg wins; otherwise the
    # CRATECADDY_ENV prop from config (prod for the installed daemon).
    ENV_TARGET="${CRATECADDY_ENV:-prod}"
    case "${1:-}" in
      prod|dev)
        ENV_TARGET="$1"
        shift
        ;;
      *)
        : # $1 is the file path, not an env target
        ;;
    esac
    # Load the target env's config, then export MONGODB_URI so the host-side
    # import script (which reads process.env.MONGODB_URI, default localhost:27017)
    # connects to the right database on the right port. The URI is always derived
    # from the resolved MONGO_PORT — never trusted from the config file — so the
    # port and the URI cannot drift apart.
    if [ "$ENV_TARGET" = "dev" ]; then
      # Dev defaults independently of prod config (which was sourced at the top):
      # .env may override these, but a missing value must NOT inherit prod's.
      API_PORT=7625
      MONGO_PORT=27017
      [ -f "$PROJECT_DIR/.env" ] && . "$PROJECT_DIR/.env"
    fi
    export MONGODB_URI="mongodb://127.0.0.1:${MONGO_PORT}/cratecaddy"
    # Debug line: shows the target so a wrong-environment whoops can be Ctrl-C'd.
    echo "Importing to $ENV_TARGET ($MONGODB_URI)..."
    cd "$PROJECT_DIR/src/api"
    npm run import:applemusic "$@"
    ;;
  install)
    # REAL_SCRIPT is the symlink-resolved path computed at startup, so the plist
    # references the actual file, not the /usr/local/bin symlink. Auto-start then
    # survives the shortcut being removed.
    CLI_PATH="$REAL_SCRIPT"
    # Bake the resolved CLI path and log file path into the plist. The installed
    # copy is frozen config — changing config.env afterwards does not rewrite it;
    # re-run `install` to regenerate.
    sed -e "s|__CRATECADDY_CLI_PATH__|$CLI_PATH|" \
        -e "s|__CRATECADDY_LOG_FILE__|$LOG_FILE|" \
      "$PROJECT_DIR/macos/com.cratecaddy.startup.plist" \
      > ~/Library/LaunchAgents/com.cratecaddy.startup.plist
    launchctl load ~/Library/LaunchAgents/com.cratecaddy.startup.plist
    echo "Auto-start enabled. CrateCaddy will start on boot."
    ;;
  uninstall)
    launchctl unload ~/Library/LaunchAgents/com.cratecaddy.startup.plist 2>/dev/null || true
    rm -f ~/Library/LaunchAgents/com.cratecaddy.startup.plist
    stop_api
    docker compose -f "$PROJECT_DIR/docker-compose.yml" -f "$PROJECT_DIR/docker-compose.prod.yml" down 2>/dev/null || true
    echo "CrateCaddy uninstalled."
    ;;
  *)
    echo "CrateCaddy — music metadata explorer"
    echo ""
    echo "Usage: cratecaddy <command>"
    echo ""
    echo "Commands:"
    echo "  start             Start CrateCaddy (MongoDB + API)"
    echo "  stop              Stop all services"
    echo "  restart           Restart all services"
    echo "  status            Check if CrateCaddy is running"
    echo "  logs              Tail API log file"
    echo "  import <path>     Import from Apple Music XML"
    echo "  install           Enable auto-start on boot"
    echo "  uninstall         Remove auto-start and stop services"
    ;;
esac
```

### 4. macOS launchd plist template — auto-start on boot

**File:** `macos/com.cratecaddy.startup.plist` (template)

This is a **template file** — it contains substitution placeholders (`__CRATECADDY_CLI_PATH__`, `__CRATECADDY_LOG_FILE__`) that get resolved at install time. The `install` CLI command runs `sed` to replace them with the actual CLI path and the resolved log file path, writing the result to `~/Library/LaunchAgents/`. The installed plist is then **frozen config**: changing `config.env` afterwards does not retroactively rewrite it, and we don't support editing the installed copy — re-run `install` if you need to regenerate it.

launchd inherits `/usr/bin:/bin:/usr/sbin:/sbin`. The plist uses an absolute path to the CLI to avoid PATH resolution issues.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.cratecaddy.startup</string>
    <key>ProgramArguments</key>
    <array>
        <string>__CRATECADDY_CLI_PATH__</string>
        <string>start</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <false/>
    <key>StandardOutPath</key>
    <string>__CRATECADDY_LOG_FILE__</string>
    <key>StandardErrorPath</key>
    <string>__CRATECADDY_LOG_FILE__</string>
</dict>
</plist>
```

### 5. Installation

**Prerequisites:** macOS, Docker Desktop (or OrbStack/Colima), Node.js 20+

```bash
# 1. Clone the repo
git clone <repo-url> ~/cratecaddy
cd ~/cratecaddy

# 2. Install dependencies
npm install --prefix src/api
npm install --prefix src/ui

# 3. Build for production
./scripts/build-prod.sh

# 4. Link CLI globally
ln -s ~/cratecaddy/bin/cratecaddy /usr/local/bin/cratecaddy

# 5. Start
cratecaddy start

# 6. Open http://localhost:$API_PORT
```

**Customisation:** Create `~/.cratecaddy/config.env` and edit. All values have defaults (see Configuration section above).

**Auto-start on boot:**

```bash
cratecaddy install    # installs launchd plist
cratecaddy uninstall  # removes it
```

After OS boot, CrateCaddy starts automatically. Open browser to `http://localhost:$API_PORT`.

### 6. Dev workflow — isolated from prod

Prod and dev use separate MongoDB instances, separate ports, separate data volumes. Dev gets its values from `.env` in the project root (Docker Compose auto-loads it). Prod gets its values from `~/.cratecaddy/config.env`, sourced by the CLI at startup.

| | Prod | Dev |
|---|---|---|
| Environment | `CRATECADDY_ENV=prod` (config.env) | `CRATECADDY_ENV=dev` (root `.env`) |
| MongoDB port | `MONGO_PORT` from config.env (default `27018`) | `MONGO_PORT` from `.env` (default `27017`) |
| API port | `API_PORT` from config.env (default `7640`) | `API_PORT` from `.env` (default `7625`) |
| Compose project | `cratecaddy-prod` | `cratecaddy-dev` |
| Data volume | `cratecaddy-mongo-data-prod` | `cratecaddy-mongo-data-dev` |
| MongoDB container | `cratecaddy-mongodb-prod` | `cratecaddy-mongodb-dev` |
| Compose | `docker-compose.yml` + `docker-compose.prod.yml` | `docker-compose.yml` only |

Dev uses the base `docker-compose.yml` directly — no override file. The base file interpolates `${MONGO_PORT:-27017}`, prod's override `${MONGO_PORT:-27018}`, so each environment defaults to its own port and the two never collide — no manual `MONGODB_URI` syncing required. The CLI derives the URI from `MONGO_PORT` for every import, and the import's dev branch resets to dev defaults before sourcing the root `.env` so a missing dev value never inherits prod's config.

```bash
docker compose up -d
```

To test the prod build locally: build, then run with the prod compose override.

```bash
./scripts/build-prod.sh
cratecaddy start
```

This runs the full prod stack locally on the prod-configured ports.

### 7. Import flow

Import scripts run on the macOS host. The `import` command targets an environment explicitly — the target defaults to the `CRATECADDY_ENV` prop from config (`prod` for the installed daemon), and can be overridden per-invocation:

```bash
cratecaddy import /path/to/library.xml     # default target = CRATECADDY_ENV from config.env (prod)
cratecaddy import prod /path/to/library.xml  # explicit prod
cratecaddy import dev /path/to/library.xml   # explicit dev (uses root .env config)
```

Each target loads its own config — `~/.cratecaddy/config.env` for prod, root `.env` for dev — and the CLI exports `MONGODB_URI` (`mongodb://127.0.0.1:${MONGO_PORT}/cratecaddy`) into `npm run import:applemusic` so the import lands in the right database on the right port.

The command prints the resolved target and URI first — `Importing to prod (mongodb://127.0.0.1:27018/cratecaddy)...` — so a wrong-environment import can be stopped with Ctrl-C before the script runs.

**Accepted risk:** the prod-installed CLI can target dev (and vice-versa). This is useful for debugging, and manageable with care — the debug line is the safety net.

### 8. Update docker-compose.yml (dev)

The base file is shared by both envs; the prod override renames what it needs. Dev container/volume get the `-dev` suffix so dev and prod never collide. Both files declare a top-level `name:` — Docker Compose merges the two `-f` files, and the override's `name:` wins, giving prod its own project (`cratecaddy-prod`). Dev, using the base alone, gets `cratecaddy-dev`. Separate projects means compose never reconciles the two environments as one stack, so dev and prod containers/volumes are fully independent.

```yaml
# docker-compose.yml
name: cratecaddy-dev
services:
  mongodb:
    image: mongo:7.0
    container_name: cratecaddy-mongodb-dev
    ports:
      - "127.0.0.1:${MONGO_PORT:-27017}:27017"
    environment:
      MONGO_INITDB_DATABASE: cratecaddy
    volumes:
      - cratecaddy-mongo-data-dev:/data/db
    healthcheck:
      test: echo 'db.runCommand("ping").ok' | mongosh localhost:27017/test --quiet
      interval: 5s
      timeout: 10s
      retries: 5

volumes:
  cratecaddy-mongo-data-dev:
```

### 9. Add docker-compose.prod.yml

Production override file. Docker's recommended pattern: base `docker-compose.yml` for shared config, `docker-compose.prod.yml` for production-specific settings.

```yaml
# docker-compose.prod.yml
name: cratecaddy-prod
services:
  mongodb:
    container_name: cratecaddy-mongodb-prod
    # !override REPLACES the base file's port list instead of appending to it —
    # compose merges `ports` by appending, so without it prod would publish BOTH
    # the dev (27017) and prod (27018) mappings and collide with dev Mongo.
    ports: !override
      - "127.0.0.1:${MONGO_PORT:-27018}:27017"
    volumes:
      - cratecaddy-mongo-data-prod:/data/db
    restart: unless-stopped

volumes:
  cratecaddy-mongo-data-prod:
```

The prod CLI uses `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d`. Dev uses the base `docker-compose.yml` directly — no override file.

**Loopback-only publishing (both envs).** Both compose files bind the published port to `127.0.0.1` (`127.0.0.1:${MONGO_PORT}:27017`). The API and import scripts connect via `127.0.0.1`, so this changes nothing for local use — it only prevents LAN devices from reaching the unauthenticated MongoDB. If remote access is ever needed, this is the deliberate line to change.

To test the prod build locally: run `./scripts/build-prod.sh`, then `MONGO_PORT=27018 docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d`. The prod MongoDB runs on a different port, the API serves the built static UI. This lets a developer verify the prod build without installing on another machine.

---

## Files

| File | Action | Purpose |
|------|--------|---------|
| `src/api/src/server.ts` | Edit | Add static file serving + SPA fallback |
| `src/ui/src/api/client.ts` | Edit | Relative API base URL (`|| ''`) |
| `src/ui/.env.production` | Create | Empty `VITE_API_URL` for port-agnostic prod builds |
| `src/api/Dockerfile` | Delete | Defined but never referenced by compose or scripts |
| `bin/cratecaddy` | Create | CLI wrapper |
| `scripts/build-prod.sh` | Create | Build UI + API + bundle static files |
| `macos/com.cratecaddy.startup.plist` | Create | launchd template (contains `__CRATECADDY_CLI_PATH__` and `__CRATECADDY_LOG_FILE__` placeholders) |
| `~/.cratecaddy/config.env` | Create (user) | Environment (`CRATECADDY_ENV`), ports, log file |
| `docker-compose.prod.yml` | Create | Production override: `name: cratecaddy-prod`, container name, ports (default `27018`), volumes, restart |
| `docker-compose.yml` | Edit | `name: cratecaddy-dev`, `-dev` container/volume suffix, loopback-only port binding, `MONGO_PORT` interpolation |

---

## Decisions

1. **Docker for MongoDB.** API runs on the macOS host where `osascript` is available for Apple Music integration.

2. **API serves static UI.** Express serves the built UI at root. Vite's default `base: '/'` produces asset paths that resolve correctly from Express static.

3. **Daemon mode.** `cratecaddy start` runs the API in the background via `nohup`. A PID file at `~/.cratecaddy/api.pid` tracks the process.

4. **PID file for process management.** Written by `start`, read by `stop`/`status`, cleaned up on stop.

5. **launchd template with absolute path.** The plist is a template file with a `__CRATECADDY_CLI_PATH__` placeholder. The `install` command resolves it via `sed` with the script's **real path** (symlinks followed via `resolve_script`) and writes the result to `~/Library/LaunchAgents/`. The CLI itself also resolves its own symlink before deriving `PROJECT_DIR`, so it works whether invoked as `cratecaddy` (symlink) or directly.

6. **POSIX dot-directory.** `~/.cratecaddy/` stores config, logs, and the PID file.

7. **All ports configurable.** `API_PORT` and `MONGO_PORT` in `~/.cratecaddy/config.env`.

8. **Clone, build, link.** Installation is a git clone, npm install, build, and symlink. Prerequisites: Docker, Node.js, macOS.

9. **Auto-start on boot.** `cratecaddy install` sets up the launchd plist. CrateCaddy starts on OS boot.

10. **Dev and prod are isolated.** Separate compose projects (`name: cratecaddy-dev` / `name: cratecaddy-prod`), separate MongoDB containers, separate ports, separate data volumes. Dev uses `.env` auto-loaded by Docker Compose. Prod uses a separate env file passed by the CLI. Distinct default ports (prod API `7640` / Mongo `27018`, dev API `7625` / Mongo `27017`) plus separate compose projects mean both can run simultaneously without compose ever reconciling them as one stack.

11. **MongoDB data is opaque Docker state.** Both envs use named volumes (`cratecaddy-mongo-data-dev` / `cratecaddy-mongo-data-prod`); there is no host-visible data folder and no `CRATECADDY_DATA` config. Data is managed with `docker volume` operations, and the documented restore path is `cratecaddy import`.

---

## Resolved research

1. **launchd does not restart a process that exits when `KeepAlive` is false.** With `RunAtLoad: true` and `KeepAlive: false` (both defaults in our plist), launchd runs the command once at load time. If the command exits, launchd does not restart it — it considers the job done. The `cratecaddy start` command spawns the background API via `nohup`, then exits cleanly. launchd sees the exit and moves on. No crash interpretation, no restart loop.

2. **MongoDB data lives in Docker named volumes, not a host folder.** An earlier draft exposed the data at a host path (`~/.cratecaddy/data`) via a bind mount and a `CRATECADDY_DATA` config knob. For an appliance this is a mis-feature: the data is opaque Mongo state (WiredTiger files) that a human can't read, so surfacing it only invites confusion and a dead config option. Both envs use suffixed named volumes instead; the container owns the state and restore goes through `cratecaddy import` or `docker volume` operations.
