# Per-user install directory

**Question:** Where does the installed CrateCaddy appliance live, and how does the `cratecaddy` command get onto PATH?

The appliance installs to `~/.cratecaddy/` — one self-contained, per-user folder holding the CLI (`bin/cratecaddy`), compose files, the launchd plist template, the built API (`src/api/`), and the runtime state (`config.env`, log, PID). `cratecaddy install` copies the built runtime from the checkout into that folder and appends one PATH line to `~/.zshrc`:

```bash
export PATH="$HOME/.cratecaddy/bin:$PATH"
```

`cratecaddy uninstall` removes the PATH line and the launchd agent. The CLI resolves everything from its own real location (two levels up from `bin/`), so the copied script runs against the copy in `~/.cratecaddy` — the checkout is disposable after install.

Rationale:

- **Per-user, no sudo.** The whole appliance lives under `$HOME`; nothing touches `/usr/local` or other users' machines.
- **One predictable folder.** `~/.cratecaddy/` is documented in one place, and `install`/`uninstall` only ever touch it plus the PATH line and launchd.
- **Fixes the fragile checkout-symlink design.** The old `/usr/local/bin/cratecaddy` symlink pointed at the checkout; the appliance resolved everything from `PROJECT_DIR`, so moving or deleting the checkout broke `start`/`stop`/`import` and left a dangling symlink (this actually happened). Installing a copy decouples the running appliance from the repo.
- **Conventional for user-installed CLI tools on macOS.** The "own hidden folder + own PATH line" pattern matches what mainstream tools already do: rustup/cargo (`~/.cargo/bin`), deno (`~/.deno/bin`), pyenv (`~/.pyenv/bin`), asdf (`~/.asdf`). No sudo, one rc-file line each.

Rejected alternatives:

1. **`/usr/local/bin` symlink (sudo).** System-wide, needs sudo, and the appliance still resolved everything from the checkout — the fragility that motivated this ADR.
2. **XDG layout (`~/.local/bin` entry point + `~/.local/share/cratecaddy/` internals).** The XDG spec defines `~/.local/bin` for user executables, but macOS does not put it on PATH by default (a PATH line is still required), and its adopters (pipx, uv, mise) are a niche of the ecosystem. The macOS-default-tool pattern — one dotfolder per tool — is the stronger convention here.
3. **`~/Applications`.** For GUI `.app` bundles, not PATH-resolved CLI tools.
4. **`~/bin`.** Traditional Unix "personal bin", but it mixes all of a user's tools in one shared folder, requires the PATH line anyway, and is less specific to CrateCaddy.
