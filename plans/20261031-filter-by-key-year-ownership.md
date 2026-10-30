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

- Add shared key module (reversible note↔Camelot + distance) under `src/api/src/helpers/`, consumed by both filter implementations and the UI via the `@cratecaddy-api` alias.
- Params: `key` (target key) + `key.tolerance` (±N steps on the Camelot wheel).
- Matching: compute the set of keys within N steps of the target (both A and B wheels), filter `key ∈ set`. No schema change.
- UI: Mantine control (centre key + tolerance stepper), mirroring the tempo range pattern.

### Key sort (Camelot/similarity)

- Open: absolute Camelot order, or distance-from-selected-key when a key filter is active. Mongo sort needs a stored/computed value — see open questions.

### Year filter

- Params: `year.gte` / `year.lte` (numeric range, same shape as bpm/rating).
- UI: Mantine range control (centre + spread, or explicit min/max slider).

### Ownership filter

- UI: Mantine `SegmentedControl` — All / Owned / Streaming.
- Wire `ownership` into `FilterState`, `buildApiParams`, `clearFilters`, `hasActiveFilters`, `FilterBar`.
- Static build: snapshot is owned-only by default — decide whether to show the control there.

## 4) Open questions (to grill)

1. Key tolerance semantics — Camelot steps (max ±6), or semitone distance?
2. Key sort — absolute Camelot order, or distance from the filtered key?
3. Key sort implementation — store derived Camelot field (backfill), or compute in-memory / aggregation?
4. Year tolerance UX — centre+spread (like tempo) or explicit min/max range?
5. Ownership in static build — hide (snapshot is owned-only) or show?
6. Control placement — extend the FilterBar row, or move filters into a popover?

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
