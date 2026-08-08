# Crate Caddy appliance (prod build)

Runs Crate Caddy as a self-contained service on your Mac: a MongoDB container (Docker) plus the built API server (Node, serving the UI). Managed by a single `cratecaddy` command, optionally auto-started on boot via launchd.

This is the **production** setup. It uses its own ports and data, so it runs alongside the dev workflow without touching it.

## What it does to your system

Installing the appliance creates these things on your machine:

- `~/.cratecaddy/` — runtime directory: config (`config.env`), API log, API PID file
- `cratecaddy-mongodb-prod` — a Docker container running MongoDB 7.0
- `cratecaddy-mongo-data-prod` — a named Docker volume holding all prod data (deleting the container does not delete your data)
- `com.cratecaddy.startup` — a launchd agent (only if you run `cratecaddy install`) that starts the appliance on boot
- `/usr/local/bin/cratecaddy` — a symlink to the CLI script (from the install step below)

None of this touches your dev database, containers, or `.env` files — prod uses separate ports (`API_PORT` 7640, `MONGO_PORT` 27018), a separate container, and a separate data volume.

Uninstall: `cratecaddy uninstall` removes the launchd agent and stops everything. Data in the prod volume is kept — remove it yourself with `docker volume rm cratecaddy-mongo-data-prod` if you want it gone.

## Prerequisites

- macOS (the API calls Apple Music via `osascript`)
- Docker Desktop (or OrbStack/Colima) running
- Node.js 20+

## Install

```bash
# 1. Clone the repo
git clone <repo-url> ~/cratecaddy
cd ~/cratecaddy

# 2. Install dependencies
npm install --prefix src/api
npm install --prefix src/ui

# 3. Build for production (bundles the UI into the API server)
./scripts/build-prod.sh

# 4. Link the CLI onto your PATH
ln -s ~/cratecaddy/bin/cratecaddy /usr/local/bin/cratecaddy

# 5. Start
cratecaddy start
```

Open <http://localhost:7640>.

## Auto-start on boot

```bash
cratecaddy install      # start on login
cratecaddy uninstall    # remove auto-start + stop services
```

## Day-to-day

| Command | What it does |
|---|---|
| `cratecaddy start` | Start MongoDB container + API daemon |
| `cratecaddy stop` | Stop the API and take MongoDB down |
| `cratecaddy status` | Is it running? |
| `cratecaddy logs` | Tail the API log |
| `cratecaddy import <file.xml>` | Import an Apple Music library export |

## Importing your music library

`cratecaddy import ~/Music/Music/Library.xml` imports an Apple Music library export (targets `prod` by default; `cratecaddy import dev <file>` for dev). The command prints the target and connection string first, so you can Ctrl-C if it's aimed at the wrong environment.

See [Import data from Apple Music](./README.md#import-data-from-apple-music) for the full import docs (sources, idempotency, merging).

## Customisation

All values are optional — defaults work as-is. Override by creating `~/.cratecaddy/config.env`:

```bash
API_PORT=7640
MONGO_PORT=27018
CRATECADDY_LOG=/path/to/cratecaddy.log
```

After changing config, restart: `cratecaddy restart`.

## How it fits with development

The dev workflow is unaffected — separate ports, container, volume, and compose project (`cratecaddy-dev`). Both can run at the same time. See [Development](./README.md#development) in the README.
