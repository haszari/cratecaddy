# Import merge overhaul

Date: 2026-05-31
Status: Draft

## Problem

Duplicate Library items for the same song (local file + Apple Music stream) cause last-write-wins data loss. The stream version's garbage metadata ("Dance, BAM") overwrites the file version's curated genres ("Minimal, Techno, Ambient Techno, Dub Techno, Deep, Warmup, Later").

## Approach

Field-level merge at import time, with `dateModified` tiebreaker for single-value conflicts. Every Library item writes a History entry regardless of whether it changed the canonical doc.

## Merge rules

| Field | Strategy |
|-------|----------|
| genres | union — deduped merge |
| grouping | union — deduped merge |
| favorite | union — max(starred=2, disliked=1, normal=0) |
| bpm, key, year, album, rating | existing holds; incoming fills nulls; if both non-null and differ → most-recent dateModified wins |
| appleMusicId (top-level) | canonical — elected by format hierarchy (AIFF > WAV > AAC > MP3 > ALAC > applemusicstream) |
| appleMusicIds (new) | all unique persistent IDs accumulated across imports |
| sources[] | one entry per Library item (unchanged; already accumulates) |

## History

Every matched Library item writes a History entry with:
- `snapshot` = resulting canonical state after merge
- `importMeta.importStrategy`: `'create'` (first import), `'update'` (data changed), `'noop'` (matched but no effective change)

## Format hierarchy (AIFF > WAV > AAC > MP3 > ALAC > applemusicstream)

Used for electing canonical `appleMusicId` — i.e. "which copy to play/update metadata for." Not a data tiebreaker.

## Steps

1. Write plan (this doc) + update AGENTS.md with commit format → commit
2. Song model: add `appleMusicIds: string[]` field → commit
3. Service: rewrite `updateWithHistory` with field-level merge → commit
4. Importer: wire up dateModified, format hierarchy — already does sort → commit
5. Re-import, verify Konduku Meskendir has correct genres, confirm History entries → no commit
6. Return to edit UI work

## Files affected

- `src/api/src/models/Song.ts`
- `src/api/src/services/songService.ts`
- `src/api/scripts/import-apple-music.ts`
- `plans/20260531-import-merge-overhaul.md` (this file)
- `AGENTS.md`
