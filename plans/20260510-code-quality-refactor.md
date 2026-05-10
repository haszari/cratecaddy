# Code Quality & Architecture Refinements

## Goals

- Remove dead/wire-duplicating API params (`genre`, `artist` shorthands)
- Share API param type definitions between backend and frontend via a single canonical file
- Extract inline MongoDB hash function for syntax highlighting and seed parameterization
- Fix `artist.any` to also search `title` (find remixes/collaborations)
- Rename ambiguous `genreAll` variables on Artist page
- Extract shared `PageCriteria` component to unify page top sections

## Files to Create

### `src/api/src/helpers/apiParams.ts` — Canonical API param types + key arrays

```typescript
export interface ApiFilterParams {
  'genre.any'?: string;
  'genre.all'?: string;
  'genre.not'?: string;
  'artist.any'?: string;
  'artist.all'?: string;
  'artist.not'?: string;
  'bpm.gte'?: string;
  'bpm.lte'?: string;
  search?: string;
}

export interface ApiPaginationParams {
  page?: string;
  limit?: string;
  shuffle?: string;
}

export type ApiSongParams = ApiFilterParams & ApiPaginationParams;
export type ApiGenreStatsParams = ApiFilterParams;

export const FILTER_PARAM_KEYS: (keyof ApiFilterParams)[] = [
  'genre.any', 'genre.all', 'genre.not',
  'artist.any', 'artist.all', 'artist.not',
  'bpm.gte', 'bpm.lte', 'search',
];

export const PAGINATION_PARAM_KEYS: (keyof ApiPaginationParams)[] = [
  'page', 'limit', 'shuffle',
];
```

### `src/api/src/helpers/shuffleHash.ts` — Extracted hash function builder

The function body is unavoidably a string literal — MongoDB `$function` evaluates JS
in the database engine, not in Node. It must be passed as a string to the aggregation
pipeline. A comment at the top of the module documents this constraint.

```typescript
/**
 * Build a hash function body for MongoDB $function aggregation.
 * The function runs inside MongoDB's JS engine, not Node.js, so the body
 * must be a string. The seed is injected at build time via JSON.stringify
 * to avoid closure issues in the mongo eval context.
 */
export function buildShuffleHashFunction(seed: string): string {
  return `function(id) {
    var hash = 0;
    var s = ${JSON.stringify(seed)};
    var str = id + s;
    for (var i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash);
  }`;
}
```

### `src/ui/src/components/BasePageCriteria.tsx` + `BasePageCriteria.scss`

Shared component that renders the base/"start condition" criteria at the top of detail pages — the terms from the URL route that define what the user is browsing. Named `BasePageCriteria` because additional filters (BPM range, genre exclusion, shuffle) build on top of this starting point.

Pills render inside a `<div className="PageCriteria">` to maintain the existing flex-centered layout (gap, flex-wrap, centering). The heading is rendered outside this wrapper as a standalone `<h2>`, matching the previous page structure.

#### Props

```typescript
interface BasePageCriteriaProps {
  /** Artist name(s) displayed as inline heading text */
  artists?: string[];
  /** Genre filter chips rendered as clickable pills */
  genres?: { name: string; mode: 'and' | 'or' }[];
  /** Called when a genre pill is clicked (remove from criteria) */
  onRemoveGenre?: (genre: string) => void;
}
```

#### Rendering logic

The heading renders as a standalone `<h2>`. Pills are wrapped in `<div className="PageCriteria">` for flex-centered layout — this matches the previous page structure for both Artist and GenreDetail.

1. **If `artists` is non-empty**: renders each as `<h2 className="GenreTag-heading">` (styled like current Artist page heading, `fontSize: '2.5em'`). Multiple artists each get their own h2.
2. **If `genres` is non-empty**: renders a `<div className="PageCriteria">` containing pills. For each genre:
   - AND mode → orange `.genre-pill--and` class
   - OR mode → sage green `.genre-pill--or` class; inserts `<span class="or-separator">or</span>` before each pill after the first
   - All pills are clickable (calls `onRemoveGenre(genre.name)`)
3. **If both empty**: renders `null` (nothing at all).
4. If only one is provided, only that section renders.

#### Example use

GenreDetail page — viewing `/genre/Techno+Minimal`:
```tsx
<BasePageCriteria
  genres={[
    { name: 'Techno', mode: 'and' },
    { name: 'Minimal', mode: 'and' },
  ]}
  onRemoveGenre={(g) => {
    const remaining = decodedGenres.filter(
      (dg) => dg.toLowerCase() !== g.toLowerCase()
    );
    if (remaining.length === 0) navigate(withSearch('/'));
    else navigate(withSearch(`/genre/${remaining.map(encodeURIComponent).join('+')}`));
  }}
/>
```
Renders (replacing GenreDetail.tsx lines 101-114):
```html
<div class="PageCriteria">
  <span class="genre-pill genre-pill--and">Techno</span>
  <span class="genre-pill genre-pill--and">Minimal</span>
</div>
```

Artist page — viewing artist "Luna Echo" with genre AND-filter "House":
```tsx
<BasePageCriteria
  artists={['Luna Echo']}
  genres={[{ name: 'House', mode: 'and' }]}
   onRemoveGenre={(g) => handleRemoveRequired(g)}
/>
```
Renders (replacing Artist.tsx lines 109-126):
```html
<h2 class="GenreTag GenreTag-heading" style="font-size: 2.5em">Luna Echo</h2>
<div class="PageCriteria">
  <span class="genre-pill genre-pill--and">House</span>
</div>
```

Home page — not used. The home page shows all genres as a tag cloud, not a filter context header. No change needed.

## Files to Modify

### Backend

| File | Change |
|------|--------|
| `src/api/src/helpers/buildSongFilter.ts` | Remove `genre`/`artist` shorthand params from interface and condition logic; import `ApiFilterParams`; expand `artist.any` to search `artist` OR `title` fields; re-export any needed types from `apiParams.ts` |
| `src/api/src/controllers/songController.ts` | Import `FILTER_PARAM_KEYS`, `PAGINATION_PARAM_KEYS`, `ApiFilterParams` from `apiParams.js`; delete local `FILTER_KEYS`/`PAGINATION_KEYS`; replace `SongFilterParams` import |
| `src/api/src/helpers/pagination.ts` | Import `ApiPaginationParams` from `apiParams.js`; delete or re-export local `PaginationParams` |
| `src/api/src/services/songService.ts` | Import `ApiFilterParams` from `apiParams.js`; import `buildShuffleHashFunction` from `shuffleHash.js`; replace inline hash template string with function call |

### Frontend

| File | Change |
|------|--------|
| `src/ui/src/api/client.ts` | Import `ApiSongParams`, `ApiGenreStatsParams` from `@cratecaddy-api/apiParams`; remove local `FetchSongsParams`/`FetchGenreStatsParams`; remove `genre`/`artist` entries from `buildQueryString` |
| `src/ui/src/hooks/useSongs.ts` | Import and use `ApiSongParams` for the hook parameter type |
| `src/ui/src/hooks/useSongsByArtist.ts` | Import `ApiSongParams` for typing |
| `src/ui/src/hooks/useSongsByGenre.ts` | Import `ApiSongParams` for typing |
| `src/ui/src/pages/Artist.tsx` | Rename `genreAll` → `requiredGenres`; use `<BasePageCriteria>` component; import `ApiSongParams` |
| `src/ui/src/pages/GenreDetail.tsx` | Use `<BasePageCriteria>` component; import `ApiSongParams` |
| `src/ui/src/vite.config.ts` | Add `resolve.alias` for `@cratecaddy-api`: `path.resolve(__dirname, '../api/src/helpers')` |
| `src/ui/tsconfig.app.json` | Add `baseUrl: "."`, `paths: { "@cratecaddy-api/*": ["../api/src/helpers/*"] }` |

## Details

### Issue 1: Remove `genre` / `artist` shorthand params

These are unused aliases for `genre.any`/`artist.any`. Remove from:
- `SongFilterParams` interface in `buildSongFilter.ts`
- `?? params.genre` and `?? params.artist` fallback expressions (lines 72, 88)
- `FetchSongsParams` and `FetchGenreStatsParams` in `client.ts`
- `buildQueryString` entries array in `client.ts` (lines 28, 32)

### Issue 2: Share API param definitions

Single source of truth at `src/api/src/helpers/apiParams.ts`. Backend imports with `.js` extension. Frontend imports via `@cratecaddy-api` alias (configured in `vite.config.ts` + `tsconfig.app.json`).

### Issue 3: Extract hash function

Move the hard-coded string-literal JS function from `songService.ts:266-275` to `shuffleHash.ts`. Import and call in the aggregate pipeline. The seed is already parameterized — this just gives it syntax highlighting and clean separation.

### Issue 4: artist.any searches title too

Currently `artist.any` only matches the `artist` field. Expand to match both `artist` AND `title` fields (via `$or` over both fields for each value). This preserves the intent (find songs by this artist) while also surfacing remixes and collaborations where the name appears in the title.

`artist.all` and `artist.not` remain searching only the `artist` field.

### Issue 5: Rename `genreAll` on Artist page

`genreAll` reads like "all genres" but refers to `genre.all` AND-filter genres (the genres required to match). Rename to clarify:

| Current | New | Rationale |
|---------|-----|-----------|
| `genreAll` (line 42) | `requiredGenres` | These genres are *required* on matching songs (AND semantics) |
| `genreAllParam` (line 49) | `requiredGenresParam` | CSV string for the `genre.all` API param |
| `handleAddInclude` (line 83) | `handleAddRequired` | Adds a genre to the required filter |
| `handleRemoveInclude` (line 94) | `handleRemoveRequired` | Removes a genre from the required filter |

### Issue 6: BasePageCriteria component

Extract the duplicated patterns from `Artist.tsx` and `GenreDetail.tsx`:
- Genre pills (Artist lines 113-126, GenreDetail lines 101-114)
- Artist `<h2>` heading (line 109) included as optional `artistName` prop
- Genre pill mode coloring (orange for AND, sage green for OR) and "or" separators baked in
- On remove, each page injects its own navigation/removal logic via callback

## Files Not Changed

- `src/api/src/models/Song.ts` — types here are for documents, not API params (separate concern)
- `src/api/src/server.ts` — no changes needed
- `src/api/src/config/database.ts` — no changes needed
- `src/ui/src/types/index.ts` — keeps `Song`, `TagInfo`, `PaginatedResponse` (app-level types, not API params)
- `src/ui/src/hooks/useFilters.ts` — uses `URLSearchParams` directly, not API param types
- `src/ui/src/components/FilterBar.tsx` — no changes needed
- `src/ui/src/components/GenreTag.tsx` — no changes needed (BasePageCriteria will reuse its patterns)
- `src/ui/src/components/GenreTagCloud.tsx` — no changes needed
- `src/ui/src/components/ShuffleControl.tsx` — no changes needed
- `src/ui/src/components/SongTable.tsx` — no changes needed
- `src/ui/src/components/SourcesIcons.tsx` — no changes needed
