# Import merge overhaul

Date: 2026-05-31
Status: Active

## Problem

Duplicate Library items for the same song (local file + Apple Music stream) cause last-write-wins data loss. The stream version's garbage metadata ("Dance, BAM") overwrites the file version's curated genres ("Minimal, Techno, Ambient Techno, Dub Techno, Deep, Warmup, Later").

Root cause: `updateWithHistory` unconditionally overwrites all fields on match. When two Library entries share the same canonical song (same normalized artist + title + duration), the last one processed wins regardless of data quality.

## Approach

Field-level merge at import time, with `dateModified` tiebreaker for single-value conflicts. Every Library item writes a History entry regardless of whether it changed the canonical doc.

## Merge rules

| Field | Strategy |
|-------|----------|
| genres | union — deduped merge |
| grouping | union — deduped merge |
| favorite | union — max(starred=2, disliked=1, normal=0) |
| bpm, key, year, album, rating | existing holds; incoming fills nulls; if both non-null and differ → most-recent `dateModified` wins |
| appleMusicId (top-level) | canonical — elected by format hierarchy (AIFF > WAV > AAC > MP3 > ALAC > applemusicstream) |
| appleMusicIds (new) | all unique persistent IDs accumulated across imports |
| sources[] | one per Library item (unchanged; already accumulates) |

## History changes

Currently `IHistoryEntry` has `sourceType` (who: applemusic/manual etc) + freeform `importMeta`.

Add top-level field:

```typescript
entryType: 'create' | 'update';  // what happened to the song doc
```

- `'create'` — this import created the Song doc
- `'update'` — this import matched an existing Song doc (merge may or may not have changed fields)

Every Library item that passes the DJing/Listening filter writes a History entry, regardless of whether the merge changed any canonical field. The `snapshot` always records the resulting canonical state. `importMeta` carries the raw track metadata as before. No `'noop'` — being processed is meaningful.

## Format hierarchy

AIFF > WAV > AAC > MP3 > ALAC > applemusicstream

Used only for electing canonical `appleMusicId` ("which copy to play / target for export"). Not a data tiebreaker.

## File sort at import

Library entries for local files (Track Type = File) are sorted to process after Remote entries. This is a safety net so that when merge is ambiguous, the last-write wins with the better source. The sort is already implemented.

## Steps (waypoint commits)

1. Song model: add `appleMusicIds: string[]`, add `entryType` to History schema → commit
2. Service: rewrite `updateWithHistory` with field-level merge + dateModified tiebreaker → commit
3. Importer: confirm dateModified passes through, verify sort, re-import → commit or no-commit
4. Verify: re-import, check Konduku Meskendir has correct genres, confirm History entries with entryType → verify

## Files affected

- `src/api/src/models/Song.ts`
- `src/api/src/models/History.ts`
- `src/api/src/services/songService.ts`
- `src/api/scripts/import-apple-music.ts`
- `plans/20260531-import-merge-overhaul.md`
