# CrateCaddy appliance (prod build)

Runs CrateCaddy as a self-contained service on macOS: a MongoDB container (Docker) plus the built API server (Node, serving the UI). Managed by a single `cratecaddy` command, optionally auto-started on boot via launchd.

This is the **production** setup. It uses its own ports and data, so it runs alongside the dev workflow without touching it.


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
./scripts/prod/cratecaddy install
# The installed `cratecaddy` cannot install itself. Run install from the
# checkout, or pass --source <checkout> (SOURCE_DIR is recorded at install).

# 5. Start (open a new terminal first, or run: source ~/.zshrc)
cratecaddy start
```

Open <http://localhost:5225>.

The appliance is a **copy** — CrateCaddy keeps running if you move or delete the checkout. Publishing the static site is the exception: it builds from source, so **keep the checkout** (or point at one with `--source`). Making publishing self-contained in the appliance is a future improvement.
## About the install

This is a **source install**: `cratecaddy install` copies the **built production runtime from the current checkout** (branch/commit/state at install time). It does **not** pull a release or tag. Re-running `install` updates in place from the current checkout and preserves data volumes.

You must run `./scripts/build-prod.sh` before `cratecaddy install`. The install script checks for `src/api/dist/server.js` and will fail if it's missing.

If the checkout is unusual (no git repo, not on `main`, detached HEAD, or has uncommitted changes), `cratecaddy install` prints full source details and prompts with: `Installing unusual source version - proceed?` — type `yes` or `y` to continue; any other input aborts.

## Runtime version

The build identity ships in `src/api/dist/VERSION` and is served by `GET /api/version`. `cratecaddy status` shows status. If the API is running, it queries `GET /api/version` on the running app and includes the version string (e.g. `0.1.0+3cfbcab (branch)-dirty`). `cratecaddy version` is an alias of `status` with identical output. Version is determined from the running app only (no file fallback) — if the app is not running, no version is shown. The installed copy has no git metadata, so `build-prod.sh` bakes the commit and branch into the build; when no commit is known at all, the version is just the app version (`0.1.0`), never `0.1.0+unknown`.


## Auto-start on boot

`cratecaddy install` also enables start-on-login. To undo:

```bash
cratecaddy uninstall    # remove auto-start + PATH line, stop services
```

## Usage - command reference

| Command | What it does |
|---|---|
| `cratecaddy start` | Start MongoDB container + API daemon |
| `cratecaddy stop` | Stop the API and take MongoDB down |
| `cratecaddy status` | Is it running? Version, Library song count and last change (end-to-end health, not just a live process) |
| `cratecaddy logs` | Tail the API log |
| `cratecaddy import <file>` | Import music metadata (Apple Music XML by default) |
| `cratecaddy import djay <file>` | Import from djay Pro CSV export |
| `cratecaddy publish` | Snapshot the prod Library, build the static site, then ask before publishing. Needs the checkout; add `--publish-to-github` to skip the prompt. First-time GitHub Pages setup: [smoke tests](./docs/smoke-tests.md#0-github-setup-one-time-before-the-first-publish) |

## Smoke testing

After install or update, run the [smoke tests](./docs/smoke-tests.md) against the appliance and the running app.

## Importing your music library

`cratecaddy import ~/Music/Music/Library.xml` imports an Apple Music library export (targets `prod` by default; `cratecaddy import dev <file>` for dev). `cratecaddy import djay ~/data/dJayPro.csv` imports from djay Pro. The command prints the target and connection string first, so you can Ctrl-C if it's aimed at the wrong environment.

See [Import data from Apple Music](./README.md#import-data-from-apple-music) for the full import docs (sources, idempotency, merging).

## Customisation

All values are optional — defaults work as-is. Override by creating `~/.cratecaddy/config.env`:

```bash
API_PORT=5225
MONGO_PORT=5227
CRATECADDY_LOG=/path/to/cratecaddy.log
SOURCE_DIR=/path/to/cratecaddy-checkout   # recorded by install; used by `cratecaddy publish`
```

After changing config, restart: `cratecaddy restart`.

## Security notes

The API binds all network interfaces, so it is reachable from other devices on your LAN at `http://<mac-ip>:<API_PORT>`. MongoDB binds loopback only (`127.0.0.1`), so the database is not exposed. Do not expose the API port to the internet — it has no authentication.

## How it fits with development

The dev workflow is unaffected — separate ports, container, volume, and compose project (`cratecaddy-dev`). Both can run at the same time. See [Development](./README.md#development) in the README.

## What's installed, where? 

Installing the appliance creates these things on your machine:

- `~/.cratecaddy/` — the installed runtime: the CLI (`bin/cratecaddy`), compose files, the launchd plist template, and the built API (`src/api/` with `dist/`, `node_modules/`, and import scripts) — plus config (`config.env`), the API log, and the PID file. Source lives at `scripts/prod/cratecaddy` in the repo.
- a PATH line in `~/.zshrc` pointing at `~/.cratecaddy/bin`, so the `cratecaddy` command works from any terminal
- `cratecaddy-mongodb-prod` — a Docker container running MongoDB 7.0
- `cratecaddy-prod_cratecaddy-mongo-data-prod` — a named Docker volume holding all prod data (deleting the container does not delete your data)
- `com.cratecaddy.startup` — a launchd agent (only if you run `cratecaddy install`) that starts the appliance on boot

None of this touches your dev database, containers, or `.env` files — prod uses separate ports (`API_PORT` 5225, `MONGO_PORT` 5227), a separate container, and a separate data volume.

## How to uninstall?

```bash
# Remove the launchd agent, the PATH line, and stop running containers and services.
cratecaddy uninstall
# The runtime in `~/.cratecaddy` and the prod data volume are not automatically deleted.
# Delete manually:
rm -rf ~/.cratecaddy
# Delete the docker data volume:
docker volume rm cratecaddy-prod_cratecaddy-mongo-data-prod
```
