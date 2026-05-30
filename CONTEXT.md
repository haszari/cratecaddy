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

Toggle in the header bar (current FilterBar). Keyboard shortcut `e` to toggle. Not on all pages — only song-list screens.

### Layout

Split pane: compact song list (left) + edit form (right). Components:

| Mode | Component | Description |
|---|---|---|
| View | `FullSongTable` | Current table (sources, artist, title, bpm, key, rating, genres) |
| Edit | `CompactSongTable` | Narrow list — artist, title only |
| Edit | `SongEditForm` | Full edit form for selected song |

Page-level component coordinates: render `FullSongTable` or `CompactSongTable + SongEditForm` based on edit mode state.

### Keyboard shortcuts

**Navigation**: `j`/`↓` down, `k`/`↑` up, `Escape` exit edit mode.

**Field focus**: `b` bpm, `k` key, `r` rating, `y` year, `t` title, `a` artist, `g` genre input.

**Rating**: `1`–`5` set rating (only when no specific field is focused).

**Save**: auto-save on field blur. Server deduplicates rapid edits into one History entry.

## Genres — structured editing

The `genres` field on Song remains a flat string list for storage and filtering. The edit UI splits it into purpose-specific sub-fields for ergonomic editing.

### Validation rules

Rating < 3: no constraints on genre sub-fields.
Rating >= 3:

| Condition | Stage | Set | Location | Styles |
|---|---|---|---|---|
| grouping has DJing | Required: Warmup/Peak/Later | Required: Deep/BAM/Ambient | Optional | Required (≥1 free-form tag, autosuggest) |
| grouping is Listening only | Not shown | Not shown | Optional | Required (≥1, pick from curated list) |
| grouping has both | DJing rules apply | DJing rules apply | Optional | Required (≥1) |

Fields are additive/constraining — switching a DJing song to Listening doesn't remove existing stage/set. They simply aren't validated.

### Genre sub-fields (edit UI only)

| Sub-field | Type | Required |
|---|---|---|
| `stage` | `'warmup' \| 'peak' \| 'later'` | Yes, if grouping contains DJing |
| `set` | `'deep' \| 'bam' \| 'ambient'` | Yes, if grouping contains DJing |
| `location` | `string` (optional) | No — e.g. `'NZ'` if artist is from NZ |
| `styles` | `string[]` (free-form) | At least one, if grouping contains DJing |

### Assembly order (for Apple Music comma-separated genre)

```
stage, set, ?location, styles (sorted alphabetically)
```

This ensures a predictable round-trip in Apple Music's single `genre` field.

### Parse on import

Split Apple Music genre by `, `, then classify each token:
- If known stage → `stage`
- If known set → `set`
- If known location → `location`
- Otherwise → `styles`

### Known values

| Field | Values | Case |
|---|---|---|
| stage | `Warmup`, `Peak`, `Later` | Title |
| set | `Deep`, `BAM`, `Ambient` | Title except BAM (uppercase) |
| Listening styles | `Jazz`, `Funk`, `Classical`, `Contemporary`, `Electronic`, `Dance`, `Hip Hop`, `Pop`, `Rock`, `Country`, `Indie`, `Ambient` | Title |
| DJing styles | Free-form, autosuggest from existing DB values | Per-user entry |

### Assembly order (for Apple Music comma-separated genre)

## Grouping edit UI

Toggle buttons: `[DJing]` `[Listening]` with force-select (at least one always active). Stored as-is in the `grouping` array (matching current import convention).

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
- `snapshot`: editable fields only (title, artist, genres, grouping, bpm, key, rating, year). Duration and album are on the Song doc but not repeatable — duration is a physical property of the audio file.
- `importMeta`: heavy provenance data from imports. Not present for manual edits.
- Server-side dedup: if the latest history entry for a song shares `sourceType: 'manual'` and is less than N minutes old, update its snapshot in-place rather than appending.

Index: `{ songId: 1, dateEdited: -1 }`.

## Source types

`'applemusic' | 'rekordbox' | 'djaypro' | 'manual'`

`'manual'` is reserved for in-app user edits. All others are import sources.
