# Fix new song constructor missing fields

## Problem

`updateWithHistory`'s create path (`new Song({...})`) omits `favorite`, so
freshly imported songs don't get their favourite status persisted. Only the
merge path (existing songs) sets `favorite` via direct assignment.

This caused a fresh reimport to produce 0 starred songs — the sync pass had
nothing to act on because no songs had `favorite: 'starred'`.

## Audit

Compared `ISong` model fields against the constructor:

| Field | In constructor? | Note |
|---|---|---|
| title | ✓ | |
| artist | ✓ | |
| album | ✓ | |
| duration | ✓ | |
| genres | ✓ | |
| grouping | ✓ | |
| bpm | ✓ | |
| key | ✓ | |
| rating | ✓ | |
| year | ✓ | |
| favorite | **✗** | Only field missing |
| appleMusicId | ✓ | |
| appleMusicIds | ✓ | |
| sources | ✓ | |
| artistTitleNormalized | (auto by hook) | |
| createdAt/updatedAt | (auto by timestamps) | |

No other fields are missing. `artistTitleNormalized` is set by the pre-validate
hook, so omitting it from the constructor is intentional.

## Fix

Add `favorite: songData.favorite,` to the `new Song({})` constructor in
`updateWithHistory` (`songService.ts:276`).

## Files touched

| File | Change |
|---|---|
| `src/api/src/services/songService.ts` | Add `favorite` to new Song constructor |
