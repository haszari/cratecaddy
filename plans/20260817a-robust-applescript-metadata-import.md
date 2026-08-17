# Robust AppleScript metadata import + shared import pipeline

Refactor the AppleScript metadata extraction to be fault-tolerant, and unify
the XML and AppleScript import paths behind a shared inner method.

## Problem

- The current AppleScript read (`appleMusicRead.ts`) uses a positional
  delimited-string format that is fragile: one `missing value` or syntax error
  kills the entire output.
- The XML import (`import-apple-music.ts`) and AppleScript sync
  (`songService.ts`) both transform raw data into `updateWithHistory` calls,
  but share no code. Field mapping, helper functions, and merge logic are
  duplicated.
- The `comment` field can contain newlines. Any encoding that sanitises newlines
  (replace with space) loses data. We need a format that preserves arbitrary
  content in values.

## Goal

Two use cases from a single shared import path:

1. **Refresh metadata** of already-imported liked tracks (update bpm, rating,
   genre, year, album, key, etc. from Apple Music).
2. **Add newly-liked tracks** that aren't in the DB yet, with full metadata.

Both XML import and AppleScript read produce the same normalised structure;
the wire format is the only difference.

## Wire format: control-character separated INI

### Encoding scheme

| Separator | Character | Purpose |
|-----------|-----------|---------|
| Key-value | `=` (first occurrence) | Separates field name from value within a pair |
| Pair | `\x1F` (ASCII 31, Unit Separator) | Separates key-value pairs within a track |
| Track | `\x1E` (ASCII 30, Record Separator) | Separates tracks |

Values can contain **any characters** including newlines, equals signs, and
whitespace. The parser only splits on control characters, so content is
preserved intact.

### Example output

```
persistentId=C2EE4E8E7AD4C9A6\x1Fname=Brain Damage\x1Fartist=Pink Floyd\x1Falbum=Dark Side Of The Moon\x1Fduration=230757\x1Fgenre=Rock\x1Fgrouping=DJing\x1Fbpm=128\x1Frating=80\x1Fyear=1973\x1Fcomment=Some note about the song
musicalKey=G#m
Another note\x1Fkind=AAC audio file\x1EpersistentId=D3FF5F9F8BE5DBB7\x1Fname=Song 2\x1Fartist=Artist 2
```

Note: the `comment` value spans three lines — this is valid. The `\x1E`
delimiter between tracks is unambiguous regardless of content.

### Why not positional (ASCII 31 between fields)?

Positional formats shift when a field is missing or has the delimiter in it.
Labeled fields (`key=value`) are self-describing — missing fields are just
absent, no shifting.

### Why not newline-separated INI?

Newlines in values (especially `comment`) break block parsing. Control
character separators avoid this entirely.

### Why not XML/plist reuse?

AppleScript generating valid plist XML is verbose (escaping quotes, ampersands,
`<` characters) and error-prone. The INI format is simpler to generate in
AppleScript and simpler to parse in JS (~20 lines). The parsing code is trivial
and unlikely to need maintenance.

## AppleScript: fault-tolerant field extraction

### Handler: `toStringOrEmpty(v)`

Wraps every property access. If the property is `missing value` or throws any
error, returns `""`. No data loss for available fields; unavailable fields
produce an empty value.

```applescript
on toStringOrEmpty(v)
  try
    return v as text
  on error
    return ""
  end try
end toStringOrEmpty
```

### Handler: `trackBlock(t)`

Builds one INI-style string per track. Each field is wrapped in
`toStringOrEmpty`. Pairs are joined with `\x1F` (Unit Separator).

```applescript
on trackBlock(t)
  set US to ASCII character 31
  set parts to {}
  set end of parts to "persistentId=" & toStringOrEmpty(persistent ID of t)
  set end of parts to "name=" & toStringOrEmpty(name of t)
  set end of parts to "artist=" & toStringOrEmpty(artist of t)
  set end of parts to "album=" & toStringOrEmpty(album of t)
  set end of parts to "duration=" & toStringOrEmpty(total time of t)
  set end of parts to "genre=" & toStringOrEmpty(genre of t)
  set end of parts to "grouping=" & toStringOrEmpty(grouping of t)
  set end of parts to "bpm=" & toStringOrEmpty(bpm of t)
  set end of parts to "rating=" & toStringOrEmpty(rating of t)
  set end of parts to "year=" & toStringOrEmpty(year of t)
  set end of parts to "comment=" & toStringOrEmpty(comment of t)
  set end of parts to "kind=" & toStringOrEmpty(kind of t)
  set AppleScript's text item delimiters to US
  set result to parts as text
  set AppleScript's text item delimiters to ""
  return result
end trackBlock
```

### Main script

Iterates loved tracks, calls `trackBlock(t)` for each, collects into a list,
joins with `\x1E` (Record Separator).

```applescript
tell application "Music"
  set out to {}
  set lovedTracks to (every track of library playlist 1 whose loved is true)
  repeat with t in lovedTracks
    set end of out to trackBlock(t)
  end repeat
  set AppleScript's text item delimiters to ASCII character 30
  set output to out as text
  set AppleScript's text item delimiters to ""
  return output
end tell
```

### Fields extracted (12 total)

| Key | AppleScript property | DB mapping | Notes |
|-----|---------------------|-----------|-------|
| `persistentId` | `persistent ID` | `appleMusicIds` | Required for matching |
| `name` | `name` | `title` | Required |
| `artist` | `artist` | `artist` | Required |
| `album` | `album` | `album` | |
| `duration` | `total time` | `duration` | Milliseconds (matches DB) |
| `genre` | `genre` | `genres[]` | Comma-separated, split by `splitTagsField` |
| `grouping` | `grouping` | `grouping[]` | Comma-separated, split by `splitTagsField` |
| `bpm` | `bpm` | `bpm` | |
| `rating` | `rating` | `rating` | 0–100, ÷20 for DB 0–5 |
| `year` | `year` | `year` | |
| `comment` | `comment` | (parsed for `key`) | Contains `musicalKey=...` |
| `kind` | `kind` | `sources.format` | e.g. "AAC audio file" → `'aac'` |

Fields we don't need from AppleScript: `location` (irrelevant for streaming
tracks, CrateCaddy doesn't manage playback paths), `bit rate`/`sample rate`/`size`
(not in DB model), `date added`/`modification date` (`lastImportDate` is set
automatically), `played count`/`skipped count` (not tracked), `disc number`/`track
number` (not in DB model), `lyrics` (not in DB model).

## Shared types: `ImportableTrack`

New file: `src/api/src/helpers/importTypes.ts`

```typescript
export interface ImportableTrack {
  // Required for matching
  artist: string;
  title: string;
  duration?: number; // milliseconds

  // Metadata
  album?: string;
  genres?: string[];      // already split
  grouping?: string[];    // already split
  bpm?: number;
  rating?: number;        // 0–5 scale (already divided by 20)
  year?: number;
  key?: string;

  // Identity
  appleMusicId?: string;
  favorite?: 'starred' | 'normal' | 'disliked';

  // Source metadata
  format?: SourceFormat;
  filePath?: string;
  importMeta?: Record<string, unknown>;
}
```

This matches the fields `updateWithHistory` already accepts. Both XML and
AppleScript paths produce `ImportableTrack[]`.

## Shared helpers

New file: `src/api/src/helpers/appleMusicImport.ts`

Move from `import-apple-music.ts`:

| Helper | Current location | Change |
|--------|-----------------|--------|
| `convertRating(rating)` | `import-apple-music.ts:36` | Move to shared. Takes 0–100, returns 0–5. |
| `parseKeyFromComment(comment)` | `import-apple-music.ts:43` | Move to shared. Regex `musicalKey=...`. |
| `detectFormatFromKind(kind)` | `import-apple-music.ts:49` | Refactor: takes just `kind` string (e.g. "AAC audio file"), returns `SourceFormat`. Caller maps raw fields. |

The XML importer adds the `Track Type: Remote` → `'applemusicstream'` mapping
before calling `detectFormatFromKind`. The AppleScript path doesn't have
`Track Type`, so it just passes `kind`.

`splitTagsField` stays in `helpers/tags.ts` (already shared).

## JS parse: `parseApplescriptOutput(raw)`

```typescript
const RS = '\x1E'; // Record Separator — between tracks
const US = '\x1F'; // Unit Separator — between key-value pairs

function parseApplescriptOutput(raw: string): ImportableTrack[] {
  const tracks: ImportableTrack[] = [];
  for (const block of raw.split(RS)) {
    if (!block.trim()) continue;
    const fields: Record<string, string> = {};
    for (const pair of block.split(US)) {
      const eq = pair.indexOf('=');
      if (eq === -1) continue;
      fields[pair.substring(0, eq)] = pair.substring(eq + 1);
    }
    if (!fields.persistentId || !fields.name || !fields.artist) continue;
    tracks.push({
      artist: fields.artist,
      title: fields.name,
      duration: parseNum(fields.duration),
      album: fields.album || undefined,
      genres: splitTagsField(fields.genre),
      grouping: splitTagsField(fields.grouping),
      bpm: parseNum(fields.bpm),
      rating: parseNum(fields.rating) !== undefined
        ? parseNum(fields.rating)! / 20
        : undefined,
      year: parseNum(fields.year),
      key: parseKeyFromComment(fields.comment),
      appleMusicId: fields.persistentId,
      favorite: 'starred',
      format: detectFormatFromKind(fields.kind),
    });
  }
  return tracks;
}
```

## Shared import function

Add `importTracks()` to `songService.ts`:

```typescript
async importTracks(
  tracks: ImportableTrack[],
  sourceType: 'applemusic' | 'rekordbox' | 'djaypro' | 'manual',
): Promise<{ imported: number; updated: number; errors: number; skippedEmpty: number }> {
```

For each track:
- Skip if `artist` or `title` is empty
- Call `updateWithHistory()` — handles both new tracks (creates) and existing
  tracks (updates via merge logic)
- Count imported (new) vs updated (existing) vs errors

Both use cases (refresh meta + add new) are handled by the same call.
`updateWithHistory`'s merge logic already does the right thing:
- New tracks: created with all metadata
- Existing tracks: single-value fields (bpm, rating, year, album, key) update
  via most-recent-dateModified-wins; multi-value fields (genres, grouping) are
  union-merged; `favorite` is last-write-wins.

## Batching

AppleScript iterating thousands of loved tracks can be slow. The osascript
timeout is 120s. For large libraries (2000+ loved tracks), we batch:

### Batch size

Process loved tracks in chunks of **500**. Each batch runs one osascript call
that iterates only that chunk's tracks.

### Implementation

The `readLovedTracks()` function accepts an optional `batchSize` parameter
(default 500). Internally:

1. First, get **all** loved track persistent IDs in a single fast osascript
   call (just `persistent ID of t`, no metadata — this is fast even for large
   libraries).

2. Then, for each batch of IDs, run the full `trackBlock` osascript to get
   metadata for those specific tracks.

3. Each batch is parsed and fed to `importTracks()` immediately, so the caller
   can process incrementally.

### Why two passes?

Pass 1 (IDs only) is fast — one property per track, no `missing value` risk.
It gives us the full list of loved IDs for the star/unstar reconciliation
(which needs the complete set to know what to unstar).

Pass 2 (full metadata) is slower — 12 properties per track. Batching limits
each osascript call to 500 tracks, staying well within the timeout.

### Revised AppleScript scripts

**Pass 1 — IDs only:**

```applescript
tell application "Music"
  set out to ""
  set lovedTracks to (every track of library playlist 1 whose loved is true)
  repeat with t in lovedTracks
    set out to out & (persistent ID of t) & (ASCII character 10)
  end repeat
  return out
end tell
```

Returns one ID per line. Simple, fast, no encoding issues.

**Pass 2 — full metadata for a batch:**

```applescript
-- Receives persistent IDs as command-line arguments
on run argv
  tell application "Music"
    set out to {}
    repeat with pid in argv
      try
        set t to (first track of library playlist 1 whose persistent ID is pid)
        set end of out to trackBlock(t)
      end try
    end repeat
    set AppleScript's text item delimiters to ASCII character 30
    set output to out as text
    set AppleScript's text item delimiters to ""
    return output
  end tell
end run
```

Called via: `osascript -l JavaScript /path/to/script.scpt id1 id2 id3 ...`

Or inline: `osascript -e 'on run argv ... end run' -- id1 id2 id3`

The `whose persistent ID is pid` lookup is fast (Music.app indexes this).
Each track is wrapped in `try` so a missing track doesn't kill the batch.

### Revised sync flow

```
reimportFavouritesFromAppleMusic()
  ├─ readLovedIds()                → string[]  (pass 1: fast, all IDs)
  ├─ star/unstar reconciliation    (existing logic, uses full ID set)
  └─ readLovedTracksBatches()      → ImportableTrack[] (pass 2: batched)
      └─ importTracks(tracks)      → { imported, updated, ... }
          └─ updateWithHistory()   (handles new + existing via merge logic)
```

## Files touched

| File | Change |
|------|--------|
| `src/api/src/helpers/importTypes.ts` | **New** — `ImportableTrack` interface |
| `src/api/src/helpers/appleMusicImport.ts` | **New** — `convertRating`, `parseKeyFromComment`, `detectFormatFromKind` |
| `src/api/src/services/appleMusicRead.ts` | Rewrite — two-pass (IDs + batched metadata), control-character encoding, returns `ImportableTrack[]` |
| `src/api/src/services/songService.ts` | Add `importTracks()`, update `reimportFavouritesFromAppleMusic()` to use it |
| `src/api/scripts/import-apple-music.ts` | Refactor to produce `ImportableTrack[]`, use shared helpers, call `importTracks()` |

## What stays the same

- `updateWithHistory` signature and merge logic — untouched
- `splitTagsField` in `helpers/tags.ts` — already shared
- Star/unstar reconciliation logic — stays sync-specific, but uses IDs from pass 1
- Controller + route + UI — no changes needed (existing endpoint works)
- `appleMusicWrite.ts` — not touched (read-only sync)

## Edge cases

- **osascript unavailable / Music app closed** → pass 1 throws; controller 500s;
  UI shows error, DB untouched.
- **Apple reports 0 Loved** → pass 1 returns empty; star/unstar runs (unstars
  all starred songs with appleMusicIds); pass 2 skips.
- **Track missing from Music.app between pass 1 and pass 2** → `try` block in
  pass 2 skips it; counted but not fatal.
- **Large library** → batching keeps each osascript call under timeout.
  Star/unstar uses the full ID set from pass 1.
- **Comment field with newlines** → preserved intact via control-character
  encoding. `parseKeyFromComment` extracts `musicalKey=...` from the full
  comment text.
- **Duplicate persistent ID across songs** → first match wins (`Map.set` guard).

## Verification

1. Star a song in Music.app that's in the DB as normal → Sync → appears
   starred; history entry `sourceType: applemusic`.
2. Un-star a song in Music.app that's starred in the DB → Sync → unstarred;
   history entry.
3. Star a song in Music.app not in the DB → Sync → new song created with full
   metadata (name, artist, album, duration, genre, grouping, bpm, rating,
   year, key from comment) and shown starred.
4. Close Music.app → Sync → error surfaced in UI, no DB changes.
5. Re-run Sync with no changes → counts are 0, no history churn.
6. Test with a track whose `comment` field contains newlines + `musicalKey=...`
   → key is extracted correctly, comment preserved.
7. Test with a track missing `bpm`, `rating`, `year` → those fields are
   undefined, other fields imported correctly.
