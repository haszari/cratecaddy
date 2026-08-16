# Sync favourites (hearts) from Apple Music via AppleScript

GitHub issue [#18](https://github.com/haszari/cratecaddy/issues/18) — sync starred/heart state
between Apple Music and CrateCaddy without the heavy XML export + import cycle.

## Problem

- Import is quick but heavy: export `Library.xml`, then run `npm run import:applemusic`.
- Between imports, hearts drift out of sync with Apple Music "Favourite Songs".
- AppleScript (`osascript`) is already used for DB → Apple writes (`appleMusicWrite.ts`),
  but there is **no read-back**: nothing queries the Music app for Loved status, and the
  favourite sync only runs as a post-pass inside the XML importer.

## Goal

Add a **"Sync with Apple Music"** button on the `/favourited` page that reconciles the
starred state with Apple Music's Loved flag via AppleScript:

- DB songs starred but not Loved in Apple → un-star (`favorite: 'normal'`).
- Apple Music Loved tracks that match a DB song → star it (`favorite: 'starred'`).
- Apple Music Loved tracks **not** in the DB → create a song, importing as much metadata
  as AppleScript can provide.

## Decisions

1. **Heart = star only.** This sync manages Apple Music `Loved` ↔ DB `favorite: 'starred'`
   only. `Disliked` is out of scope — matches the existing favourite-sync pass in
   `import-apple-music.ts` (which only un-stars). Recorded as ADR 0013.
2. **One-way, Apple → DB.** The user stars on the phone; DB hearts are never written back
   to Apple. Write-back stays out of scope (also means `appleMusicWrite.ts` is untouched).
3. **Loved tracks missing from the DB get created.** Read name/artist/album/duration/
   genre/grouping/bpm/rating/year via AppleScript and reuse the `updateWithHistory`
   new-song path (history + normalisation hooks + source accumulation). No song is
   created with empty artist/title — skip and report those.
4. **Manual action only.** No periodic/background sync; the button is the trigger.
5. **Page-local button.** Lives on `/favourited` only, per the issue. FilterBar is shared
   by six pages — don't touch it.

## API

### New service — `src/api/src/services/appleMusicRead.ts`

```typescript
export interface AppleLovedTrack {
  persistentId: string;
  name: string;
  artist: string;
  album?: string;
  duration?: number; // ms (Music `total time`)
  genre?: string;    // comma-separated, split server-side like XML import
  grouping?: string;
  bpm?: number;
  rating?: number;   // 0–100 (Music scale) → ÷20 for DB
  year?: number;
}

export async function readLovedTracks(): Promise<AppleLovedTrack[]>
```

AppleScript (one track per line, fields joined with ASCII 31, i.e. `\u001f`):

```applescript
tell application "Music"
  set out to {}
  set lovedTracks to (every track of library playlist 1 whose loved is true)
  repeat with t in lovedTracks
    set end of out to ((persistent ID of t) & (ASCII character 31) & (name of t) & (ASCII character 31) & (artist of t) & (ASCII character 31) & (album of t) & (ASCII character 31) & (total time of t) & (ASCII character 31) & (genre of t) & (ASCII character 31) & (grouping of t) & (ASCII character 31) & (bpm of t) & (ASCII character 31) & (rating of t) & (ASCII character 31) & (year of t))
  end repeat
  return out
end tell
```

Run with `exec('osascript -e ...')` using the same single-quote-escaping pattern as
`appleMusicWrite.ts`, `on error` block returning `"error: " & errMsg`, and a generous
timeout (**120 000 ms** — `whose loved is true` iterates the whole library and can be slow
on big collections). Skip lines with a missing/empty persistent ID.

### `songService.ts` — new `syncFavouritesFromAppleMusic()`

```typescript
async syncFavouritesFromAppleMusic(): Promise<SyncFavouritesResult> {
  const { readLovedTracks } = await import('./appleMusicRead.js');
  const loved = await readLovedTracks();

  const lovedById = new Map(loved.map((t) => [t.persistentId, t]));
  const ids = [...lovedById.keys()];

  // Load existing songs that reference any of these IDs (both id locations)
  const matchedSongs = await Song.find({
    $or: [{ appleMusicIds: { $in: ids } }, { 'sources.appleMusicId': { $in: ids } }],
  });
  const songByAppleId = new Map<string, ISong>(); // first song wins
  for (const song of matchedSongs) {
    for (const id of allAppleIds(song)) {
      if (!songByAppleId.has(id)) songByAppleId.set(id, song);
    }
  }

  // 1. Star DB songs that are Loved in Apple but not currently starred
  let starred = 0;
  for (const [id] of lovedById) {
    const song = songByAppleId.get(id);
    if (!song) continue;
    if (song.favorite !== 'starred') {
      await this.updateSongMetadata(String(song._id), { favorite: 'starred' }, 'applemusic');
      starred++;
    }
  }

  // 2. Un-star DB songs that are starred but no longer Loved in Apple
  let unstarred = 0;
  let skippedNoAppleId = 0;
  for (const song of await Song.find({ favorite: 'starred' })) {
    const ids = allAppleIds(song);
    if (ids.length === 0) { skippedNoAppleId++; continue; }
    if (ids.some((id) => lovedById.has(id))) continue; // still Loved
    await this.updateSongMetadata(String(song._id), { favorite: 'normal' }, 'applemusic');
    unstarred++;
  }

  // 3. Create songs for Loved tracks with no DB match
  let added = 0;
  let skippedEmpty = 0;
  for (const [id, track] of lovedById) {
    if (songByAppleId.has(id)) continue;
    if (!track.artist?.trim() || !track.name?.trim()) { skippedEmpty++; continue; }
    await this.updateWithHistory(track.artist, track.name, track.duration, {
      genres: splitTagsField(track.genre),
      grouping: splitTagsField(track.grouping),
      bpm: track.bpm,
      rating: track.rating !== undefined ? track.rating / 20 : undefined,
      year: track.year,
      album: track.album,
      appleMusicId: id,
      favorite: 'starred',
    }, {
      sourceType: 'applemusic',
      appleMusicId: id,
    });
    added++;
  }

  return { lovedCount: loved.length, starred, unstarred, added, skippedNoAppleId, skippedEmpty };
}

function allAppleIds(song: ISong): string[] {
  return [...new Set([
    ...(song.appleMusicIds || []),
    ...(song.sources || []).map((s) => s.appleMusicId).filter(Boolean),
  ])];
}
```

Notes:

- `updateSongMetadata` already records `sourceType: 'applemusic'` in history.
- `updateWithHistory`'s new-song branch handles genres/genre normalisation, `appleMusicIds`
  accumulation, and history — no new write path needed. `splitTagsField` is currently
  private to the import script; hoist it to a shared helper (or duplicate it) so both
  consumers use the same comma-splitting logic.
- The un-star pass mirrors the existing XML sync pass exactly, so behaviour stays
  consistent between the two entry points.

### Controller — `songController.ts`

```typescript
async syncFavouritesFromAppleMusic(req: Request, res: Response) {
  try {
    const result = await songService.syncFavouritesFromAppleMusic();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to sync favourites from Apple Music' });
  }
}
```

### Route — `routes/songs.ts`

```typescript
router.post('/sync-favourites-from-apple-music', (req, res) => songController.syncFavouritesFromAppleMusic(req, res));
```

No conflict with existing routes — `POST /:id` doesn't exist, so the literal path is unambiguous.

## UI

### `src/ui/src/api/client.ts`

```typescript
export interface SyncFavouritesResult {
  lovedCount: number; starred: number; unstarred: number;
  added: number; skippedNoAppleId: number; skippedEmpty: number;
}

export async function syncFavouritesFromAppleMusic(): Promise<SyncFavouritesResult> {
  const response = await fetch(`${API_URL}/api/songs/sync-favourites-from-apple-music`, {
    method: 'POST',
  });
  if (!response.ok) {
    const body = await response.json();
    throw new Error(body.error ?? body.message ?? 'Failed to sync favourites from Apple Music');
  }
  return response.json();
}
```

### `src/ui/src/pages/Favourited.tsx`

- Add a "Sync with Apple Music" action pill in the `.PageCriteria` row (next to the heart
  heading), styled with the existing `pill--action` look.
- `useMutation(syncFavouritesFromAppleMusic)` with idle / syncing / success / error states:
  - Syncing: disabled button + `Loader2` spinner, text "Syncing…" (matches
    SingleSongMetadataEditForm status pattern).
  - Success: `queryClient.invalidateQueries({ queryKey: ['songs'] })` and
    `['genreStats']` so the list + tag cloud refresh. Status text:
    `Synced with Apple Music: X starred, Y un-starred, Z added`.
  - Error: red status text, no invalidation.
- The page already re-queries via `useSongPage` — invalidation is enough; no manual state.

## Files touched

| File | Change |
|---|---|
| `src/api/src/services/appleMusicRead.ts` | **New** — osascript read of Loved tracks |
| `src/api/src/services/songService.ts` | `syncFavouritesFromAppleMusic()` |
| `src/api/src/controllers/songController.ts` | New controller method |
| `src/api/src/routes/songs.ts` | New `POST /sync-favourites-from-apple-music` |
| `src/api/scripts/import-apple-music.ts` | Hoist `splitTagsField` (or share) |
| `src/ui/src/api/client.ts` | `syncFavouritesFromAppleMusic()` |
| `src/ui/src/pages/Favourited.tsx` | Sync button + status + invalidation |
| `src/ui/src/pages/GenreDetail.scss` (or Favourited.scss) | Button/status styles |
| `docs/adr/0013-sync-favourites-apple-music.md` | **New** — decision record |
| `CONTEXT.md` | "Starred" section: document the sync action |
| `AGENTS.md` | Add route to architecture notes; note sync is heart-only |

## Edge cases

- **osascript unavailable / Music app closed** → read throws; controller 500s; UI shows
  error, DB untouched.
- **Apple reports 0 Loved** → that's the truth (script succeeded); all starred DB songs
  with appleMusicIds get un-starred, as requested.
- **Starred song with multiple appleMusicIds** → un-star only if *none* are Loved.
- **Duplicate ID across songs** → first match wins (`Map.set` guard).
- **Loved track with empty name/artist** → skipped + counted, not created.
- **Large library** → 2-minute osascript timeout; button shows an indeterminate spinner.
  No progress bar (out of scope).
- **Song starred in DB with no appleMusicId** → skipped (can't verify), counted.

## Out of scope

- DB → Apple favourite write-back (adds `set loved` to `appleMusicWrite.ts`).
- `Disliked` handling in sync.
- Periodic/auto sync, progress reporting per track.
- Sync button on pages other than `/favourited`.
- `favorite` field in the edit forms / batch-metadata allowlist.

## ADR 0013 (draft, create when implemented)

**Question:** What does "Sync with Apple Music" do for favourites?

**Decision:** One-way Apple → DB. Apple Music `Loved` ↔ DB `favorite: 'starred'` only.
Disliked is untouched. Loved tracks absent from the DB are created with whatever metadata
AppleScript provides. DB hearts are never written back to Apple.

**Rationale:** The user marks songs on the phone; DB is the triage/curation layer. Two-way
sync risks clobbering on-phone stars with stale DB state, and heart = star matches the
existing XML favourite-sync pass, so both entry points agree.

**Rejected:** full tri-state sync (adds disliked UI + merge complexity, not requested);
two-way write-back (conflicts with the on-phone triage workflow, adds `appleMusicWrite.ts`
risk to a shared write path).

## Verification

1. Star a song in the Music app that's in the DB as normal → Sync on `/favourited` →
   appears starred; history entry `sourceType: applemusic`.
2. Un-star a song in the Music app that's starred in the DB → Sync → un-starred; history entry.
3. Star a song in the Music app not in the DB → Sync → new song created (name/artist/album/
   duration/genre/grouping/bpm/rating/year) and shown starred.
4. Close the Music app → Sync → error surfaced in the UI, no DB changes.
5. Re-run Sync with no changes → counts are 0, no history churn (dedup in `pushHistory`).
