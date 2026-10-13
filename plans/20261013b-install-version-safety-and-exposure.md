# Plan: Safer installs with versioning + visibility (updated per constraints)

## 1) Objectives

- Make `cratecaddy install` safer: show exactly what source/version is being installed and warn if the checkout is "unusual" (not a clean `main`, detached, dirty, or no git repo).
- Add baked-in app version + changeset identity at build time.
- Expose version at runtime via API (`/api/version`).
- CLI `status` and `version` must query the **running app via API** (contract: if app not running, show no version). Do not read files on disk to determine "true app version".
- Document source-install behavior.

## 2) Decisions (resolved)

### Install safety

- **Hardcode default branch:** `main`.
- **Unusual/risky trigger:** Treat as unusual if *any* of: no `.git` repo present; current branch != `main`; HEAD is detached; working tree is dirty (uncommitted/staged changes). Also treat any git command failure as "unusual/weird".
- **Upstream check:** Skip. Not required.
- **Prompt style:** Single question `Installing unusual source version - proceed?` with full details printed on separate lines below (no `y/N` default gymnastics beyond simple read). Default answer on non-interactive is **N** (abort) — the script should wait for `yes/y` to proceed, else abort. No `--force`/`-f` option.
- **If no git repo:** Proceed but treat as unusual. Print details showing `Git repo: no`. Allow install (supports "install from zip" use case) but require explicit confirmation.
- **Best effort:** Git checks must be non-fatal (if git unavailable in weird env, treat as unusual with unknowns).

### Versioning

- **Source of truth:** `src/api/package.json` version. Bump to `0.1.0`. Also bump `src/ui/package.json` to `0.1.0` for consistency.
- **Changeset id:** Use git commit SHA. Bake **full** commit in generated artifact, display **short** (7–9 chars) everywhere user-facing. API returns both.
- **Combined version string:** `APP_VERSION+GIT_COMMIT_SHORT` (SemVer build metadata style). Append branch in parentheses **only if branch != `main`**. If branch is `detached` (or empty/unknown), render `(detached)` when not `main`-equivalent, or just omit branch suffix if unclear.
- **Dirty marker:** If working tree dirty at build time, append `-dirty` to combined string (e.g. `0.1.0+241fbd8-dirty`, or `0.1.0+241fbd8 (add/foo)-dirty` if branch shown). Include `gitDirty: boolean` in API.
- **Build time:** UTC ISO8601 in API (`buildTime`).
- **Fallbacks:** If no `.git` or git info unavailable, set `gitCommit="unknown"`, `gitCommitShort="unknown"`, `gitBranch=""`, `gitDirty=false`, version string `0.1.0+unknown`. Must not crash build/install.

### 3) Build-time generation

- **Location:** `src/api/src/generated/version.ts` (source tree). Treat as build artifact — **do not commit**.
- **.gitignore:** Add `src/api/src/generated/` to `src/api/.gitignore`.
- **When generated:** In `scripts/build-prod.sh`, `mkdir -p src/api/src/generated` and write `version.ts` **before** running `npm run build` in API.
- **Generation approach:** Compute via git (branch, rev-parse HEAD/full/short, dirty check). Dirty check: `git diff --quiet --ignore-submodules HEAD` → dirty if non-zero exit. All best-effort with fallbacks.
- **Dev vs prod (API):** Generate file at build time (prod). For `npm run dev` (tsx watch), version route computes live from git + `src/api/package.json` if baked dist file not present.
- **Generated module shape:** exports APP_VERSION, GIT_COMMIT (full), GIT_COMMIT_SHORT, GIT_BRANCH, GIT_DIRTY, BUILD_TIME, VERSION.

## 4) API: `/api/version`

- **New route:** `src/api/src/routes/version.ts`. Mount in `src/api/src/server.ts` as `app.use('/api/version', versionRoutes)`.
- **Resolution:** Try to load baked `dist/generated/version.js` if exists (prod). Else compute live from git + package.json (dev/tsx).
- **Response:** `appVersion`, `gitCommit`, `gitCommitShort`, `gitBranch`, `gitDirty`, `buildTime`, `version`. No auth, never throw (use fallbacks).
- **Mount order:** Before static/UI fallback is fine.

## 5) UI

- **Dev git info:** `src/ui/vite.config.ts` defines `__GIT_BRANCH__`, `__GIT_COMMIT_SHORT__`, `__GIT_DIRTY__` (best-effort, fallbacks).
- **Dev branch badge:** `src/ui/src/App.tsx` renders small unobtrusive bottom-right badge when `import.meta.env.DEV`.
- **Hidden version element (prod+dev):** Single hidden div with `data-app`, `data-version`, `data-commit-short`, `data-commit-full`, `data-branch`, `data-dirty`. Populated from `/api/version` on mount (with fallbacks if fetch fails).

## 6) CLI: `status` and `version` (must read from running app via API)

- **status:** Determine API_PORT from config/env (default 5225). Check PID/process. If not running → print status only, **no version**. If running → `GET http://127.0.0.1:${API_PORT}/api/version` (small timeout). On success show status+version from API; on error show running state + "version: unavailable (failed to query /api/version)". No file fallback.
- **version:** Plain alias of `status` (identical output).
- **Install-time printing:** From checkout context, print source details that will be baked (branch/commit/dirty/repo/app version) before safety prompt and before copying. This is separate from runtime query.

## 7) Install logic (safety prompt + flow)

### Detection (checkout context)
- Check `.git` exists (best effort). Collect `has_git`, `branch` (or `detached`/`unknown`), `commit_full`, `commit_short`, `subject` (first line, truncated), `dirty` (bool/unknown).
- `unusual` = true if `!has_git` OR branch!=`main` OR branch==`detached`/empty OR dirty==true OR any detection error.

### Prompt
If unusual:
```
Installing unusual source version - proceed?
Source: <PROJECT_DIR>
Git repo: yes/no
Branch: <branch or detached or unknown>
Commit: <commit_full or unknown> (<commit_short or unknown>)
Dirty: yes/no/unknown
Subject: <subject or "-">
Reason: <comma-separated reasons>
```
Wait for input. Accept only `yes`/`y` (case-insensitive). Else print `Aborting install.` and exit 1. No other options.

If not unusual: print brief "Installing CrateCaddy from checkout" block and proceed without prompt.

### Flow
- Verify `src/api/dist/server.js` exists (build-prod.sh must have run). If missing → error instructing to run `./scripts/build-prod.sh`.
- Stop API if running (best-effort).
- Copy runtime to `~/.cratecaddy/` (CLI, compose files, plist template, built `src/api/` including `dist/`).
- Ensure `~/.zshrc` has PATH line (idempotent).
- Bake plist and bootstrap launchd (unload+bootstrap).
- Print success.

## 8) Build script (`scripts/build-prod.sh`)
1. `set -e`
2. Generate `src/api/src/generated/version.ts` inline (mkdir -p, git info + read APP_VERSION from `src/api/package.json`, write exports with UTC BUILD_TIME). Best-effort fallbacks; never crash.
3. `cd src/ui && npm run build`
4. `cd ../api && npm run build`
5. Bundle UI: `rm -rf dist/static && mkdir -p dist/static && cp -r ../ui/dist/* dist/static/` (as current pattern)

## 9) File changes (concrete)
- `src/api/package.json` → `version: "0.1.0"`
- `src/ui/package.json` → `version: "0.1.0"`
- `src/api/.gitignore` → add `src/generated/`
- `scripts/build-prod.sh` → add version generation before API build
- `src/api/src/routes/version.ts` → new
- `src/api/src/server.ts` → mount `/api/version`
- `src/ui/vite.config.ts` → inject git defines for dev
- `src/ui/src/App.tsx` → dev badge + hidden version element + API population
- `scripts/prod/cratecaddy` → install safety + runtime status/version reads API
- `PRODUCTION.md` → document source install, build-before-install, unusual-version prompt, and runtime `status/version` behavior

## 10) Edge cases
- No `.git` repo → unusual prompt, proceed only on yes.
- Detached HEAD → branch `detached`, unusual.
- Dirty tree → flagged, unusual, baked as `-dirty`.
- Shallow/missing git → best-effort, never crash.
- API down during status → running state + "version: unavailable (failed to query /api/version)" (no file fallback).
- Port/config mismatch → query configured port.
