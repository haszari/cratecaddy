# Metadata editor — implementation plan

## Overview

Add an edit mode to the app that allows inline editing of song metadata. Edits are last-write-wins, recorded to a History collection, and can be exported back to Apple Music via AppleScript.

**Status**: Partially built. Import merge overhaul (`plans/20260531-import-merge-overhaul.md`) must be completed first — the edit UI depends on solid data in the DB.

## Rollout plan

1. **Song model + History model** — built
2. **Rewrite import scripts** — built (uses `updateWithHistory`)
3. **Full re-import from Apple Music** — built (8581 songs, 8687 history entries)
4. **Remove old merge code** — built (`upsertSongWithMerge` and `mergeSongData` deleted)
5. **Build manual edit API** — built (PUT /:id/metadata, export, history)
6. **Build edit UI** — scaffolded (EditLayout, CompactSongTable, SongEditForm). Needs refinement, bug fixes, field-level components.
7. **End-to-end test** — not started

## Blocked by

Import merge overhaul (see `plans/20260531-import-merge-overhaul.md`):
- Field-level merge for genres/grouping (union, not replace)
- dateModified tiebreaker for single-value fields
- History.entryType: 'create' | 'update'
- Song.appleMusicIds accumulation
- Re-import to fix existing data

## Remaining edit UI work

See `plans/20260531-edit-ui.md` (future) for the full edit UI plan once import data is solid.
