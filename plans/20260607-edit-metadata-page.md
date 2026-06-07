# Edit Metadata Page

## Goal

Replace edit-as-mode-overlay with a proper page at `/edit-metadata`. The edit button on Artist/GenreDetail pages navigates here with current search criteria as URL params. Filters are read-only — they reflect what brought you here but cannot be changed. Songs sorted by artist ascending by default (foundation for future source-page sort passthrough). No shuffle, no pagination. Centralized URL builder module handles all navigation between view and edit pages. Snapshot diff computation moved to server.

---

## Design

### URL conventions

**Edit URL:**
```
/edit-metadata?artist.any=Aphex+Twin&fromViewType=artist
```

Params:
- All filter criteria from the originating page: `genre.all`, `genre.any`, `genre.not`, `artist.any`, `bpm.gte`, `bpm.lte`
- Source page indicator: `fromViewType` = `artist` | `genre` | `home` (tells the URL builder which page to reconstruct on exit)
- `sort`, `sortDirection`, `shuffle`, `page`, `limit` are explicitly stripped — edit page uses its own default sort (artist asc), no shuffle, no pagination, return to page 1

**No `return` URL param.** The edit page reconstructs the view URL from its own params via the centralized URL builder.

### URL builder module

**New file:** `src/ui/src/utils/urlBuilder.ts`

```typescript
type ViewType = 'artist' | 'genre' | 'home';

// Called by view pages to generate the edit link
export function buildEditUrl(
  currentSearch: string,
  viewType: ViewType,
  pathParams: {
    genreAll?: string;
    genreAny?: string;
    artistAny?: string;
  },
): string;

// Called by EditMetadata to reconstruct the view URL for "Done"
export function buildViewUrl(
  editSearch: string,
): string;
```

**`buildEditUrl`** takes the current view page's search string, the view type, and any path-derived params. It:
1. Cleans out internal params (`edit`, `page`, `limit`, `sort`, `sortDirection`, `shuffle`) — preserves filter criteria only
2. Sets `fromViewType` to the view type
3. Sets path-derived params (`artist.any`, `genre.all`, `genre.any`) if not already in the URL
4. Returns `/edit-metadata?<params>`

**`buildViewUrl`** takes the edit page's search string and:
1. Reads `fromViewType` — if missing or unknown, infers from available params: `artist.any` → artist, else `genre.all`/`genre.any` → genre, else home
2. Strips internal params (`fromViewType`, `edit`)
3. Reconstructs the full view URL: path from view type + remaining params as query string
4. No `page`/`limit` in the return URL (stripped on entry)
5. Handles edge cases: missing path params for the inferred view type fall back to `/`

### EditMetadata page layout

```
+-----------------------------------------------------------------+
| [Home] [<-- Done]  Editing N songs    [BPM: 120--140] (read-only)|
| [genre excludes: Pop, Rock] (read-only)                          |
+-------------------------------------+----------------------------+
| CompactSongTable                    | SongEditForm               |
| (scrollable, sort by artist asc)    | (auto-save 800ms debounce) |
|                                     | [edit history accordion]   |
|                                     | (server-provided diffs)    |
|                                     | [Save to Apple Music btn]  |
+-------------------------------------+----------------------------+
```

- Top row: FilterBar with `doneHref` (computed by `buildViewUrl`), read-only BPM and genre excludes
- Song limit: 500 (server MAX_LIMIT increased to 500)
- Sort: artist ascending by default via `useSortShuffle`. No interactive sort controls yet
- Edits to artist name reorder the list; `selectedId` persists and tracks the song to its new position
- No pagination, no shuffle, no filter editing
- Songs fetched once on mount with the URL-encoded criteria — no re-fetch on filter change (filters are fixed)
- Selection is ephemeral: auto-selects first song on load, no URL persistence
- Error state: shows "Failed to load songs" if `useSongs` errors

### FilterBar changes

**Props interface:**

```typescript
interface FilterBarProps {
  // Navigation (mutually exclusive)
  editHref?: string;   // pencil link → edit page
  doneHref?: string;   // back arrow ← from edit page

  // Read-only mode
  readOnly?: boolean;  // when true, BPM inputs/exclude controls are inert

  // BPM range (optional, for pages that support filtering)
  bpmGte?: number;
  bpmLte?: number;
  onBpmChange?: (gte?: number, lte?: number) => void;

  // Genre excludes (optional)
  genreNot?: string[];
  onRemoveExclude?: (genre: string) => void;

  // Shuffle (optional, for pages that support shuffle)
  onShuffleToggle?: () => void;

  // Misc
  songCount?: number;
  className?: string;
}
```

**Behavior changes:**
- Removed `editMode?: boolean` and `onEditToggle?: () => void`
- Added `readOnly?: boolean`, `editHref?: string`, `doneHref?: string`
- When `readOnly` is true: BPM inputs are `disabled`, genre exclude chips lose click handlers, no shuffle button
- `editHref` and `doneHref` are mutually exclusive; `editHref` renders a pencil icon `<Link>`, `doneHref` renders a back arrow `<Link>`

### Navigation flow

```
Artist page                                    GenreDetail page
|                                              |
| urlBuilder.buildEditUrl(                     | urlBuilder.buildEditUrl(
|   location.search,                           |   location.search,
|   'artist',                                  |   'genre',
|   { artistAny: artistName }                  |   { genreAll: genreExpr }
| )                                            | )
| navigates to:                                | navigates to:
| /edit-metadata?                              | /edit-metadata?
|   artist.any=...&                            |   genre.all=...&
|   fromViewType=artist                        |   fromViewType=genre
+------------------+---------------------------+
                   |
                   v
          EditMetadata page
                   |
                   | urlBuilder.buildViewUrl(location.search)
                   | returns: /artist/Name?bpm.gte=...&genre.not=... (filter params only, no sort/page)
                   |
                   | [<-- Done] → navigates to buildViewUrl result
                   | No cache invalidation needed:
                   |   patchSongsCache already updates all songs caches
                   v
          Originating page (fresh cache data)
```

---

## Step-by-step

### Step 1 — Create `urlBuilder.ts`

**File:** `src/ui/src/utils/urlBuilder.ts` (new)

Centralized URL generation for view ↔ edit navigation. Two exported functions:
- `buildEditUrl(currentSearch, viewType, pathParams)` → edit page URL
- `buildViewUrl(editSearch)` → view page URL

Edge cases handled:
- Missing `fromViewType` → infer from available params: `artist.any` → artist, else `genre.all`/`genre.any` → genre, else home
- `fromViewType` with no matching path params (e.g., `fromViewType=artist` but no `artist.any`) → fall back to `/`
- Unknown viewType → same as missing (infer from params)
- `page`/`limit`/`sort`/`sortDirection`/`shuffle` stripped by `buildEditUrl` — edit page uses its own sort default (artist asc), no shuffle, no pagination

Uses `URLSearchParams` for all param manipulation — no regex.

### Step 2 — Update FilterBar

**File:** `src/ui/src/components/FilterBar.tsx`

- Remove `editMode`, `onEditToggle` from props
- Add `readOnly?: boolean`, `editHref?: string`, `doneHref?: string`
- When `readOnly`:
  - BPM inputs rendered with `disabled` attribute
  - Genre exclude chips rendered as plain text/spans, no click handlers
  - No shuffle button
- `editHref` renders `<Link to={editHref}>` with pencil icon (no active state, just navigation)
- `doneHref` renders `<Link to={doneHref}>` with back-arrow icon
- Remove `FilterBar-edit--active` from CSS if it exists

### Step 3 — Clean up Artist.tsx and GenreDetail.tsx

**Files:** `src/ui/src/pages/Artist.tsx`, `src/ui/src/pages/GenreDetail.tsx`

Remove:
- `useEditMode` import and usage
- `editToggleRef`, `prevEditActive` refs and associated effects
- Keyboard shortcut `useEffect` for `e` key
- `isInputFocused` helper
- `queryClient.invalidateQueries` on edit exit
- Edit mode conditional render block
- `queryClient` import (if no longer used)

Add:
- Import `buildEditUrl` from `urlBuilder`
- Compute `editHref` using `buildEditUrl(location.search, viewType, pathParams)`
- Pass `editHref` to FilterBar

### Step 4 — Create EditMetadata page

**File:** `src/ui/src/pages/EditMetadata.tsx` (new)

- Uses `useSortShuffle` for sort state. The hook accepts optional default overrides; on the edit page it's called with `{ defaultSortField: 'artist', defaultSortDirection: 'asc' }`. Future iteration: stop overriding defaults to respect source-page sort passthrough
- Does NOT use `useFilters` — no interactive filter state needed
- Displays FilterBar with `readOnly={true}`, `doneHref` from `buildViewUrl(location.search)`
- Fetches songs with `useSongs(params)` where sort derived from useSortShuffle, filters from URL
- Auto-selects first song on load (ephemeral `useState<string | null>`). Artist renames reorder the list but selectedId persists — the song stays selected in its new position
- **No cache invalidation on unmount** — `patchSongsCache` handles all cache updates
- Error branch: renders error message when `useSongs` returns error
- Loading branch: renders loading indicator

### Step 5 — Add route in App.tsx

**File:** `src/ui/src/App.tsx`

```tsx
<Route path="/edit-metadata" element={<EditMetadata />} />
```

### Step 6 — Increase MAX_LIMIT to 500

**File:** `src/api/src/helpers/pagination.ts`

`MAX_LIMIT = 200` → `500`

### Step 7 — Delete useEditMode hook

**File:** `src/ui/src/hooks/useEditMode.ts` — delete.

Also remove any remaining references to `useEditMode` across the codebase (check imports).

### Step 8 — Move snapshot diff computation to server

**Files:**
- `src/api/src/routes/songs.ts` or a controller
- `src/ui/src/components/SongEditForm.tsx`
- `src/ui/src/api/client.ts`

**Server change:** Modify `GET /api/songs/:id/history` response to include a pre-computed `diff` field. The diff compares each entry's snapshot against the previous entry (sorted newest-first, so compare entry[i] with entry[i+1] which is older). Format:

```typescript
interface HistoryEntryWithDiff extends HistoryEntry {
  diff: Array<{
    field: string;    // one of: title, artist, genres, grouping, bpm, key, rating, year, favorite
    value: string | string[];
  }>;
}
```

The oldest entry (last in array, no successor to compare against) gets `diff: []`.

**Client change:** Remove `computeSnapshotDiff`, `SnapshotDiff` interface, `DIFF_FIELDS` constant from `SongEditForm.tsx`. Replace history JSX to render `entry.diff` directly from the server. Update `HistoryEntry` type in `client.ts` to include optional `diff` field.

---

## Files summary

| File | Action |
|------|--------|
| `src/ui/src/utils/urlBuilder.ts` | Create (centralized URL gen) |
| `src/ui/src/pages/EditMetadata.tsx` | Create |
| `src/ui/src/components/FilterBar.tsx` | Add `readOnly`, `editHref`, `doneHref`; remove `editMode`, `onEditToggle` |
| `src/ui/src/pages/Artist.tsx` | Remove edit mode; use `buildEditUrl`; pass `editHref` |
| `src/ui/src/pages/GenreDetail.tsx` | Remove edit mode; use `buildEditUrl`; pass `editHref` |
| `src/ui/src/App.tsx` | Add `/edit-metadata` route |
| `src/api/src/helpers/pagination.ts` | Increase `MAX_LIMIT` to 500 |
| `src/ui/src/hooks/useEditMode.ts` | Delete |
| `src/api/src/routes/songs.ts` | Add `diff` computation to history endpoint |
| `src/ui/src/components/SongEditForm.tsx` | Remove client-side diff logic; use server-provided diffs |
| `src/ui/src/api/client.ts` | Add `diff` field to `HistoryEntry` type |
| `src/ui/src/hooks/useSortShuffle.ts` | Accept optional `{ defaultSortField, defaultSortDirection }` |

**No changes:** EditLayout, CompactSongTable, SongTable, useFilters.ts, useSongs.ts, queryClient.ts, any models or services beyond the history route.
