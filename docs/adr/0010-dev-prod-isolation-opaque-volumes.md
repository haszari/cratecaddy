# Dev/prod isolation with opaque Docker volumes

**Question:** How do dev and prod MongoDB instances coexist on one machine without colliding or sharing data?

Dev and prod are fully isolated:

| | Prod | Dev |
|---|---|---|
| MongoDB container | `cratecaddy-mongodb-prod` | `cratecaddy-mongodb-dev` |
| Data volume | `cratecaddy-mongo-data-prod` | `cratecaddy-mongo-data-dev` |
| Host port | `MONGO_PORT` from config.env (default 27018) | `MONGO_PORT` from root `.env` (default 27017) |
| Compose | base + `docker-compose.prod.yml` override | base `docker-compose.yml` only |

Container names and volume names carry a `-prod`/`-dev` suffix so Docker never sees a name collision, and both can run simultaneously. Ports are configurable per environment (e.g. prod on 27018) so host port bindings never clash. The base compose file interpolates `${MONGO_PORT:-27017}` rather than hardcoding 27017.

MongoDB data lives in Docker **named volumes**, not a host folder. There is no `CRATECADDY_DATA` config knob and no bind mount: the data is opaque Mongo state (WiredTiger files) that a human can't read, so surfacing it invites confusion. Backups and restores go through `cratecaddy import` or `docker volume` operations.

Rejected alternatives:

1. **Bind-mount data to a host folder with a `CRATECADDY_DATA` config knob.** The data is opaque binary state, so a host-visible path adds a dead config option and the risk of users hand-editing or copying it. Named volumes keep the container the sole owner of its state.

2. **Shared volume and shared container name; dev and prod differ only by port.** Then dev and prod share a database — an import or edit in one affects the other. Separate suffixed containers and volumes are the whole point of isolation.

3. **Port-suffixed container names (`cratecaddy-mongodb-27017` / `-27018`).** Same isolation, but the name stops meaning "which environment" and instead encodes a number. The `-dev`/`-prod` suffix keeps the label meaningful.
