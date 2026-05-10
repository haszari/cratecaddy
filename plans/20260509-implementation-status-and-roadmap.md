# Crate Caddy: Implementation Status & Roadmap

Date: 2026-05-09

## What's Implemented (committed)

### Artist Page (complete)
- `src/ui/src/pages/Artist.tsx` — basic artist detail page with song list
- `src/ui/src/hooks/useSongsByArtist.ts` — filter songs by artist substring
- Linking from song artist names to artist page
- Fuzzy matching: artist name matched anywhere in artist or title field

### Sources Column with Cloud/Lossless Icons
- `src/ui/src/components/SourcesIcons.tsx` — per-source icons in song table
- Shows local file icon when no Apple Music source exists

### React Query Integration
- Refactored all data fetching to `@tanstack/react-query`
- Custom hooks (`useSongs`, `useSongsByArtist`, `useSongsByGenre`)
- Centralised API client in `src/ui/src/api/client.ts`
- Query key caching per filter configuration

### Genre Deduplication
- Pre-save hook normalises genre arrays (removes duplicates within same song)

### Musical Key Support
- `key` field on Song model, importable from rekordbox/djayPro
- Merge operations handle key updates

### Import Scripts
- Apple Music import (primary, filters to DJing/Listening grouping)
- Rekordbox import (experimental, includes key)
- djayPro import (experimental, includes key)
- Import flow documented in `QUERY_DB.md`

---

## What's Implemented (uncommitted — server-side filters + pagination)

### Backend — Filter Engine (`src/api/src/helpers/buildSongFilter.ts`)
- Dot-qualified param encoding: `genre.any`, `genre.all`, `genre.not`, `artist.any`, `artist.all`, `artist.not`
- Bare param sugar (`genre=X` → `genre.any`, `artist=X` → `artist.any`)
- `bpm.gte` / `bpm.lte` range filtering (not in original plan)
- `search` param for free-text across artist + title + genres
- Regex matching with escaped special characters
- All param groups AND-ed at top level

### Backend — Pagination (`src/api/src/helpers/pagination.ts`)
- `page` (1-indexed, default 1), `limit` (default 50, max 200)
- `shuffle=<seed>` for deterministic random ordering (not in original plan — was Phase 5)
- `shuffle=true` auto-generates a seed

### Backend — Service & Controller
- `songService.querySongs()` — builds filter + pagination, runs `find().skip().limit()` or aggregate pipeline for shuffle
- `songService.getFilteredGenreStats()` — prepends `$match` stage to genre aggregation
- `songController.getAllSongs()` and `getGenreStats()` — extract filter/pagination from query params

### Frontend — API Client & Types
- `PaginatedResponse<T>` interface in types
- `fetchSongs(params)` builds query string from dot-qualified params
- `fetchGenreStats(params)` same interface for stats endpoint
- `buildQueryString()` skips undefined/null/empty values

### Frontend — Hooks
- `useSongs(params?)` — React Query with filter-aware cache keys
- `useSongsByGenre(genre, page)` — wraps `useSongs` with `genre.any`
- `useSongsByArtist(artist, page)` — wraps `useSongs` with `artist.any`

### Frontend — Pages
- **Home.tsx**: Tag cloud from `fetchGenreStats()` (no more fetching all songs). Paginated song table for filtered results. Uses `useFilters` for URL-persisted filter state.
- **GenreDetail.tsx**: Server-side filtered songs with pagination. Filtered genre stats for related tags. Shuffle support. Uses `useFilters`.
- **Artist.tsx**: Same pattern as GenreDetail but for artist. Uses `useFilters`.

### Frontend — Components
- **SongTable.tsx**: Optional pagination controls (prev/next, page indicator). Rating-sorted display.
- **GenreTag.tsx**: Pill-shaped component with add (left) / remove (right) buttons + clickable label linking to genre detail.
- **GenreTagCloud.tsx**: Renders sorted tag cloud with include/exclude handlers.
- **FilterBar.tsx**: Displays active filter chips (include=green, exclude=red), BPM range inputs, clear button.
- **ShuffleControl.tsx**: Toggle shuffle on/off, reseed button.

### Frontend — Filter State Management
- `useFilters` hook (`src/ui/src/hooks/useFilters.ts`): URL search param-persisted state for `genre.all`, `genre.not`, `bpm.gte`, `bpm.lte`, `shuffle`
- Auto-initialises shuffle seed on first visit
- `addInclude`, `addExclude`, `removeInclude`, `removeExclude`, `setBpmRange`, `toggleShuffle`, `reshuffle`, `clearFilters`

---

## Design Decisions (captured for future reference)

### URL Conventions (path vs query params)

**Genre AND filters** — encoded in URL path with `+` separator:
- Single: `/genre/Techno`
- Multiple: `/genre/BAM+Techno+Deep`
- All path segments are decoded and passed as `genre.all` to API (AND semantics)
- Displayed as large orange pills at top of page
- `+` on a related tag appends to path; `✕` removes from path
- Removing the last AND genre navigates to `/`

**Artist** — artist name in path (first component), genre.all as query param:
- `/artist/Bailey` (with optional `?genre.all=Techno,House`)
- Artist name displayed as heading at top
- Genre.all from query params displayed as AND pills below artist name

**Other filters — URL search params:**
- `genre.not` — comma-separated exclude genres
- `bpm.gte` / `bpm.lte` — numeric range
- `shuffle=<seed>` — stable pseudo-random sort via MongoDB `$function`

**BPM Range** — shows with no/null BPM always included (the filter is opt-in narrowing).

**Navigation rule**: clicking a genre tag from Home or any page starts fresh with no preserved URL params. Only `+`/`-` on the current page's related tags appends to the existing filter context.

---

## Known Bugs & Polish Items

### Polish
- [ ] **FilterBar fixed header**: Currently positioned inline with `margin-bottom`. Should be `position: fixed; top: 0; z-index: ...` with content offset so it's always visible during scroll.
- [ ] **Page reset on filter change**: When user changes filters (adds/removes genre tag), pagination page should reset to 1. Currently page state persists independently.
- [ ] **Shuffle/GenreDetail uniqueness**: Songs can appear multiple times in shuffled results (no dedup). Should track which songs have been shown and exclude them, or use a different approach.
- [ ] **Loading states**: Paginated transitions could show skeleton rows instead of full-page loading indicator.
- [ ] **Empty state**: When a genre/artist has no songs after filtering, the empty state is just "Loading songs..." (no explicit "No songs found" message).
- [ ] **BPM input UX**: BPM inputs update on blur/Enter only; no live preview of current range in the input fields (sync from URL state on page load). `FilterBar` has a `useEffect` to sync but edge cases exist.
- [ ] **GenreTag count display**: GenreTag shows count when `tagCount > 1` but the tag cloud uses it for popularity scaling. In SongTable rows, count is always 0 (never displayed). This is correct but potentially confusing.
- [ ] **Artist heading**: Artist page has no heading/title showing the artist name (unlike GenreDetail which shows the genre as a heading tag).
- [ ] **Console errors**: Verify no React key warnings or other console noise.

### Edge Cases
- [ ] **Page beyond range**: Currently returns empty data array with correct total — works but no user-facing message.
- [ ] **Invalid page/limit params**: Falls back to defaults silently. No user feedback.
- [ ] **Extremely long genre/artist values**: Could cause URL length issues when persisted to search params.
- [ ] **Concurrent filter changes**: Rapid clicking of include/exclude buttons could cause stale closure issues with `setSearchParams`.

---

## Deferred / Future Scope

### Near-term
- [ ] **"Any" filter mode UI**: GenreTag cloud only supports "all" (include) and "not" (exclude). No UI to add "any" filters (multiple genres, match any).
- [ ] **Search bar**: Free-text search across artist+title+genres. Backend param exists (`search`) but no UI.
- [ ] **Persist page in URL**: Page number should be in search params so browser back/forward works with pagination. Currently `page` is local `useState` only.
- [ ] **Portable offline JSON mode**: Export/import song collection as JSON for use without MongoDB.

### Medium-term
- [ ] **Server-side search endpoint**: Currently UI fetches all filtered songs and client-sorts. Could add `GET /api/songs/search` with full-text index.
- [ ] **Song detail / edit page**: Click into a song to view full metadata, edit genres, sources, etc.
- [ ] **Bulk operations**: Tag multiple songs, merge duplicates, etc.
- [ ] **Playlist support**: Import and view Apple Music playlists.

### Long-term / Experimental
- [ ] **Audio preview**: Preview tracks via Apple Music API or local files.
- [ ] **Smart playlists**: Filter-based saved views (e.g. "Unrated techno > 120 BPM").
- [ ] **Visualisation**: Genre relationship graph, BPM distribution chart, etc.
- [ ] **Mobile-friendly layout**: Currently desktop-optimised.
- [ ] **Accessibility audit**: Keyboard navigation, screen reader support, colour contrast.

---

## Architecture Notes (for next agent)

- All frontend filter state lives in URL search params via `useFilters` hook. FilterBar, GenreTagCloud, ShuffleControl all read/write through this hook.
- Backend filter params use dot-qualified keys (`genre.any`, `bpm.gte`). The `buildSongFilter` helper parses these into Mongoose `FilterQuery`.
- The `useSongs` hook accepts the same param shape as the API, simplifying the bridge between URL state and API calls.
- Two new files uncommitted: `src/api/src/helpers/buildSongFilter.ts`, `src/api/src/helpers/pagination.ts`
- Three new components uncommitted: `FilterBar`, `ShuffleControl`, `useFilters` hook
- SongTable and all pages have uncommitted changes
- Original plan document: `.opencode/plans/20260509-server-side-filters-and-pagination.md`
