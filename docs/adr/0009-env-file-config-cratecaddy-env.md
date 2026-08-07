# Env-file config with defaults; CRATECADDY_ENV drives import target

**Question:** How does the appliance get its configuration (ports, log path, environment), and how does `cratecaddy import` know which database to write to?

All values are configurable through env files with defaults when unset. Prod values live in `~/.cratecaddy/config.env`; dev values live in the repo-root `.env` (auto-loaded by Docker Compose). The CLI **sources** config.env at startup, so the resulting env vars flow into the compose command, the API process, and the import script. No `--env-file` pass-through is used — sourcing is the mechanism.

- `API_PORT` (default 7625) — API listen port
- `MONGO_PORT` (default 27017) — host-side MongoDB port
- `CRATECADDY_LOG` — log file path (default `~/.cratecaddy/cratecaddy.log`)
- `CRATECADDY_ENV` — `prod` (default) or `dev`

`CRATECADDY_ENV` drives the default target of `cratecaddy import`: `cratecaddy import <file>` targets the config's environment (prod for the installed daemon), and `cratecaddy import prod|dev <file>` overrides explicitly. Each target loads its own config and exports `MONGODB_URI` so the import lands in the right database on the right port. The command prints the resolved target and URI first so a wrong-environment import can be Ctrl-C'd.

Rejected alternatives:

1. **Pass config.env to Docker Compose via `--env-file`.** Adds a second mechanism alongside sourcing, splits config handling between compose and the shell, and leaves the API process (which needs the values as real env vars) out. Sourcing once at CLI startup covers every consumer with one mechanism.

2. **Default import target = prod, always.** With no `CRATECADDY_ENV` and no explicit arg, a developer would need shell-level `MONGODB_URI` overrides to import into dev for testing. The `dev|prod` arg plus a config-driven default keeps the common case one word and the testing case explicit.
