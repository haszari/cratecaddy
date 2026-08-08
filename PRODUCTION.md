# CrateCaddy appliance (prod build)

Runs CrateCaddy as a self-contained service on macOS: a MongoDB container (Docker) plus the built API server (Node, serving the UI). Managed by a single `cratecaddy` command, optionally auto-started on boot via launchd.

This is the **production** setup. It uses its own ports and data, so it runs alongside the dev workflow without touching it.

## What it does to your system

Installing the appliance creates these things on your machine:

- `~/.cratecaddy/` — the installed runtime: the CLI (`bin/cratecaddy`), compose files, the launchd plist template, and the built API (`src/api/` with `dist/`, `node_modules/`, and import scripts) — plus config (`config.env`), the API log, and the PID file
- a PATH line in `~/.zshrc` pointing at `~/.cratecaddy/bin`, so the `cratecaddy` command works from any terminal
- `cratecaddy-mongodb-prod` — a Docker container running MongoDB 7.0
- `cratecaddy-mongo-data-prod` — a named Docker volume holding all prod data (deleting the container does not delete your data)
- `com.cratecaddy.startup` — a launchd agent (only if you run `cratecaddy install`) that starts the appliance on boot

None of this touches your dev database, containers, or `.env` files — prod uses separate ports (`API_PORT` 5225, `MONGO_PORT` 5227), a separate container, and a separate data volume.

Uninstall: `cratecaddy uninstall` removes the launchd agent, the PATH line, and stops everything. The runtime in `~/.cratecaddy` and the prod data volume are kept — remove them yourself with `rm -rf ~/.cratecaddy` and `docker volume rm cratecaddy-mongo-data-prod` if you want them gone.

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

# 4. Install the appliance — copies the built runtime to ~/.cratecaddy and
#    adds ~/.cratecaddy/bin to your PATH (in ~/.zshrc)
./bin/cratecaddy install

# 5. Start (open a new terminal first, or run: source ~/.zshrc)
cratecaddy start
```

Open <http://localhost:5225>.

The appliance is a **copy** — after install you can move or delete the checkout and CrateCaddy keeps working.

## Auto-start on boot

`cratecaddy install` also enables start-on-login. To undo:

```bash
cratecaddy uninstall    # remove auto-start + PATH line, stop services
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
API_PORT=5225
MONGO_PORT=5227
CRATECADDY_LOG=/path/to/cratecaddy.log
```

After changing config, restart: `cratecaddy restart`.

## Security notes

The API binds all network interfaces, so it is reachable from other devices on your LAN at `http://<mac-ip>:<API_PORT>`. MongoDB binds loopback only (`127.0.0.1`), so the database is not exposed. Do not expose the API port to the internet — it has no authentication.

## How it fits with development

The dev workflow is unaffected — separate ports, container, volume, and compose project (`cratecaddy-dev`). Both can run at the same time. See [Development](./README.md#development) in the README.
