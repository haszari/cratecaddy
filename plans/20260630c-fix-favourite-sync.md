# Fix Apple Music Favourite Sync

## Problem

Two bugs prevent loved/unloved status from syncing correctly from Apple Music XML:

1. `updateWithHistory` uses max-rank merge for favourite: `'starred'` (rank 2) can
   never be overwritten by `'normal'` (rank 0), so unloving a song in Apple Music
   won't clear the flag in CrateCaddy.

2. The import filter (`!hasValidGrouping && !loved`) skips unloved songs that aren't
   in DJing/Listening groups, so they never reach the merge path at all.

## Changes

### 1. Direct-set favourite — `songService.ts` `updateWithHistory`

Replace rank comparison with direct assignment so incoming `favorite` always wins.

### 2. Optional `sourceType` param — `songService.ts` `updateSongMetadata`

Add optional `sourceType` parameter (defaulting to `'manual'`) so the sync pass
can record `'applemusic'` in history.

### 3. Post-import sync pass — `import-apple-music.ts`

After the main import loop, do a second pass:

- Build a `lovedIds` Set from XML tracks with `Loved === true`, keyed by `Persistent ID`.
- Query all `favourite: 'starred'` songs from the DB.
- For each starred song that has an `applemusic` source with an `appleMusicId`:
  - If the `appleMusicId` is still in `lovedIds` → keep starred.
  - If not → call `updateSongMetadata(id, { favorite: 'normal' }, 'applemusic')`,
    logging the un-starred song with artist, title, and appleMusicId.
- Log summary counts: un-starred, stayed starred, skipped (no applemusic source).

## Files touched

| File | Change |
|---|---|
| `src/api/src/services/songService.ts` | Direct-set favourite, optional `sourceType` param |
| `src/api/scripts/import-apple-music.ts` | Sync pass + logging after main import |

## Verification

1. Heart a song in Apple Music → `npm run import:applemusic` → confirm `favourite: 'starred'` in DB
2. Un-heart same song → re-import → confirm `favourite: 'normal'` in DB
3. Check logs for `Favourite sync:` summary line
