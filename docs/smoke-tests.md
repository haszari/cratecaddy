# Smoke tests

Manual checks before trusting a build or a publish. There is no test framework; the one automated check is `npm run check:site-matches-app`, which proves the app and the published site agree on query results.

Two rules:

1. **Test the artefact you are about to trust.** For a publish that means the Snapshot built from the **prod** Library, not dev.
2. **Dev Library ≠ prod Library.** Dev holds whatever was last imported or edited there, including experimental data. `publish-library-site.sh` reads prod by default; `--use-dev-library` is only for checking the wiring.

---

## 1. App — development

Prerequisites: MongoDB, API, UI.

```bash
docker compose up -d
cd src/api && npm run dev        # :5326
cd src/ui && npm run dev         # :5325
```

API:

- [ ] `curl -s localhost:5326/health` → `{"status":"ok"}`
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

- [ ] `cratecaddy status` reports running and the expected version
- [ ] UI at `http://localhost:5225` behaves like the dev checks above (at minimum: Home, one genre drill-down, one edit + history)
- [ ] `cratecaddy stop` then `cratecaddy start` brings it back cleanly
- [ ] `cratecaddy logs` has no new errors from the checks

## 3. Library site — local, before publishing

```bash
./scripts/publish-library-site.sh            # builds and stops at the publish prompt
```

- [ ] Prints `prod — mongodb://127.0.0.1:5227/cratecaddy`, not dev
- [ ] Song count is plausible against prod, e.g. `docker exec cratecaddy-mongodb-prod mongosh cratecaddy --quiet --eval 'db.songs.countDocuments({grouping:"DJing"})'`
- [ ] Refuses if prod is not running, with "Start the appliance first"
- [ ] `check:site-matches-app` runs green
- [ ] Filename version equals the version inside the JSON
- [ ] Snapshot contains no `filePath`, `fileSize`, `bitRate`, `dateModified`, `lastImportDate`, history fields
- [ ] One Snapshot file only, in `src/ui/dist-site/data/`

Serve the built site:

```bash
cd src/ui && npm run preview:site          # http://localhost:5328/cratecaddy/
```

- [ ] Loads at `/cratecaddy/` with no console errors
- [ ] Home, genre drill-down, filters, sort, shuffle, song page, favourited page all work
- [ ] No Edit button or edit route (a stale `/edit-metadata` link lands on Home)
- [ ] Footer shows app version plus Snapshot date; hidden `#cratecaddy-version` matches
- [ ] DevTools → Network → Offline, reload: still works, offline banner shows the Snapshot date
- [ ] Deep link a hash route (`#/genre/Techno`) and reload: resolves correctly

## 4. Publish and post-deploy

```bash
./scripts/publish-library-site.sh --publish-to-github
```

- [ ] Wait for the Pages deployment, then hard-reload the published URL
- [ ] Footer Snapshot date and version match the build you just published
- [ ] Home, one genre, one filter, one song page work on the real URL
- [ ] No Edit button
- [ ] Phone: open once, add to home screen, then reload offline — still works
- [ ] Update flow: publish a new Snapshot, return to an already-open old tab, expect "Getting fresh tune data…" then reload with the new date
- [ ] Rollback: republish an archive from `src/data/site-deploys/<sha8>/`, confirm the footer reverts

## 5. Failure drills (occasionally)

- [ ] Stop prod MongoDB, run the publish script → refuses with a clear message
- [ ] Set `snapshot.config.json` to a tiny subset, attempt publish → smaller-library guard blocks it; `--allow-smaller-library` proceeds
- [ ] Dirty tree + `--publish-to-github` → dirty-build confirmation appears; `--allow-dirty-build` skips it

## Not covered

- No automated browser E2E tests. The parity check covers query semantics only.
- Apple Music write-back is manual and mutates real metadata; only test with a disposable track.
- Import scripts are not smoke-tested here; re-importing is idempotent but slow.
