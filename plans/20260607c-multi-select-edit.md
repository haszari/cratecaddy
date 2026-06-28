# Multi-Select Edit (Revised)

Multi-select songs in the edit page and apply batch changes — add/remove genres, set scalar metadata uniformly, with explicit save (no auto-save).

---

## Component Naming

- `SongEditForm` → **`SingleSongMetadataEditForm`** (single-song auto-save form)
- `MultiSongMetadataEditForm` → **`MultiSongMetadataEditForm`** (multi-song explicit-save form)
- Both live under `src/ui/src/components/`; same styling and layout conventions

---

## Selection Model

### State
- `EditMetadata.tsx`: `selectedIds: Set<string>` replaces `selectedId: string | null`
- `EditLayout.tsx`: receives `selectedIds` and `onSelect` from parent

### Click Behaviour
- **No modifier**: Single-select — clear all others, select this one
- **Cmd (macOS) / Ctrl (other)**: Toggle this song, keep others
- **Shift**: Range-select — extends selection to a contiguous range from the
  nearest boundary of the current selection to the clicked row. See details
  below.
- **No checkboxes**: Click the row itself triggers selection logic

### Range Select — Boundary Extension
Shift-click extends the current selection to a contiguous range from the
nearest selection boundary to the clicked row:

1. Find the min and max indices of the current selection in the songs array
2. Let `clickedIdx` be the clicked row's index
3. If `clickedIdx < minSelected` → select from `clickedIdx` to `maxSelected`
   (extends the top boundary upward)
4. If `clickedIdx > maxSelected` → select from `minSelected` to `clickedIdx`
   (extends the bottom boundary downward)
5. If `minSelected <= clickedIdx <= maxSelected` → select the full range from
   `minSelected` to `maxSelected` (fills any gaps in the existing selection)

The result is always a contiguous range. This works regardless of whether the
current selection was built via shift-click (contiguous) or cmd-click (possibly
non-contiguous).

### Range Select — Implementation (Single Operation)
- `CompactSongTable` detects shift-click and calls `onSelect(clickedId, 'range')`
  once — no individual toggles.
- `EditMetadata.handleSelect('range')` receives the clicked ID and computes the
  full new set in a single `setSelectedIds` call:
  - Looks up indices using the `songs` array (available via closure)
  - Finds min/max of current selection's indices via functional updater
    `setSelectedIds(prev => { computeWith(prev, songs); })`
  - Applies boundary-extension rules (above/below/inside)
  - Builds and returns a new `Set` of IDs for the full range
- One `setSelectedIds` call → one re-render. No race conditions.
- **Closure safety**: `songs` is stable during editing because refetches are
  blocked by `dirtyRef`. Two rapid shift-clicks with a refetch in between
  cannot occur. The functional updater ensures `prev` is always fresh.

### Keyboard Navigation
- Arrow up/down works only when `selectedIds.size === 1` (single song selected).
  Disabled entirely when multi-selection is active.
- Arrow keys still focus the row — they just can't change selection to different
  songs when multiple are selected.

### Dirty Guard — List Clicks Blocked When Form Not Clean
- A `dirtyRef` (useRef) lives in `EditLayout`
- Both forms update `dirtyRef.current` synchronously inline in every change
  handler (not via `useEffect`), so the click guard always reads the latest
  value without a microtask window.
  - `SingleSongMetadataEditForm`: `isDirty || saveMutation.isPending || isExporting`
  - `MultiSongMetadataEditForm`: `hasChanges || saveMutation.isPending`
- `EditLayout` wraps the `onSelect` callback: if `dirtyRef.current` is true,
  the click is silently ignored (no visual feedback needed).
- `CompactSongTable` uses the wrapped handler, so all row clicks are gated.
- **Implementation**: inline `dirtyRef.current = true` alongside `setDirtyFields`
  in each change handler. Slightly repetitive but maximally safe for 5 scalar
  handlers. No custom hook needed.

---

## Component Tree

```
EditMetadata (page)
  → FilterBar (readOnly, same)
  → BasePageCriteria (same)
  → EditLayout
    → CompactSongTable (multi-select click only, no checkboxes)
    → [selectedSongs.length === 0]  Empty: "Select songs to edit"
    → [selectedSongs.length === 1]  SingleSongMetadataEditForm
    → [selectedSongs.length > 1]    MultiSongMetadataEditForm
```

### EditLayout.tsx

Props:
```typescript
interface EditLayoutProps {
  songs: Song[];
  selectedIds: Set<string>;
  onSelect: (id: string, mode?: 'single' | 'toggle' | 'range') => void;
}
```

- Owns `dirtyRef` (useRef<boolean>)
- Passes dirtyRef to both form components
- Wraps `onSelect` with dirty guard before calling parent's handler
- `firstSelectedIndex` used only for keyboard nav in single-select mode
- `useEffect` for auto-select first song when selection is empty
- `selectedSongs` computed by filtering songs against selectedIds
- Conditionally renders one of: empty state / SingleSongMetadataEditForm / MultiSongMetadataEditForm

### CompactSongTable.tsx

Props:
```typescript
interface CompactSongTableProps {
  songs: Song[];
  selectedIds: Set<string>;
  onSelect: (id: string, mode?: 'single' | 'toggle' | 'range') => void;
}
```

- **No checkbox column** — click the row directly
- On shift-click: call `onSelect(clickedId, 'range')` — the parent computes
  the full new set in one state update
- On cmd/ctrl-click: call `onSelect(clickedId, 'toggle')`
- On plain click: call `onSelect(clickedId)` (implies 'single')
- Row class: `selectedIds.has(id)` for highlight

---

## MultiSongMetadataEditForm — Full Spec

### Props

```typescript
interface MultiSongMetadataEditFormProps {
  songs: Song[];
  dirtyRef: React.MutableRefObject<boolean>;
}
```

Updates `dirtyRef.current = hasChanges || saveMutation.isPending`.

### Layout (top to bottom)

1. **Header**: "Editing N songs"
2. **Grouping** (DJing / Listening) — composite pill
3. **Set / Stage / NZ** — composite pills + NZ pill
4. **Listening genre pills** — only if all songs have "Listening" in grouping
5. **Style tags** — intersection chips + autocomplete
6. **Artist** — text input
7. **BPM** — numeric input
8. **Key** — dropdown (atomic, whole key or nothing)
9. **Year** — numeric input
10. **Rating** — star clicker
11. **Selected song list** — always visible, left-aligned (not in `<details>`)
12. **Save Changes** button (explicit, disabled when nothing to change)
13. **Cancel** button (resets form to clean state)
14. **Status message** (success/error)
15. **No title field**

### Field Behaviour

#### Scalar fields — Explicit inactive/active state

Every scalar field has an explicit `dirty` flag. No visual tint is needed —
the user's action of typing/clicking is the signal. The Save button being
disabled when nothing has changed provides the feedback.

| State | Meaning | Sent on save? |
|---|---|---|
| **Inactive** (`dirty=false`) | User hasn't touched this field | No |
| **Active** (`dirty=true`) | User has interacted; current value will be applied | Yes |

How each field determines initial display:

- **Artist** (text): If all songs have same artist → show it. Otherwise → show
  "(multiple values)". Inactive.
- **BPM** (numeric): If all songs have same BPM → show it. Otherwise → blank
  with "(multiple values)". Inactive.
- **Year** (numeric): Same as BPM.
- **Key** (dropdown): If all songs have same key → show that root. Otherwise →
  blank placeholder "(multiple keys)". Minor toggle disabled unless root
  selected. **Atomic**: whole key or nothing. Cannot set minor independently.
- **Rating** (stars): If all songs have same rating → that many stars lit.
  Otherwise → no stars lit. Inactive.

Transition to active:

| Action | Result |
|---|---|
| User types in text field | `dirty=true`, value = text |
| User selects a key root | `dirty=true`, value = root + minor |
| User clicks a star | `dirty=true`, value = rating (click same star again: value unchanged, still dirty) |
| User clicks Cancel | All fields reset: `dirty=false`, values back to initial display |

#### Pills — Commonality model

Set / Stage / NZ / Grouping / Listening:

- Highlighted = present in ALL selected songs' effective genres
- Not highlighted = not in all
- Click highlighted → remove from all (add to removeGenres)
- Click not highlighted → add to all (add to addGenres)
- Mixed state is not shown independently — pills just show yes/no
- Effective genres per song = currentGenres ∪ addGenres \ removeGenres

#### Style chips

- Only show styles present in ALL selected songs **(intersection, not union)**
- All chips are implicitly "on" (present in all)
- Click chip → remove from all (add to removeGenres, chip disappears)
- Autocomplete to add new style to all (add to addGenres, appears as chip)
- If no style is in all songs, chips section is empty

### State Model

```typescript
// Genre and grouping changes: additive/subtractive sets
addGenres: string[]
removeGenres: string[]
addGrouping: string[]
removeGrouping: string[]

// Scalar fields — values decoupled from dirty state
artist: string
bpm: string
year: string
keyRoot: string
keyMinor: boolean
rating: number     // 0 = no rating, 1-5 = rating

// Explicit dirty tracking — user must interact for a field to be sent
dirtyFields: Set<'artist' | 'bpm' | 'key' | 'year' | 'rating'>

// Derived
hasChanges: boolean // dirtyFields.size > 0 || any add/remove list non-empty
```

On save, for each dirty field:

| Field | Value | Sent as |
|---|---|---|
| `artist` dirty | `artist` | `artist: string` |
| `bpm` dirty, `bpm !== ''` | `parseFloat(bpm)` | `bpm: number` |
| `bpm` dirty, `bpm === ''` | undefined | Field omitted (no clear action in v1) |
| `year` dirty, `year !== ''` | `parseInt(year, 10)` | `year: number` |
| `year` dirty, `year === ''` | undefined | Field omitted |
| `key` dirty | `keyRoot + (keyMinor ? 'm' : '')` | `key: string` |
| `rating` dirty, `rating > 0` | `rating` | `rating: number` |
| `rating` dirty, `rating === 0` | undefined | Field omitted |

**No explicit clear for scalar fields in v1**: If user types then deletes,
the field stays dirty but empty, so nothing is sent. A future version could add
a "clear" button per field to force-send null.

### Display State for Genre Pills

For each known tag `t`, compute whether it's effectively in all songs:

```
effectivelyInAll(t) = songs.every(s =>
  (s.genres.includes(t) && !removeGenres.includes(t)) || addGenres.includes(t)
)
```

If `true` → highlighted. If `false` → not highlighted.

---

## Server Changes

### No `pushHistory` option needed
All metadata edits (single and batch) go through the same `updateSongMetadata`
code path, which always calls `pushHistory`. No `options` parameter needed.
Removes the `{ pushHistory }` option that was previously drafted.

### `updateSongMetadata` — stays as-is (always pushes history)

Note: `pushHistory` already deduplicates: it JSON-stringifies the new snapshot
against the previous one and skips identical entries. Batch saves that send
a field whose value already matches the song's current value will generate
a no-op snapshot that `pushHistory` silently drops. No client-side filtering
needed for v1.

### New endpoint: `PUT /api/songs/metadata/batch`

**Route**: `router.put('/metadata/batch', songController.updateMetadataBatch)`

**Request body**:
```json
{
  "updates": [
    { "id": "abc", "data": { "artist": "...", "genres": [...], "bpm": 128 } },
    { "id": "def", "data": { ... } }
  ]
}
```

**Field whitelist**: Server validates each `data` object to only allow
editable fields. Copy only known keys; silently ignore unknown keys.
Allowed: `artist`, `genres`, `grouping`, `bpm`, `key`, `year`, `rating`.
Rejected: `title`, `_id`, `appleMusicId`, `album`, `sources`, `favorite`,
`artistTitleNormalized`, etc.

**Implementation**: helper function strips unknown fields from each `data`
object before passing to `updateSongMetadata`.

**Logic**:
- Iterate over updates sequentially
- For each: call `updateSongMetadata(id, sanitisedData)` — always pushes history
- Collect `updated[]` and `errors[]`
- Return `{ success: true, updated, errors }`

**Response**:
```json
{
  "success": true,
  "updated": [ { "_id": "abc", ... } ],
  "errors": []
}
```

### Partial Failure
Each update is independent. On client:
- If `errors.length > 0`, show error count + first error message
- At 10s-of-songs scale, summary is sufficient for v1

---

## Client-Side API

```typescript
function updateSongsBatch(
  updates: { id: string; data: Partial<Song> }[]
): Promise<{ success: boolean; updated: Song[]; errors: { id: string; error: string }[] }>
```

HTTP: `PUT /api/songs/metadata/batch` with `{ updates }` body.

---

## Cache Strategy

After successful batch save:
1. `invalidateQueries({ queryKey: ['songs'] })` — refetch all song data
2. `invalidateQueries({ queryKey: ['song-history'] })` — histories for any song
3. Show success status: "N songs updated"
4. Reset MultiSongMetadataEditForm to clean state (all fields back to inactive)
5. Keep `selectedIds` intact — user can add more songs or start fresh

---

## Cancel Multi-Edit

- **Cancel** button in MultiSongMetadataEditForm
- Resets addGenres/removeGenres/addGrouping/removeGrouping to empty arrays
- Resets all scalar fields to inactive state (empty strings, 0s)
- Sets `dirtyRef.current = false` explicitly
- Does NOT clear the selection (selectedIds unchanged)
- Returns form to clean state; list clicks re-enabled

---

## Edge Cases

- **Empty songs array**: Render "No songs selected" placeholder instead of form
- **Selection drift**: If song list changes (refetch), `EditLayout` auto-selects first song when no selection is valid
- **Race auto-save→batch**: DirtyRef blocks clicks; user must wait for auto-save
- **Listening pills**: Only appear if all songs have "Listening" in grouping. If user removes "Listening" from grouping, the listening section disappears.

---

## Out of Scope (v1)

- Write-to-Apple-Music for bulk
- Edit history display in MultiSongMetadataEditForm
- Partial undo/redo
- Select all / deselect all buttons
- Filter/search within song list
- Re-ordering songs in the list
- Explicit clear-value for scalar fields

---

## Key Decision: History

**Decision**: All metadata edits (single AND batch) push history entries via
`updateSongMetadata` → `pushHistory`. The `{ pushHistory: false }` option
that was previously drafted is removed. Batch edits generate history entries
with `sourceType: 'manual'`, same as single-song manual edits. This is
correct because:

1. All edits go through the same server code path
2. History provides audit trail for batch operations
3. No special case needed — batch is just N individual updates

---

## Open Question: Mode Switch Flash

When transitioning between single and multi edit (e.g. user cmd-clicks a second
song), React unmounts `SingleSongMetadataEditForm` and mounts `MultiSongMetadataEditForm`. The
unmount triggers `SingleSongMetadataEditForm`'s cleanup effect which flushes any
pending auto-save. The form content changes abruptly.

Mitigations considered:
- **Key-based remount** (current approach): abrupt but correct — auto-save
  fires before unmount, bulk form loads fresh.
- **Keep both mounted**: adds complexity. Not worth it for v1.

Acceptable for v1. The flash is a brief content swap, not a visual glitch.

---

## Resolved Decisions

The following questions from the previous plan iteration are now resolved and
reflected in the spec above:

1. **Active field tint**: Not needed. Activity is implicit from user action.
   Save button enables/disables as feedback.
2. **Range select is a single operation**: One `onSelect(id, 'range')` call
   with parent computing the full set in one `setSelectedIds` (functional
   updater). Closure safety is not a real risk — `songs` is stable during
   editing because refetches are gated by `dirtyRef`.
3. **Explicit dirty state**: Yes — `dirtyFields: Set<string>` instead of
   inferring from empty string. Value and dirty flag are decoupled.
4. **Explicit clear**: Acceptable to defer. "Set all to X" is the useful
   operation.
5. **No checkboxes**: Confirmed — row clicks with modifiers only.
6. **Rating sticky-dirty**: Once a star is clicked, rating stays dirty even
   if user clicks back to original value. Reversible via Cancel. Expected.
7. **Server no-op dedup**: Already handled by `pushHistory` — identical
   snapshots are silently dropped. No client-side filtering needed for v1.
8. **Cancel sets dirtyRef.current = false**: Added to Cancel spec above.
9. **dirtyRef sync**: Inline in change handlers (not useEffect), for
   maximum safety. Repetition acceptable for ~5 scalar handlers.
