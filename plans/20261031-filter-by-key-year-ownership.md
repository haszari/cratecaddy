# Plan: Filter by key, year, ownership

Add three browse filters, built with Mantine UI. Issue: https://github.com/haszari/cratecaddy/issues/31

## 1) Objectives

1. **Filter by key** — including near-key tolerance (like the tempo/rating range), plus sort by key (Camelot/similarity) in list views.
2. **Filter by year** — with tolerance / fuzzy range.
3. **Filter by owned vs streaming vs all** — a 3-way switch/selector.

## 2) Current state (researched)

- **Ownership is already implemented in the query layer.** `KEY.ownership` exists in `apiParams.ts`; `buildSongFilter.ts` (`buildOwnershipCondition`) and `songQuery.ts` (`isOwned`/`isStreamingOnly`) both support `owned`/`streaming`. Missing: the UI control, wiring in `useFilters`, `FilterState`, `buildApiParams`, `clearFilters`, `hasActiveFilters`.
- **Year is a stored field** (`Song.year`) and already a sort column, but has **no filter params** (`year.gte`/`year.lte`).
- **Key is a stored string** (`Song.key`, e.g. `"F#m"`, `"G"`, `"Am"`) and already a sort column, but sorts **alphabetically**, not by Camelot. No filter.
- Camelot mapping exists one-way in `import-djaypro.ts` (`camelotToKey`). No shared, reversible key module.
- **Parity contract (ADR-0014):** every filter must be added to **both** `buildSongFilter` (Mongo) and `songQuery` (in-memory), plus the matrix in `check-static-site-matches-app.ts`.
- **Mantine** `@mantine/core` + `@mantine/hooks` are installed; FilterBar already uses Mantine `TextInput`. Tempo/rating controls are hand-rolled — new controls should use Mantine.
- Filter state lives in URL search params (`useFilters`), read via `readApiParams`/`buildApiParams`.

## 3) Design — per requirement

### Key filter

- **Canonical key identity = Camelot index** (`keyCamelot` 0–23). The old note-name `key` string field is removed; note name is rendered on demand via `indexToNote`.
- Add shared key module (reversible note↔Camelot + distance) under `src/api/src/helpers/`, consumed by both filter implementations and the UI via the `@cratecaddy-api` alias.
- Params: `key` (target key) + `key.tolerance` (±N steps on the Camelot wheel, 1–3).
- Matching: compute the set of keys within N steps of the target (both A and B wheels), filter by canonical Camelot index.
- UI: Mantine control (centre key + tolerance stepper), mirroring the tempo range pattern.
- Note: Apple Music comment could also carry `camelotKey=` — code comment for future, not now.

### Key sort (Camelot/similarity)

- Absolute Camelot order (not distance-from-filter).
- Store derived `keyCamelot` (0–23, null when missing) via pre-save hook + one-off backfill. Mongo sorts on it; static site derives the same value from `key` in JS.

### Year filter

- Params: `year.gte` / `year.lte` (numeric range, same shape as bpm/rating).
- UI: centre + spread (like tempo), with easy decade jumping (±10 / decade pick).

### Ownership filter

- UI: Mantine `SegmentedControl` — All / Owned / Streaming.
- Wire `ownership` into `FilterState`, `buildApiParams`, `clearFilters`, `hasActiveFilters`, `FilterBar`.
- Hidden in the static build (snapshot is owned-only by default).

### Control placement

- Add the three controls inline in the FilterBar filter group.
- Modern CSS (flex-wrap) with grouping so the bar wraps cleanly and keeps hierarchy.

## 5) Files touched (expected)

- `src/api/src/helpers/apiParams.ts` — new `KEY` entries + types
- `src/api/src/helpers/musicalKey.ts` — new shared key module
- `src/api/src/helpers/buildSongFilter.ts` — key + year conditions
- `src/api/src/helpers/songQuery.ts` — key + year matching + key sort
- `src/api/src/services/songService.ts` — key sort support
- `src/api/scripts/check-static-site-matches-app.ts` — parity matrix
- `src/ui/src/hooks/useFilters.ts` — new filter state + setters
- `src/ui/src/components/FilterBar.tsx` — new controls
- new Mantine controls (key, year, ownership)
- `src/ui/src/components/SongTable.tsx` — key sort column behaviour
- `ideas.csv` — mark the three ideas as in-progress

## 6) Acceptance

- Each filter works in dev app + static site, returns identical results (parity check).
- Filter state is URL-driven and survives reload/navigation.
- Existing filters (tempo, rating, heart, genres, search) unaffected.

## 7) Bugfix phase

### Song table columns

Order: **artist | title | rating | bpm | key | year | genres** (genres last). All headings use filled icons in the existing grey:

- artist → `user-round`, title → `disc-3`, rating → `star`, bpm → `drum`, key → `tag`, year → `calendar`
- Year column added (sortable, always visible).

### Tempo control (Mantine rebuild)

Rebuild `TempoRangeControl` on Mantine primitives, matching the current look as closely as possible (number centre, min/max hints, minus/plus range, up/down centre, clear x, `tempo` placeholder).

### Year control

Direct-manipulation, same shape as tempo: `[− spread] [min] [X] [year input] [↑↓] [max] [+ spread]`. Inactive shows `year` placeholder. No show/hide.

### Key control

Direct-manipulation, no show/hide, no "AM" badge: `[− tol] [key select] [+ tol] [X]`. Key option label `Am (8A)` (note first, Camelot in brackets, no dash). Select fixes the unset-on-click bug; dropdown opens on selected item, checkmark in left margin (macOS conventions). Inactive shows `key` placeholder.

### Ownership control

Two icons — `cloud` (streaming) + `handbag` (owned) — both always filled, overlapped at 45°, active icon bottom-left on top (dimmed behind). Three-state cycle, click anywhere: **All → Owned → Cloud → All**. Both dimmed = all.

### FilterBar

Flex-wrap, no clipping; controls grouped. Filter group order: **heart | rating | tempo | key | year | ownership | search**.
