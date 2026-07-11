# Star rating filter in top filter bar

Add a star rating range filter to FilterBar, works on every page with filtering.

## Design

- 5 star icons horizontal, unicode ★/☆, left smallest (0.8em) right largest (1em)
- Range filter: `rating.gte` + `rating.lte` URL params
- Click star to set/toggle/expand range
- Filled stars show active range, outline for excluded
- Unrated songs excluded when filter active
- `readOnly` mode for EditMetadata page

## Interaction

| State | Click star N | Result |
|---|---|---|
| No filter | any | `gte=N, lte=N` |
| Single star (gte=lte) | same star | Clear filter (toggle off) |
| Range active | N < gte | Expand min |
| Range active | N > lte | Expand max |
| Range active | N within range | No change |
| Any active | X button | Clear filter |

## Commits

1. **API filter plumbing** — `apiParams.ts` + `buildSongFilter.ts`
2. **UI filter state + query string** — `useFilters.ts` + `client.ts`
3. **StarRatingFilter component** — new `.tsx` + `.scss`
4. **Wire into FilterBar** — `FilterBar.tsx` + props
5. **Wire up all pages** — `Home.tsx`, `GenreDetail.tsx`, `Artist.tsx`, `Favourited.tsx`, `EditMetadata.tsx`

## Files

| File | Change |
|---|---|
| `src/api/src/helpers/apiParams.ts` | Add `rating.gte`/`rating.lte` to `ApiFilterParams` + `FILTER_PARAM_KEYS` |
| `src/api/src/helpers/buildSongFilter.ts` | Rating range → `{ rating: { $gte, $lte } }` |
| `src/ui/src/hooks/useFilters.ts` | Add `ratingGte`/`ratingLte` to state, `setRatingRange` callback |
| `src/ui/src/api/client.ts` | Add rating params to `buildQueryString` |
| `src/ui/src/components/StarRatingFilter.tsx` | New component |
| `src/ui/src/components/StarRatingFilter.scss` | New styles (pill, stars) |
| `src/ui/src/components/FilterBar.tsx` | Add StarRatingFilter + props |
| `src/ui/src/pages/Home.tsx` | Wire up rating filter |
| `src/ui/src/pages/GenreDetail.tsx` | Wire up rating filter |
| `src/ui/src/pages/Artist.tsx` | Wire up rating filter |
| `src/ui/src/pages/Favourited.tsx` | Wire up rating filter |
| `src/ui/src/pages/EditMetadata.tsx` | Read-only rating filter |
