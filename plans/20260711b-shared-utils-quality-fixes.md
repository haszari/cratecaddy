# Shared utilities, useSongPage hook, comprehensive quality fixes

## Context

Three pages (`GenreDetail`, `Artist`, `Favourited`) share ~80% identical code. Two utility functions are copy-pasted in three places each. Several bugs exist (Favourited editHref, TempoRangeControl keyboard, falsy "0" values, stale search input). Derived data lacks memoization, error styling is inconsistent, and genre stats queries receive unnecessary params.

## Commits (one per fix, in order)

| # | Commit | Files |
|---|--------|-------|
| 1 | Extract `splitCSV` + `setParam` to `utils/urlParams.ts` | `utils/urlParams.ts` (new), `useFilters.ts`, `Artist.tsx`, `Favourited.tsx` |
| 2 | Create `useSongPage` hook | `hooks/useSongPage.ts` (new), `GenreDetail.tsx`, `Artist.tsx`, `Favourited.tsx` |
| 3 | Fix Favourited editHref string concatenation | `utils/urlBuilder.ts`, `Favourited.tsx` |
| 4 | Remove unused BasePageCriteria import from Favourited | `Favourited.tsx` |
| 5 | Fix TempoRangeControl keyboard activation (Space + setRange) | `TempoRangeControl.tsx` |
| 6 | Fix FilterBar search input sync with prop changes | `FilterBar.tsx` |
| 7 | Fix BPM/rating "0" falsy bug in buildSongFilter | `buildSongFilter.ts` |
| 8 | Add defensive inverted range guard in buildSongFilter | `buildSongFilter.ts` |
| 9 | Extract error styling to `.error-message` CSS class | `App.scss`, `Home.tsx`, `GenreDetail.tsx`, `Artist.tsx`, `Favourited.tsx`, `EditMetadata.tsx` |
| 10 | Remove unnecessary sort/shuffle/page params from genre stats query | `useSongPage.ts` (or pages if hook not yet done) |
| 11 | Wrap derived computations in useMemo/useCallback | `GenreDetail.tsx`, `Home.tsx` |
| 12 | Move computeCentre/computeRange outside TempoRangeControl | `TempoRangeControl.tsx` |

## Commit 1: Extract shared utilities

Create `src/ui/src/utils/urlParams.ts` with `splitCSV` and `setParam`.
Update `useFilters.ts`, `Artist.tsx`, `Favourited.tsx` to import from shared module.

## Commit 2: Create useSongPage hook

Create `src/ui/src/hooks/useSongPage.ts` encapsulating shared state, callbacks, data fetching, and prop assembly across the three song-table pages.

## Commit 3: Fix Favourited editHref

`buildEditUrl(location.search, 'favourited') + '&favorite=starred'` can produce duplicate params.
Pass `favorite` through `buildEditUrl` properly.

## Commit 4: Remove unused import

`Favourited.tsx` imports `BasePageCriteria` but renders custom inline JSX.

## Commit 5: TempoRangeControl keyboard

`onKeyDown` only handles Enter, not Space. `setRange(5)` missing from keyboard path.

## Commit 6: FilterBar search sync

`useState(search ?? '')` doesn't update when `search` prop changes (browser back/forward).

## Commit 7: "0" falsy bug

`if (bpmGte)` drops `"0"` because it's falsy. Should check `!== ''` instead.

## Commit 8: Inverted range guard

Manual URL manipulation can produce `gte > lte`. Swap if both defined and inverted.

## Commit 9: Error CSS class

All 5 pages use inline `style={{ color: 'red' }}`. Extract to `.error-message` in `App.scss`.

## Commit 10: Genre stats params

Genre stats query receives sort/shuffle/page params it doesn't need. Build separate stats-only params.

## Commit 11: Missing useMemo

`decodedGenres`, `tags`/`main`/`fringe`, `totalSongs`, `hasTag` recreated every render.

## Commit 12: Extract pure functions

`computeCentre`/`computeRange` in TempoRangeControl are pure functions defined inside component body.
