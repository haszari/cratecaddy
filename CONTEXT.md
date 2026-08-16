# Crate Caddy — Domain Language

## Song

A single track in the library. Source of truth: the `Song` MongoDB document.

### Current values

The top-level fields on Song (`title`, `artist`, `album`, `duration`, `genres`, `bpm`, `key`, `rating`, `year`, `grouping`, `starred`) are the **current effective values** at all times. There is no layered-override or merge-at-read model. Every write — whether from import or manual edit — overwrites these fields directly. Last write wins.

### History

A separate `History` collection records every write to a Song. Each entry is a **full snapshot** of the Song at that moment (all editable fields), plus `importMeta` for per-source provenance. This is the safety net for recovery and audit.

### Sources

The Song document keeps a lightweight `sources[]` array for display and file-type identity only.

```
{ sourceType, format: 'aiff'|'wav'|'alac'|'aac'|'mp3'|'applemusicstream',
  appleMusicId?: string, filePath?: string }
```

- `format`: codec or container type. `'applemusicstream'` indicates a remote Apple Music track (cloud icon in UI). Lossless formats (`aiff`/`wav`/`alac`) show a gem icon in UI.
- Source-specific streaming IDs (`appleMusicId`) distinguish tracks from different streaming providers.

Heavy import provenance (bit rate, file size, dates, track type, protection status) lives in the **History** entry's `importMeta` — not on the Song document.

Data on Song.sources is refreshed each import. Historical source data is recoverable from History.

### Starred

Three-state triage marker: `'starred'` (Apple Music loved), `'normal'` (default), `'disliked'`. Imported from Apple Music's Loved/Disliked booleans. Displayed in CompactSongTable as a star icon.

### Favourite sync (Apple → DB)

The "Sync with Apple Music" button on `/favourited` reconciles hearts without a full XML re-import (see ADR 0013):

- Reads all Loved tracks from the Music app via AppleScript (`appleMusicRead.ts`).
- Starred DB songs whose Apple ID is no longer Loved → `'normal'`.
- Loved tracks matching a DB song → `'starred'`.
- Loved tracks with no DB match → new Song created (name, artist, album, duration, genres, grouping, bpm, rating, year) via the normal import/merge path (`updateWithHistory`), so history and normalisation apply.
- `Disliked` is not managed by the sync; DB hearts are never written back to Apple.

### artistTitleNormalized

Auto-computed from `artist` + `title` during pre-save. Used for matching during import (via `findMatchingSong`). Not overridable.

## Import

An import script reads metadata from an external source (Apple Music XML, Rekordbox XML, djay Pro CSV) and writes it to the database. Each import session pushes one History entry per song.

- **Fields**: straight overwrite, no union merge. Imported values become the Song's current values.
- **Matching**: by normalized artist + title + duration (from `findMatchingSong`).

## Manual edit

A user edits Song metadata through the in-app UI. Produces a History entry with `sourceType: 'manual'`.

- **Fields**: straight overwrite, same as import — last write wins.
- **Precedence**: determined by wall-clock order. A manual edit after an import wins; a re-import after an edit wins.
- **Resolution**: if the effective value is wrong, dig into History to replay or restore.

## Export (Apple Music)

The UI writes current Song fields back to the Apple Music app via AppleScript. Per-song operation (v1).

### Field mapping

| Song field | AppleScript property | Notes |
|---|---|---|
| title | `name` | |
| artist | `artist` | |
| album | `album` | |
| genres | `genre` | Join to comma-separated string (reverse of import split). |
| bpm | `bpm` | Integer. |
| rating | `rating` | 0–100 scale (multiply internal 0–5 by 20). |
| year | `year` | |
| grouping | `grouping` | |
| favorite | `loved` / `disliked` | `'starred'` → `set loved to true`, `'disliked'` → `set disliked to true`, `'normal'` → `set loved to false; set disliked to false`. |
| key | `comment` | Ad-hoc format `musicalKey=Fm` appended to existing comment. If comment already contains `musicalKey=`, update in-place. Not assumed to own the field — other metadata may coexist. Single-letter key notation preferred (`Fm`, `G`, `C#m`). |

### Key round-trip

On import, parse the `Comments` field from Apple Music XML for the pattern `musicalKey=([A-G][b#]?(?:m|dim|aug|sus)?)`. If found, populate the Song's `key` field. This allows edits made in Crate Caddy to survive re-imports without data loss.

## Top-level source IDs

The Song document stores source-provider IDs as top-level optional fields for direct access by export scripts. For v1:

```
appleMusicId?: string  // Apple Music persistent ID
```

Multiple IDs for the same source type (e.g. one streaming + one local Apple Music track) are deferred.

## Edit mode UI

### Entry

Toggle button in the header bar (current FilterBar "ED" button). Keyboard shortcut `e` to toggle. On all song-list screens: Home, GenreDetail, Artist. Not on Song detail page (v1).

### Layout

Split pane: compact song list (left, ~40%) + edit form (right, ~60%). Components:

| Mode | Component | Description |
|---|---|---|
| View | `SongTable` | Current table (sources, artist, title, bpm, key, rating, genres) |
| Edit | `CompactSongTable` | Narrow table — shares SongTable row styles, only artist + title columns visible |
| Edit | `SongEditForm` | Full edit form for selected song |

`CompactSongTable` uses the same `<table>` element and row classes as `SongTable`. Only Artist and Title columns are rendered. Sources, Genres, Rating, BPM, Key columns are omitted. Selected row gets a highlight.

### Edit form layout

Flexbox wrap with gap. Fields grouped by row:

| Row | Fields | Type |
|-----|--------|------|
| 1 | Artist, Title | Text fields (MUI TextField) |
| 2 | Grouping, BPM, Key (root dropdown + ♯ toggle + m toggle), Year | Toggle chips, number inputs, dropdown+toggles |
| 3 | Set, Stage, NZ | Dropdowns, toggle chip |
| 4 | Styles | Autosuggest (free-solo, chips, popular-first) |
| 5 | Favorite (★/○/✕), Export to Apple Music | Toggle buttons, action button |

### Field styling (MUI theme)

All fields use MUI components themed via `createTheme`:
- Flat, subtle box with pale background (`#f5f5f5`), very small border-radius
- Label: subtle small, uppercase, above top left, same color as field
- "Required" fields (Set/Stage/Styles when grouping contains DJing): bold labels + subtle highlight/underline on input when empty
- Guidance is visual only — no block on save

### Genre decomposition (edit time only)

On form open, parse `song.genres` flat array into sub-fields:

- Known stage token (`Warmup`/`Peak`/`Later`) → stage field
- Known set token (`Deep`/`BAM`/`Ambient`) → set field
- Token `NZ` → location checkbox
- Everything else → styles array

"Ambient" is both a Set and a Listening style. Set token takes priority during decomposition.

### Genre reassembly (on save)

Order: `styles (alphabetically), ?NZ, set, stage`

Strip empty/falsy values. Example output: `Minimal, Dub Techno, NZ, Warmup, Deep`.

### Styles autosuggest

MUI Autocomplete with `freeSolo`, `multiple` (chip mode). Suggestion source: all unique genre tokens from DB minus known org tags (stage/set values, "NZ"). Sorted by usage frequency (most popular first).

When grouping contains Listening, show subtle hint below: "Common: Jazz, Funk, Classical, Contemporary, Electronic, Dance, Hip Hop, Pop, Rock, Country, Indie, Ambient".

### Grouping picker

Toggle button group: `[DJing] [Listening]`. At least one always active. Each toggles independently. Maps to `grouping: string[]` on Song.

### Key field

MUI Select (root notes): `C, C#, D, D#, E, F, F#, G, G#, A, A#, B`.
Toggle button for sharp (`♯`). Toggle button for minor (`m`).
Sharp replaces natural root with `#` variant. Minor appends `m`.
Output: e.g. `"F#m"`, `"G"`, `"Dm"`.

When empty, omit from export to Apple Music.

### Location (NZ)

Single toggle chip. When active, inserts `"NZ"` into genres array at the `location` position. No other locations get special UI — they appear in the styles bucket.

### Save model

Auto-save on any state change via debounced `useEffect` watching all form fields. 800ms debounce — collects pending field changes into a single `PUT /api/songs/:id/metadata`. Unmount flush via `latestRef` + `mutateRef` guarantees save before component unmounts (song switch/key-based remount). Prevent empty title/artist (revert to previous value on blur).

No manual save calls in click/blur/key handlers — all state changes flow through the debounced effect. No stale closures, no double saves.

### Tracking

Edit mode tracks songs by `_id`, not array index. `useEditMode` exposes `selectedId: string | null`. `EditLayout` handles arrow-key navigation internally via `findIndex`. On entering edit mode, the first song in the list is auto-selected (handled by `EditLayout`).

### Sort (non-edit view only)

Sortable columns on `SongTable` (click header, asc↔desc toggle): Artist, Title, BPM, Key, Rating.
Default: `rating: -1` (highest first). No clear mechanism.
No sort during edit mode — sort is set before entering edit.

### Keyboard shortcuts

Global (no field focused):

| Key | Action |
|-----|--------|
| `↑`/`↓` | Navigate songs |
| `1`–`5` | Set rating |
| `d` | Toggle DJing grouping |
| `l` | Toggle Listening grouping |
| `t` | Focus title |
| `a` | Focus artist |
| `g` | Focus styles autosuggest |
| `b` | Focus BPM |
| `y` | Focus year |
| `r` | Focus rating |

Key field (when focused):

| Key | Action |
|-----|--------|
| `Shift+A`–`Shift+G` | Set root note |
| `+` (`Shift+=`) | Toggle sharp |
| `m` | Toggle minor |

## Genres — structured editing

The `genres` field on Song remains a flat `string[]` for storage, filtering, and Apple Music round-trip. The edit UI decomposes and reassembles it into purpose-specific sub-fields. See **Edit mode UI > Genre decomposition** and **Genre reassembly** above for the canonical specification.

## Grouping edit UI

See **Edit mode UI > Grouping picker** above.

## Genre standardisation (future)

Genres serve dual purpose (classification + energy-level tags like "Warmup | Peak | Later"). These structural tags should be rendered last in the genres array. Details deferred — separate edit UI fields per purpose may resolve this more cleanly.

## History entry schema

```
{
  songId: ObjectId,       // ref: Song
  dateEdited: Date,
  sourceType: 'applemusic' | 'rekordbox' | 'djaypro' | 'manual',
  snapshot: {
    title, artist,
    genres, grouping,
    bpm, key, rating, year, starred
  },
  importMeta?: {           // per-source provenance (heavy)
    fileSize, bitRate, fileType,
    dateAdded, dateModified, dateLastPlayed,
    trackType, isProtected,
    [key: string]: unknown
  }
}
```

- `dateEdited`: semantic timestamp of the write.
- `snapshot`: all editable fields (title, artist, genres, grouping, bpm, key, rating, year, favorite). Duration and album are on the Song doc but not editable — duration is a physical property of the audio file.
- `importMeta`: heavy provenance data from imports. Not present for manual edits.
- Server-side dedup: all history writes go through `createHistoryEntry`, which compares snapshot with the most recent entry (regardless of sourceType). If identical → skip. If same sourceType and <5 min old → update in-place. Otherwise → create new.
- History UI renders **inline per-entry diff**: each entry shows only the fields that differ from the previous snapshot. First entry shows date+source only (values visible in form above). Genres and grouping tokenized as individual pills. Server prevents duplicate-snapshot entries so UI doesn't need to handle that case.

Index: `{ songId: 1, dateEdited: -1 }`.

## Source types

`'applemusic' | 'rekordbox' | 'djaypro' | 'manual'`

`'manual'` is reserved for in-app user edits. All others are import sources.

## Bulk edit

Deferred — not in scope for this pass. Single-song edit robustness first.
