# Daemon mode with launchd auto-start on boot

**Question:** How does the appliance start on OS boot, and how is the API process managed once it is running?

`cratecaddy start` runs the API in the background via `nohup node dist/server.js` and tracks it with a PID file at `~/.cratecaddy/api.pid`. A launchd plist (`RunAtLoad: true`, `KeepAlive: false`) fires `cratecaddy start` once at boot and then moves on. Start/stop/restart/status are plain PID-file operations — no launchd-awareness in the CLI.

This is deliberately simple. The user's key requirement is: reliably launch on boot, and easy manual (re)start. `KeepAlive: false` means a crashed API stays down until manually restarted — no crash auto-restart, by choice (the user may add it later, but it is not part of this step).

The plist is a **template** with `__CRATECADDY_CLI_PATH__` and `__CRATECADDY_LOG_FILE__` placeholders. `cratecaddy install` substitutes them with `sed`, writing to `~/Library/LaunchAgents/`. The CLI path is always the **installed copy** at `~/.cratecaddy/bin/cratecaddy` (see [0012-per-user-install-directory](./0012-per-user-install-directory.md)) — never the checkout, so auto-start survives the checkout being moved or deleted. The installed plist is **frozen config**: re-run `install` to regenerate; we do not support editing the installed copy.

Rejected alternatives:

1. **launchd owns the API process via `KeepAlive: true` and a foreground `run` command.** Gives crash auto-restart but forces launchd-aware start/stop/restart branches in the CLI, complicates the process model, and adds machinery the user explicitly does not want yet. Deferred.

2. **Store the CLI path directly in the template, no `sed` substitution.** The CLI is copied to a fixed per-user install directory (`~/.cratecaddy/bin/cratecaddy`), and the log path defaults to `~/.cratecaddy/cratecaddy.log` but can be overridden in `config.env`. Substitution at install time keeps the template portable and the resolved paths correct even when config is customised.
