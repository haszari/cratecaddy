# Smoke tests

Manual checks before trusting a build or a publish. There is no test framework; the one automated check is `npm run check:static-site-matches-app`, which proves the app and the static site agree on query results.

Two rules:

1. **Test the artefact you are about to trust.** For a publish that means the Snapshot built from the **prod** Library, not dev.
2. **Dev Library ≠ prod Library.** Dev holds whatever was last imported or edited there, including experimental data. `publish-static-site.sh` reads prod by default; `--use-dev-library` is only for checking the wiring.

---

## Release run-through (dev → prod → publish)

The order matters: prod is the Library of record, and the static site footer carries the app version built from this checkout.

### 1. Dev build

```bash
docker compose up -d
cd src/api && npm run dev
cd src/ui && npm run dev
```

Checks: §1. Dev and prod use separate ports, so leaving dev running is harmless.

### 2. Update the prod appliance

```bash
cratecaddy rebuild-prod          # build from the checkout, install, restart
# manual equivalent:
# ./scripts/build-prod.sh && ./scripts/prod/cratecaddy install && cratecaddy start
```

`rebuild-prod` resolves the checkout (`--source`, `CRATECADDY_SOURCE`, or the recorded `SOURCE_DIR`), runs `build-prod.sh`, installs and restarts. Checks: §2.

### 3. Publish the static site

```bash
cratecaddy publish              # snapshot prod → check → build → prompt
# or: ./scripts/publish-static-site.sh --publish-to-github
```

First time only: create `gh-pages` with a publish, then configure Pages and the custom domain (§0). Checks: §4.

Gotchas:

- `install` does not start the API; `rebuild-prod` does. After a plain `install`, run `cratecaddy start`.
- Dev edits never reach prod. If the change is data, import or edit on prod; the dev run only proves code.
- A publish before `install` produces a valid site whose footer version is older than the running appliance; update prod first.

---

## 0. GitHub setup (one-time, before the first publish)

Nothing here is automated by the publish script; it only pushes the `gh-pages` branch. No GitHub CLI or token is needed — the push uses the existing SSH remote.

**Repo**

- [ ] Repo is public (`haszari/cratecaddy`). GitHub Pages on a private repo needs a paid plan; the site is public either way.
- [ ] You can push to `gh-pages` (same write access as `main`).
- [ ] `gh-pages` is not protected by branch rules; the publish force-updates it as a single commit.

**Branch order**

- [ ] Run the first publish once (`cratecaddy publish --publish-to-github`) so `gh-pages` exists. GitHub's Pages settings only list branches that already exist.
- [ ] Then: repo → Settings → Pages → Build and deployment → Source: **Deploy from a branch** → Branch: **`gh-pages`** → Folder: **`/ (root)`** → Save.

**Custom domain**

The site is expected at `https://lab.cartoonbeats.com/cratecaddy/`, i.e. a project site under the **account-level** custom domain (configured on the `haszari.github.io` user site).

- [ ] User site (`haszari.github.io`) → Settings → Pages shows `lab.cartoonbeats.com` with **Enforce HTTPS** on.
- [ ] DNS: `lab` is a CNAME to `haszari.github.io` (subdomain, not apex). Verify with `dig lab.cartoonbeats.com`.
- [ ] Do **not** add a `CNAME` file or a custom domain in this repo. That would move the project site to the domain root and break the `/cratecaddy/` base path.
- [ ] If the domain is per-project instead of account-level, stop: `base` must become `/`, a `CNAME` file is required, and the URL changes. The current build assumes the account-level setup.

**First deploy**

- [ ] Settings → Pages shows "Your site is live at https://lab.cartoonbeats.com/cratecaddy/" once the first build finishes.
- [ ] HTTPS certificate is issued (can take minutes on first setup); the URL must load over `https`, not fall back to `http`.
- [ ] `.nojekyll` is in the build (publish script validates it), so files starting with `_` are served and Jekyll is skipped.

---

## 1. App — development

Prerequisites: MongoDB, API, UI.

```bash
docker compose up -d
cd src/api && npm run dev        # :5326
cd src/ui && npm run dev         # :5325
```

API:

- [ ] `curl -s localhost:5326/health` → `status: ok`, `database.connected: true`, `database.songs` > 0, `newestUpdate` set
- [ ] `curl -s localhost:5326/api/version` → version, commit, branch (no 500)
- [ ] `curl -s 'localhost:5326/api/songs?limit=1'` → one song plus a plausible `total`
- [ ] `curl -s localhost:5326/api/songs/stats/genres` → non-empty list
- [ ] Filter response matches expectations: `?genre.all=House` returns fewer songs than no filter; `?bpm.gte=120&bpm.lte=140` keeps unrated-BPM songs

UI (`http://localhost:5325`):

- [ ] Home: tag cloud renders, song/style counts look right
- [ ] Click a genre: songs load, AND pill appears; `+` another genre narrows; remove one widens
- [ ] Exclude a tag (minus): count changes, tag disappears from cloud
- [ ] BPM range, rating filter, heart filter, text search each change the results
- [ ] Sort a column; enable shuffle, reseed, toggling returns to the same order for the same seed
- [ ] Pagination: next/prev, count stays consistent
- [ ] Artist link → artist page; song title → song page
- [ ] Favourited page lists only hearts
- [ ] Edit mode: arrow keys move selection; change BPM, styles, grouping; reload → changes persisted
- [ ] History panel shows the new entry with a diff
- [ ] Only if using a disposable track: write back to Apple Music, then check the track in Music.app

## 2. App — production appliance

```bash
cratecaddy status        # running? version shown?
curl -s localhost:5225/health
curl -s localhost:5225/api/version
```

- [ ] `cratecaddy status` reports running, the expected version, and `Library: <n> songs, last change <date>`
- [ ] `cat ~/.cratecaddy/src/api/dist/VERSION` matches the Status version (ignoring any `-dirty`)
- [ ] `curl -s localhost:5225/health` → `status: ok`, `database.connected: true`, `database.songs` matching the Library, `newestUpdate` plausible
- [ ] `/health` reports `degraded` or an error when MongoDB is stopped (stop it, check, start it again)
- [ ] UI at `http://localhost:5225` behaves like the dev checks above (at minimum: Home, one genre drill-down, one edit + history)
- [ ] `cratecaddy stop` then `cratecaddy start` brings it back cleanly
- [ ] `cratecaddy logs` has no new errors from the checks
- [ ] `cratecaddy publish` reaches the same publish prompt (needs the checkout)
- [ ] Move or rename the checkout, `cratecaddy publish` fails with the source-not-found message; `cratecaddy publish --source <path>` works again

## 3. Static site — local, before publishing

```bash
./scripts/publish-static-site.sh            # builds and stops at the publish prompt
```

- [ ] Prints `prod — mongodb://127.0.0.1:5227/cratecaddy`, not dev
- [ ] Song count is plausible against prod, e.g. `docker exec cratecaddy-mongodb-prod mongosh cratecaddy --quiet --eval 'db.songs.countDocuments({grouping:"DJing"})'`
- [ ] Refuses if prod is not running, with "Start the appliance first"
- [ ] `check:static-site-matches-app` runs green
- [ ] Filename version equals the version inside the JSON
- [ ] Snapshot contains no `filePath`, `fileSize`, `bitRate`, `dateModified`, `lastImportDate`, history fields
- [ ] One Snapshot file only, in `src/ui/dist-static/data/`

Serve the built site:

```bash
cd src/ui && npm run preview:static          # http://localhost:5328/cratecaddy/
```

- [ ] Loads at `/cratecaddy/` with no console errors
- [ ] Home, genre drill-down, filters, sort, shuffle, song page, favourited page all work
- [ ] No Edit button or edit route (a stale `/edit-metadata` link lands on Home)
- [ ] Footer shows app version plus Snapshot date; hidden `#cratecaddy-version` matches
- [ ] DevTools → Network → Offline, reload: still works, offline banner shows the Snapshot date
- [ ] Deep link a hash route (`#/genre/Techno`) and reload: resolves correctly

## 4. Publish and post-deploy

```bash
./scripts/publish-static-site.sh --publish-to-github
```

- [ ] Wait for the Pages deployment, then hard-reload the published URL
- [ ] Repo → Deployments (or Settings → Pages) shows the new `gh-pages` commit as deployed
- [ ] `git ls-remote origin gh-pages` matches the pushed commit
- [ ] `curl -sI https://lab.cartoonbeats.com/cratecaddy/` → `200`, `text/html`, HTTPS (no redirect to `github.io`)
- [ ] `curl -sI https://lab.cartoonbeats.com/cratecaddy/data/snapshot-<sha8>.json` → `200`
- [ ] `curl -sI https://lab.cartoonbeats.com/cratecaddy/sw.js` → `200`
- [ ] Footer Snapshot date and version match the build you just published
- [ ] Home, one genre, one filter, one song page work on the real URL
- [ ] No Edit button
- [ ] Phone: open once, add to home screen, then reload offline — still works
- [ ] Update flow: publish a new Snapshot, return to an already-open old tab, expect "Getting fresh tune data…" then reload with the new date
- [ ] Rollback: republish an archive from `src/data/static-deploys/<sha8>/`, confirm the footer reverts

## 5. Failure drills (occasionally)

- [ ] Stop prod MongoDB, run the publish script → refuses with a clear message
- [ ] Set `snapshot.config.json` to a tiny subset, attempt publish → smaller-library guard blocks it; `--allow-smaller-library` proceeds
- [ ] Dirty tree + `--publish-to-github` → dirty-build confirmation appears; `--allow-dirty-build` skips it

## Troubleshooting the published site

| Symptom | Likely cause | Fix |
|---|---|---|
| 404 on the site URL | Pages source not set, or first build still running | Settings → Pages: `gh-pages` /(root); wait for the deployment |
| Blank page, assets 404 | `base` mismatch, or a `CNAME` file in this repo | Keep `base: '/cratecaddy/'`; remove any `CNAME` from the project repo |
| Redirects to `haszari.github.io/cratecaddy` | account-level custom domain not set or not verified | Set/verify `lab.cartoonbeats.com` on the user site, enforce HTTPS |
| Old version after publishing | Pages HTML cache (~10 min) or service worker | Hard reload / private window; a new Snapshot should trigger "Getting fresh tune data…" |
| HTTPS warning | certificate still issuing after a domain change | Wait, then re-save Enforce HTTPS on the user site |

## Not covered

- No automated browser E2E tests. The parity check covers query semantics only.
- Apple Music write-back is manual and mutates real metadata; only test with a disposable track.
- Import scripts are not smoke-tested here; re-importing is idempotent but slow.
