# 20260818 — Djay pro supported + CLI reorg + reinstall

Date: 2026-08-18
Status: active
Branch: add/djay-pro-csv-import-supported

## Context

Djay pro CSV import (`src/api/scripts/import-djaypro.ts`) has been audited and fixed (plan `20260630b`) and is working in dev. It's time to promote it to a supported prod feature and reorganise the CLI layout to support future import sources.

Additionally, the current `install` command silently skips if the CLI is already running from `~/.cratecaddy/`, which means updating an existing install requires manual intervention. The install flow needs a proper reinstall/update path.

## Requirements

1. **Djay pro as explicit prod CLI command**: `cratecaddy import djay <csvfile>` alongside `cratecaddy import apple <xmlfile>`, with `apple` as the default when no source subcommand is given
2. **Move CLI to scripts/prod/**: canonical location is `scripts/prod/cratecaddy`; `bin/cratecaddy` becomes a symlink to it (backwards compat + PATH still works)
3. **Reinstall/update**: `cratecaddy install` must work as an update — copy new code in place, restart services, without losing data or breaking the PATH/launchd setup

## Changes

### 1. Move CLI to `scripts/prod/cratecaddy`

- Create `scripts/prod/` directory
- Move `bin/cratecaddy` → `scripts/prod/cratecaddy` (the real script)
- Create `bin/cratecaddy` as a relative symlink → `../scripts/prod/cratecaddy`
- Add a comment at the top of the script noting the canonical path

### 2. Add `import djay` and `import apple` source subcommands

In the `import)` case in `scripts/prod/cratecaddy`, change from:

```
cratecaddy import [prod|dev] <xml-file>
```

To:

```
cratecaddy import [prod|dev] [apple|djay] <file>
```

Parsing logic:
- First arg: optional `prod` or `dev` (consumed if matched)
- Second arg: optional `apple` or `djay` (consumed if matched; defaults to `apple`)
- Remaining args: the file path + any extra npm args

Then dispatch:
- `apple` → `npm run import:applemusic "$@"`
- `djay` → `npm run import:djaypro "$@"`

The help text and header comment are updated to reflect both sources.

### 3. Support reinstall/update in `install` command

The current install flow (line 225–274) skips the copy block if `$PROJECT_DIR == $INSTALL_ROOT`. For an update, the user runs install from the checkout and it should update the installed copy in place.

Changes:
- Remove the "already installed, skip copy" early-exit — the copy block always runs (idempotent: `cp` overwrites, `rm -rf` + `mkdir -p` is safe)
- Before copying, stop the API if running (call `stop_api`) so `node_modules` and `dist/` aren't replaced while in use
- After copying, re-install the launchd plist (already happens — move the plist logic outside the copy conditional)
- Relaunch the API if it was running before (or let launchd handle it on next boot)
- The PATH setup is already idempotent (grep guard), so no change needed there

### 4. Update `build-prod.sh` (no change needed)

`build-prod.sh` doesn't reference `bin/` or `scripts/prod/` — it only touches `src/ui` and `src/api`. No changes required.

## Files changed

| File | Action |
|------|--------|
| `scripts/prod/cratecaddy` | **new** — moved from `bin/cratecaddy` with updated import logic |
| `bin/cratecaddy` | **replace** — becomes symlink → `../scripts/prod/cratecaddy` |
| `plans/20260818-djaypro-supported-and-cli-reorg.md` | **new** — this plan |

## Verification

1. `ls -la bin/cratecaddy` confirms symlink
2. `./bin/cratecaddy` shows help with both `apple` and `djay` import sources
3. `./bin/cratecaddy import --help` (or no args) shows usage with source subcommands
4. From checkout: `./scripts/prod/cratecaddy import dev apple <xml>` runs the Apple Music import
5. From checkout: `./scripts/prod/cratecaddy import dev djay <csv>` runs the djay pro import
6. `./scripts/prod/cratecaddy import dev <xml>` defaults to apple source
7. Install from checkout: `./scripts/prod/cratecaddy install` updates `~/.cratecaddy/` in place
8. Reinstall: run install twice — second run stops API, copies fresh code, re-enables launchd
9. `cratecaddy import djay <csv>` works from any directory after install (PATH)
