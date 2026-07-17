# Step 1: Mongo appliance Docker

**Parent:** [20260717a-alternative-build-targets-roadmap.md](./20260717a-alternative-build-targets-roadmap.md)

Production appliance. No terminals. Starts on OS boot. Open browser to `http://localhost:$CRATECADDY_PORT`.

**Depends on:** Nothing — this is the first step.

**Key constraint:** The API uses `osascript` to write to Apple Music (`src/api/src/services/appleMusicWrite.ts:34`). This only works on the macOS host. **The API cannot run inside Docker.**

---

## Architecture

```
┌──────────────────────────────────────────────────────┐
│                     macOS host                        │
│                                                       │
│  launchd (com.cratecaddy.startup)                     │
│    └── cratecaddy start                               │
│          ├── docker run ... (MongoDB container)       │
│          │     └── port $MONGO_PORT                   │
│          └── node api/dist/server.js (API + static UI)│
│                ├── Express API, port $CRATECADDY_PORT │
│                ├── Serves built static UI at /        │
│                └── osascript (Apple Music write)      │
│                                                       │
└──────────────────────────────────────────────────────┘
```

Docker runs MongoDB. API runs on the macOS host and serves the built static UI through Express. The `osascript` call for Apple Music integration executes on the host where it has access to macOS scripting.

---

## Configuration

All values configurable: API port, MongoDB port, data directory, log file. Defaults apply when unset.

Dev uses Docker Compose's automatic `.env` loading from the project root. Prod uses a separate env file (`~/.cratecaddy/config.env`) passed by the CLI via `--env-file`.

---

## Plan

### 1. API serves static UI

**File:** `src/api/src/server.ts`

Add static file serving after API routes, before the 404 handler. When the `static/` directory exists alongside `server.js` (i.e. in a prod build), Express serves those files at the root URL.

```typescript
import path from 'path';
import fs from 'fs';

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

### 3. CLI wrapper

**File:** `bin/cratecaddy`

```bash
#!/bin/bash
set -e

# Config
CONFIG="$HOME/.cratecaddy/config.env"
PORT="${CRATECADDY_PORT:-7625}"
MONGO_PORT="${MONGO_PORT:-27017}"
DATA_DIR="${CRATECADDY_DATA:-$HOME/.cratecaddy/data}"
LOG_FILE="${CRATECADDY_LOG:-$HOME/.cratecaddy/cratecaddy.log}"
PID_FILE="$HOME/.cratecaddy/api.pid"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Docker Compose with prod env file (if it exists)
COMPOSE_CMD=(docker compose -f "$PROJECT_DIR/docker-compose.yml" -f "$PROJECT_DIR/docker-compose.prod.yml")
[ -f "$CONFIG" ] && COMPOSE_CMD+=(--env-file "$CONFIG")

start_mongodb() {
  # Check if already running on this port
  if docker ps --format '{{.Ports}}' | grep -q ":${MONGO_PORT}->"; then
    echo "MongoDB already running on port $MONGO_PORT."
    return
  fi
  docker compose -f "$PROJECT_DIR/docker-compose.yml" -f "$PROJECT_DIR/docker-compose.prod.yml" up -d
  echo "Waiting for MongoDB..."
  until mongosh --quiet --port "$MONGO_PORT" --eval 'db.runCommand("ping").ok' > /dev/null 2>&1; do
    sleep 1
  done
  echo "MongoDB ready on port $MONGO_PORT."
}

start_api() {
  cd "$PROJECT_DIR/src/api"
  nohup node dist/server.js > "$LOG_FILE" 2>&1 &
  echo $! > "$PID_FILE"
  echo "API started on port $PORT (PID: $(cat $PID_FILE))"
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
      echo "CrateCaddy is already running on port $PORT."
      exit 0
    fi
    mkdir -p "$DATA_DIR" "$(dirname "$LOG_FILE")"
    start_mongodb
    start_api
    echo ""
    echo "CrateCaddy is running: http://localhost:$PORT"
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
    mkdir -p "$DATA_DIR" "$(dirname "$LOG_FILE")"
    start_mongodb
    start_api
    echo ""
    echo "CrateCaddy restarted: http://localhost:$PORT"
    ;;
  status)
    if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
      echo "CrateCaddy is running on port $PORT (PID: $(cat $PID_FILE))"
    else
      echo "CrateCaddy is not running."
      rm -f "$PID_FILE" 2>/dev/null
    fi
    ;;
  logs)
    tail -f "$LOG_FILE"
    ;;
  import)
    shift
    cd "$PROJECT_DIR/src/api"
    npm run import:applemusic "$@"
    ;;
  install)
    CLI_PATH="$(which cratecaddy)"
    sed "s|__CRATECADDY_CLI_PATH__|$CLI_PATH|" \
      "$PROJECT_DIR/macos/com.cratecaddy.startup.plist" \
      > ~/Library/LaunchAgents/com.cratecaddy.startup.plist
    launchctl load ~/Library/LaunchAgents/com.cratecaddy.startup.plist
    echo "Auto-start enabled. CrateCaddy will start on login."
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
    echo "  install           Enable auto-start on login"
    echo "  uninstall         Remove auto-start and stop services"
    ;;
esac
```

### 4. macOS launchd plist template — auto-start on login

**File:** `macos/com.cratecaddy.startup.plist` (template)

This is a **template file** — it contains a substitution placeholder (`__CRATECADDY_CLI_PATH__`) that gets resolved at install time. The `install` CLI command runs `sed` to replace the placeholder with the actual CLI path and writes the result to `~/Library/LaunchAgents/`.

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
    <string>/tmp/cratecaddy-startup.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/cratecaddy-startup.log</string>
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

# 6. Open http://localhost:$CRATECADDY_PORT
```

**Customisation:** Create `~/.cratecaddy/config.env` and edit. All values have defaults (see Configuration section above).

**Auto-start on login:**

```bash
cratecaddy install    # installs launchd plist
cratecaddy uninstall  # removes it
```

After OS boot, CrateCaddy starts automatically. Open browser to `http://localhost:$CRATECADDY_PORT`.

### 6. Dev workflow — isolated from prod

Prod and dev use separate MongoDB instances, separate ports, separate data directories. Dev gets its values from `.env` in the project root (Docker Compose auto-loads it). Prod gets its values from `~/.cratecaddy/config.env` (CLI passes via `--env-file`).

| | Prod | Dev |
|---|---|---|
| MongoDB port | `MONGO_PORT` from prod env file | `MONGO_PORT` from `.env` |
| API port | `CRATECADDY_PORT` from prod env file | Same — Vite proxy handles it |
| Data dir | `CRATECADDY_DATA` from prod env file | Docker volume (default) |
| MongoDB container | `cratecaddy-mongodb` | `cratecaddy-mongodb-dev` |
| Compose | `docker-compose.yml` + `docker-compose.prod.yml` | `docker-compose.yml` only |

Dev uses the base `docker-compose.yml` directly — no override file. Set different `MONGO_PORT` in `.env` so dev and prod MongoDB don't compete for the same port.

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

Import scripts run on the macOS host. They connect to the prod MongoDB container on `localhost:$MONGO_PORT` (from the prod env file).

```bash
cratecaddy import /path/to/library.xml
```

This calls `npm run import:applemusic` in `src/api/`, which connects to `mongodb://localhost:${MONGO_PORT}/cratecaddy`.

### Optional: Clean up docker-compose.yml

The existing `docker-compose.yml` defines three services: `mongodb`, `api`, `ui`. The `api` and `ui` services are defined but never used. They can be removed to reduce confusion. This is not required for the plan to work — Docker Compose ignores services that aren't explicitly started.

### Add docker-compose.prod.yml

Production override file. Docker's recommended pattern: base `docker-compose.yml` for shared config, `docker-compose.prod.yml` for production-specific settings.

```yaml
# docker-compose.prod.yml
services:
  mongodb:
    container_name: cratecaddy-mongodb
    ports:
      - "${MONGO_PORT:-27017}:27017"
    volumes:
      - cratecaddy_mongo_data:/data/db
    restart: unless-stopped

volumes:
  cratecaddy_mongo_data:
```

The prod CLI uses `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d`. Dev uses the base `docker-compose.yml` directly — no override file.

To test the prod build locally: run `./scripts/build-prod.sh`, then `MONGO_PORT=27018 docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d`. The prod MongoDB runs on a different port, the API serves the built static UI. This lets a developer verify the prod build without installing on another machine.

---

## Files

| File | Action | Purpose |
|------|--------|---------|
| `src/api/src/server.ts` | Edit | Add static file serving + SPA fallback |
| `src/api/Dockerfile` | Delete | Defined but never referenced by compose or scripts |
| `bin/cratecaddy` | Create | CLI wrapper |
| `scripts/build-prod.sh` | Create | Build UI + API + bundle static files |
| `macos/com.cratecaddy.startup.plist` | Create | launchd template (contains `__CRATECADDY_CLI_PATH__` placeholder) |
| `~/.cratecaddy/config.env` | Create (user) | Ports, data dir, log file |
| `docker-compose.prod.yml` | Create | Production override: container name, ports, volumes, restart |
| `docker-compose.yml` | Edit (optional) | Remove unused `api` and `ui` services |

---

## Decisions

1. **Docker for MongoDB.** API runs on the macOS host where `osascript` is available for Apple Music integration.

2. **API serves static UI.** Express serves the built UI at root. Vite's default `base: '/'` produces asset paths that resolve correctly from Express static.

3. **Daemon mode.** `cratecaddy start` runs the API in the background via `nohup`. A PID file at `~/.cratecaddy/api.pid` tracks the process.

4. **PID file for process management.** Written by `start`, read by `stop`/`status`, cleaned up on stop.

5. **launchd template with absolute path.** The plist is a template file with a `__CRATECADDY_CLI_PATH__` placeholder. The `install` command resolves it via `sed` (replacing with the output of `which cratecaddy`) and writes the result to `~/Library/LaunchAgents/`.

6. **POSIX dot-directory.** `~/.cratecaddy/` stores config, data, logs, and the PID file.

7. **All ports configurable.** `CRATECADDY_PORT` and `MONGO_PORT` in `~/.cratecaddy/config.env`.

8. **Clone, build, link.** Installation is a git clone, npm install, build, and symlink. Prerequisites: Docker, Node.js, macOS.

9. **Auto-start on login.** `cratecaddy install` sets up the launchd plist. CrateCaddy starts on OS boot.

10. **Dev and prod are isolated.** Separate MongoDB containers, separate ports, separate data directories. Dev uses `.env` auto-loaded by Docker Compose. Prod uses a separate env file passed by the CLI. Both can run simultaneously.

---

## Resolved research

1. **launchd does not restart a process that exits when `KeepAlive` is false.** With `RunAtLoad: true` and `KeepAlive: false` (both defaults in our plist), launchd runs the command once at load time. If the command exits, launchd does not restart it — it considers the job done. The `cratecaddy start` command spawns the background API via `nohup`, then exits cleanly. launchd sees the exit and moves on. No crash interpretation, no restart loop.

2. **Docker Compose expands `~` on the host side.** Volume source paths with `~` are expanded to the user's home directory by the Docker Compose client on the host. However, this has edge cases with remote daemons and older Compose versions. The compose file will use `${HOME}` instead of `~` for reliability: `${CRATECADDY_DATA:-${HOME}/.cratecaddy/data}`.
