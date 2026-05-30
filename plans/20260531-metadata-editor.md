# Metadata editor — implementation plan

## Overview

Add an edit mode to the app that allows inline editing of song metadata. Edits are last-write-wins, recorded to a new History collection, and can be exported back to Apple Music via AppleScript.

---

## Rollout plan (execution order)

1. **Song model + History model** — add fields, create History schema. Zero breakage: all new fields are optional. No changes to existing write paths yet.
2. **Rewrite import scripts** — convert to `updateWithHistory`, write `appleMusicId`, populate History entries, write new source format. Import scripts call the new service method; old `upsertSongWithMerge` stays for backward compat.
3. **Full re-import from Apple Music** — run the updated import against the test DB. This seeds `appleMusicId`, History collection, and proper source format for all existing songs. Verify with `query:db`.
4. **Remove old merge code** — delete `upsertSongWithMerge` and `mergeSongData` once all import scripts use the new path.
5. **Build manual edit API** — `PUT /:id/metadata`, export endpoint, history endpoint. Server-side tested via curl/Postman.
6. **Build edit UI** — all edit-mode components. Connect to API. Test with the re-imported data.
7. **End-to-end test** — edit a song, verify History entry created, export to Apple Music, re-import and confirm round-trip preserved.

## Phase 1 — Data model and API

### 1a. New History model

**File:** `src/api/src/models/History.ts` (new)

```typescript
interface IHistoryEntry {
  songId: ObjectId;
  dateEdited: Date;
  sourceType: 'applemusic' | 'rekordbox' | 'djaypro' | 'manual';
  snapshot: {
    title: string;
    artist: string;
    genres: string[];
    grouping: string[];
    bpm?: number;
    key?: string;
    rating?: number;
    year?: number;
  };
  importMeta?: Record<string, unknown>;
}
```

Index on `{ songId: 1, dateEdited: -1 }`.

### 1b. Update Song model

**File:** `src/api/src/models/Song.ts`

Changes:
- Add `appleMusicId?: string` (top-level, for AppleScript export targeting)
- Update `ISource.sourceType` enum to include `'manual'`
- Update `ISource` shape to `{ sourceType, format: 'aiff'|'wav'|'alac'|'aac'|'mp3'|'applemusicstream', appleMusicId?: string, filePath?: string }`
- `sources` sub-schema: drop `fileSize`, `bitRate`, `fileType` (moved to History.importMeta). Keep `sourceMetadata` optional for backward compat during migration.

### 1c. Song service — new write path

**File:** `src/api/src/services/songService.ts`

New methods:
- `updateWithHistory(id, data, sourceType, importMeta?)` — updates Song doc fields, dedups into History (if latest history entry for this song is `sourceType: 'manual'` and < N min old, update its snapshot; else append)
- `getHistory(songId)` — returns History entries sorted by dateEdited desc
- `exportToAppleMusic(songId)` — builds and runs AppleScript

Changes to existing:
- `upsertSongWithMerge` → rewrite: fields overwrite directly (no union merge). Source is either replaced in the `sources[]` array or appended. Callers (import scripts) pass their sourceType and importMeta.
- `mergeSongData` — can be removed or kept for backward compat. Plan: remove after all import scripts are converted.

### 1d. API endpoints

**File:** `src/api/src/routes/songs.ts`

Add:
- `PUT /:id/metadata` — calls `updateWithHistory` with `sourceType: 'manual'` (from query param or body)
- `POST /:id/export-to-apple-music` — calls `exportToAppleMusic`
- `GET /:id/history` — returns History entries

**File:** `src/api/src/controllers/songController.ts`

Add handlers for the three new routes.

### 1e. Import script updates

**File:** `src/api/scripts/import-apple-music.ts`

Changes:
- Use `updateWithHistory` instead of `upsertSongWithMerge`
- On import, parse Comments for `musicalKey=([A-G][b#]?(?:m|dim|aug|sus)?)` → populate `key`
- Store `appleMusicId` (persistent ID) on Song doc top-level
- Pass importMeta to History entry (dateAdded, dateModified, etc.)
- Map `Track Type: 'Remote'` → `format: 'applemusicstream'`
- Map local files → `format` based on file extension (.aiff/.wav/.alac/.aac/.mp3)

**File:** `src/api/scripts/import-rekordbox.ts` and `src/api/scripts/import-djaypro.ts`

Same pattern — convert to `updateWithHistory`.

### 1f. AppleScript export

**File:** `src/api/src/services/appleMusicExport.ts` (new)

```
export async function exportToAppleMusic(song: ISong): Promise<{ success: boolean; message: string }>
```

Generates osascript command:
```applescript
tell application "Music"
    set t to (first track of library playlist 1 whose persistent ID is "<appleMusicId>")
    set name of t to "<title>"
    set artist of t to "<artist>"
    set genre of t to "<comma-separated-genres>"
    set bpm of t to <bpm>
    set rating of t to <rating * 20>
    set year of t to <year>
    set grouping of t to "<grouping-joined>"
    -- key written to comment
    set comment of t to "<existing-comment>musicalKey=<key>"
end tell
```

Fallback matching by artist+title if persistent ID not found.

Error handling: timeout, permission errors, track-not-found.

---

## Phase 2 — UI edit mode

### 2a. Types

**File:** `src/ui/src/types/index.ts`

Add `appleMusicId` to `Song` interface.
Update `ISource` to match new shape.

### 2b. API client

**File:** `src/ui/src/api/client.ts`

Add:
- `updateSongMetadata(id, data)` → `PUT /api/songs/:id/metadata`
- `exportToAppleMusic(id)` → `POST /api/songs/:id/export-to-apple-music`
- `fetchSongHistory(id)` → `GET /api/songs/:id/history`

### 2c. Edit mode state

**File:** `src/ui/src/hooks/useEditMode.ts` (new)

Manages:
- `editMode: boolean` — toggle
- `selectedSongId: string | null` — which song has focus in compact list
- `pendingChanges: Set<string>` — song IDs with unsaved edits
- `selectNext()` / `selectPrev()` — arrow through songs
- Key listeners for `e` (toggle), `j`/`k` (navigate), `Escape` (exit)

### 2d. Header bar

**File:** `src/ui/src/components/SongList/HeaderBar.tsx` (rename from FilterBar.tsx)

Add edit mode toggle button (icon-only, `e` label or pencil icon). Highlighted when active.
Emit `onToggleEdit` callback.

### 2e. Compact song table

**File:** `src/ui/src/components/SongList/CompactSongTable.tsx` (new)

Props: `songs, selectedId, onSelect`
Renders: 2-column list (artist | title), no genre pills, no sources, no bpm/key/rating.
Selected row highlighted. Keyboard navigation via `j`/`k`.

### 2f. Edit form — field components

**File:** `src/ui/src/components/EditMode/GroupingPicker.tsx` (new)

Two toggle buttons `[DJing] [Listening]` — at least one always active. Click toggles each independently; clicking the last active one is a no-op.

**File:** `src/ui/src/components/EditMode/StagePicker.tsx` (new)

Three-segment bar: `[Warmup] [Peak] [Later]`. Exactly one selectable. Hidden if grouping is Listening-only.

**File:** `src/ui/src/components/EditMode/SetPicker.tsx` (new)

Three-segment bar: `[Deep] [BAM] [Ambient]`. Exactly one selectable. Hidden if grouping is Listening-only.

**File:** `src/ui/src/components/EditMode/LocationPicker.tsx` (new)

Optional text field. Free-text entry. Shown always.

**File:** `src/ui/src/components/EditMode/StylesInput.tsx` (new)

Tag input with:
- Free-text entry, Enter/comma to add
- Autosuggest from existing DB genres (fetch `getGenreStats` and filter)
- For Listening tracks: curated picklist (Jazz, Funk, Classical, etc.) as clickable pills
- Click X to remove a tag
- Validation: at least one required if rating >= 3

**File:** `src/ui/src/components/EditMode/BpmField.tsx` (new)

Number input. Keyboard shortcut `b` to focus. Tab to next field.

**File:** `src/ui/src/components/EditMode/KeyField.tsx` (new)

Text input with validation for musical key format. Autocomplete/candidates from common keys. Keyboard shortcut `k` to focus.

**File:** `src/ui/src/components/EditMode/RatingField.tsx` (new)

Row of 5 clickable star buttons. Keyboard shortcuts `1`–`5` set rating directly (when no form field is focused).

**File:** `src/ui/src/components/EditMode/ArtistTitleFields.tsx` (new)

Two-up inline: artist + title fields. Keyboard shortcuts `t` (title) and `a` (artist).

### 2g. Song edit form

**File:** `src/ui/src/components/EditMode/SongEditForm.tsx` (new)

Props: `song, onSave, onExport, onHistory`
Layout:
```
Artist | Title | Year
BPM | Key | Rating
Grouping: [DJing] [Listening]
Stage: [Warmup] [Peak] [Later]
Set: [Deep] [BAM] [Ambient]
Location: [______]
Styles: [tag input]
```
Keyboard shortcut handler that dispatches field focus.

### 2h. Edit layout (page coordinator)

**File:** `src/ui/src/components/EditMode/EditLayout.tsx` (new)

Takes the full song list, renders:
```
+-------------------+----------------------------+
| CompactSongTable  | SongEditForm                |
| (artist + title)  | (full form for selected)    |
|                   |                            |
| v/scroll syncs    | [Save] [Export to AM]      |
| with selection    | [View history]              |
+-------------------+----------------------------+
```

### 2i. Page integration

**File:** `src/ui/src/components/SongList/SongTable.tsx`

No changes — when edit mode is enabled, the page renders `EditLayout` instead of `SongTable`.

**File:** `src/ui/src/pages/Home.tsx` (+ GenreDetail.tsx, Artist.tsx, Song.tsx)

Each song-list page checks `editMode`:
- `false` → render `FilterBar` + `SongTable` (current)
- `true` → render `HeaderBar` + `EditLayout`

---

## Phase 3 — Validation

### 3a. Client-side validation

**File:** `src/ui/src/components/EditMode/validation.ts` (new)

```
validate(song, fields)
  - grouping: at least one of DJing/Listening
  - if rating >= 3:
    - if grouping has DJing:
      - stage must be set
      - set must be set
      - styles must have >= 1 entry
    - if grouping is Listening-only:
      - styles must have >= 1 entry (curated list)
```

Show inline validation messages. Disable save if invalid.

---

## Phase 4 — History viewer (future)

Not part of this implementation — build after the core edit round-trip works.

---

## File change summary

### New files (API)
| File | Purpose |
|---|---|
| `src/api/src/models/History.ts` | Mongoose schema |
| `src/api/src/services/appleMusicExport.ts` | AppleScript generation |

### Modified files (API)
| File | Changes |
|---|---|
| `src/api/src/models/Song.ts` | Add `appleMusicId`, update `ISource`, add `manual` to enum |
| `src/api/src/services/songService.ts` | Add `updateWithHistory`, `getHistory`; rewrite `upsertSongWithMerge` to straight overwrite |
| `src/api/src/controllers/songController.ts` | Add 3 handlers |
| `src/api/src/routes/songs.ts` | Add 3 routes |
| `src/api/scripts/import-apple-music.ts` | Use `updateWithHistory`, parse Comments for key, store `appleMusicId` |
| `src/api/scripts/import-rekordbox.ts` | Convert to `updateWithHistory` |
| `src/api/scripts/import-djaypro.ts` | Convert to `updateWithHistory` |

### New files (UI)
| File | Purpose |
|---|---|
| `src/ui/src/hooks/useEditMode.ts` | Edit mode state + keybindings |
| `src/ui/src/components/EditMode/EditLayout.tsx` | Split pane coordinator |
| `src/ui/src/components/EditMode/CompactSongTable.tsx` | Left pane list |
| `src/ui/src/components/EditMode/SongEditForm.tsx` | Right pane form |
| `src/ui/src/components/EditMode/GroupingPicker.tsx` | DJing/Listening toggle |
| `src/ui/src/components/EditMode/StagePicker.tsx` | Warmup/Peak/Later |
| `src/ui/src/components/EditMode/SetPicker.tsx` | Deep/BAM/Ambient |
| `src/ui/src/components/EditMode/LocationPicker.tsx` | Optional text field |
| `src/ui/src/components/EditMode/StylesInput.tsx` | Tag input with autosuggest |
| `src/ui/src/components/EditMode/BpmField.tsx` | Number input |
| `src/ui/src/components/EditMode/KeyField.tsx` | Key text input |
| `src/ui/src/components/EditMode/RatingField.tsx` | Star buttons |
| `src/ui/src/components/EditMode/ArtistTitleFields.tsx` | Artist + title inline |
| `src/ui/src/components/EditMode/validation.ts` | Client-side validation |

### Modified files (UI)
| File | Changes |
|---|---|
| `src/ui/src/types/index.ts` | Add `appleMusicId` to Song, update ISource |
| `src/ui/src/api/client.ts` | Add 3 API methods |
| `src/ui/src/components/SongList/FilterBar.tsx` | Rename to HeaderBar, add edit toggle |
| `src/ui/src/pages/Home.tsx` | Branch on editMode |
| `src/ui/src/pages/GenreDetail.tsx` | Branch on editMode |
| `src/ui/src/pages/Artist.tsx` | Branch on editMode |
