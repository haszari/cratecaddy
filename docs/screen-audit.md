# Screen audit — entry points → user activity

Maps every entry point (UI screen + CLI command) to its user actions, then to one of the three activities: **Explore / Curate / Perform**. Durable reference; feeds the framework in `plans/20261027-user-experience-framework-activities.md` and `docs/activities.md`.

## UI screens

### Home `/` — tag cloud
- Browse genre tag cloud (main + fringe, with counts)
- Click genre → include (navigate to `/genre/:g`)
- Exclude genre (X)
- Filter: search text, tempo (bpm) range, star-rating range
- Heart → go to Favourited (nav)
- Shuffle toggle + reseed
- Edit metadata (pencil) → `/edit-metadata`

### Genre `/genre/:genrePath` — songs for one genre / AND (`+`) / OR (`,`) combination
- View song table (filtered)
- Sort columns (artist, title, bpm, key, rating)
- Paginate
- Add/remove related tags from tag cloud (include/exclude)
- Remove genre criteria (pill)
- Filter: search, tempo, rating, favourite
- Shuffle + reseed
- Edit metadata (pencil)
- Navigate: artist page, song page

### Artist `/artist/:artistName` — songs by artist
- View song table
- Sort, paginate
- Add required genre (AND) / remove
- Add/remove related tags
- Filter: search, tempo, rating, favourite
- Shuffle + reseed
- Edit metadata
- Navigate: song page

### Favourited `/favourited` — starred songs
- View song table (starred only)
- Sort, paginate
- Add/remove required genre
- Add/remove related tags
- Filter: search, tempo, rating
- Shuffle + reseed
- Edit metadata

### Song `/song/:id` — single track
- View artist / title / bpm / key
- Link to artist page
- View genres tag cloud

### Edit `/edit-metadata` — edit screen (API shell only; absent from static build)
- Select songs: single, toggle, shift-range multi-select
- Arrow up/down navigate list
- Single edit fields: artist, title, grouping (DJing/Listening), bpm, key (root + minor), year, set (Deep/BAM/Ambient), stage (Warmup/Peak/Later), NZ, styles (autocomplete), listening tags
- Rating 1–5 (stars)
- Auto-save to DB (debounced)
- Save to Apple Music (single)
- View edit history (per song, inline diff)
- Bulk edit (multi-select): add/remove genres, add/remove grouping, set scalar fields, Save Changes / Cancel, Save to Apple Music (batch)
- Keyboard shortcuts (rating, grouping, focus fields)

## CLI commands

### Appliance (run the tool) — `cratecaddy`
- start / stop / restart — run the service
- status / version — running state + version
- logs — tail log
- install / uninstall — set up / remove runtime + auto-start
- rebuild-prod — rebuild from checkout, install, restart

### Bring music in — import
- `cratecaddy import [dev|prod] [apple|djay] <file>` — import Apple Music XML / djay Pro CSV
- `npm run import:rekordbox <xml>` — experimental Rekordbox import

### Publish / maintenance
- `cratecaddy publish` — snapshot library → build static site → push to GitHub Pages
- `npm run snapshot` — emit static snapshot data
- `npm run inspect:library` — inspect library
- `npm run check:static-site-matches-app` — verify static build matches app

## Carve — entry point → activity

### Explore (read-only browse/filter)
- Home, Genre, Artist, Song

### Curate (manage collection: edit, bring in, sync out)
- Edit `/edit-metadata` screen (single + bulk edit, history)
- `cratecaddy import [dev|prod] [apple|djay] <file>` / `npm run import:rekordbox`
- Save to Apple Music (single + batch)
- Favourited `/favourited` — process / review list while curating

### Perform (assemble ordered music)
- none yet — playlists, setlists, shows, live tracking (future)

### No user activity — system/developer fence (not UX, not in `docs/activities.md`)
- Appliance: start / stop / restart / status / version / logs / install / uninstall / rebuild-prod
- Publish + maintenance: `cratecaddy publish`, `snapshot`, `inspect:library`, `check:static-site-matches-app`

Static build = Explore screens only (EditMetadata lives outside `browseRoutes`).
