# Editor Robustness & Features — Implementation Plan

## Goal
Refactor song edit save model, fix list-edit sync, add sort, ID-based tracking, history diff.

## Completed (previous session)
- Effect-based auto-save (800ms, `useEffect` watching all state)
- Unmount flush via `latestRef` + `mutateRef` for song-switch safety
- Removed all inline save calls from handlers
- Comma-split paste for styles Autocomplete
- History section with `useQuery` + `fetchSongHistory`
- Fixed `updateSongMetadata` missing artist/title fields server-side

## Grilling Outcomes (this session)
These are the settled decisions. Implementation follows.

### 1. ID-based selection + auto-select first
- `useEditMode`: `selectedId: string | null`, `selectId(id)`, no nav helpers
- `EditLayout`: handles arrow keys internally via `findIndex`, auto-selects first song on enter (effect — `songs.length > 0 && (!selectedId || stale)`)
- `CompactSongTable`: highlight by `song._id === selectedId`, `onSelect(id)`

### 2. Edit navigation: frozen songIds snapshot
- On enter edit mode, capture `songIds = songs.map(s => s._id!)`
- Navigation (arrow keys) iterates `songIds` by index
- List renders from live `songs` array: `songs.find(s => s._id === songIds[i])`
- `EditLayout` holds `songIds` state, no re-fetch during edit

### 3. Sort (before edit mode only)
- Clickable column headers on `SongTable`: Artist, Title, BPM, Key, Rating
- Click cycles asc→desc→asc. No clear. No multi-sort.
- Default: `rating: -1` (highest first). Server fallback when no sort param.
- Sort param via `ApiSongParams.sort`/`.sortOrder`. Changing sort resets page to 1.
- Sort controls hidden/disabled during edit mode (edit view inherits sort from entry).

### 4. Live list refresh during edit
- Mutation `onSuccess`: `setQueriesData({ queryKey: ['songs'] }, updater)` — finds song by `_id` in `data[]`, replaces in-place
- No re-sort on update — just object replacement
- `invalidateQueries` on exit confirmed unnecessary (cache is accurate) — removed from plan
- Export-to-Apple-Music also patches cache after write

### 5. Content-based history dedup (server, all write paths)
- Extract shared helper `createHistoryEntry(songId, sourceType, snapshot, importMeta?)`:
  - Get last history entry for song (any sourceType)
  - If snapshot identical → skip (no entry created)
  - If last entry has same sourceType and <5 min old → update in-place
  - Otherwise → create new entry
- Replace all three inline `HistoryEntry.create` calls (import-upsert, import-create, manual-edit) with helper
- Import scripts also benefit from dedup

### 6. History diff rendering (UI)
- Compare each entry snapshot with previous. Show only changed fields.
- Fields: scalar values as text (`bpm: 128`), arrays as token pills (`genres: [Techno] [Minimal]`)
- First entry: show date+source only (values visible in form above)
- Rating: raw number
- Server prevents identical-consecutive entries, so UI doesn't need to handle that case

### 7. Error / save-failure UI
- Simple inline text, shared message area with export errors (same screen location)
- Show "Save failed" when `saveMutation.isError`. Auto-clears on next successful save.
- Later: enhance to toast component

### 8. Removed from plan
- **Escape key exit**: use button only
- **Bulk edit**: deferred
- **CompactSongTable sort indicators**: deferred
- **`invalidateQueries` on edit exit**: redundant with cache patch

## Implementation Order
1. Server: extract `createHistoryEntry` helper, replace all inline history writes
2. Server: change default sort from `createdAt: -1` to `rating: -1`
3. UI: add fire `songIds` snapshot to `EditLayout`
4. UI: wire `setQueriesData` on mutation `onSuccess` (save + export)
5. UI: add save-error inline text to `SongEditForm`
6. UI: hide sort controls during edit mode
7. Lint, verify

## Open Questions (none remaining — all resolved in grill)
