# /favourited page + heart as nav/indicator mode

## Goal

Add a dedicated `/favourited` song-list page and refactor the heart button so FilterBar internally manages favourite toggle via `useFilters()`, exposing only a semantic `favouriteMode` prop.

## Architecture change

**Before:** Pages pass `favoriteActive` + `onFavoriteToggle` props to FilterBar. FilterBar renders heart as generic toggle.

**After:** FilterBar internally calls `useFilters()` when `favouriteMode` is not `'nav'` or `'indicator'` to get `toggleFavorite`. No favourite-related props needed from pages (except `favouriteMode` when non-default). Pages still call `useFilters()` for API query building — both read/write the same URL search params, staying in sync.

## `favouriteMode` prop

| Value | Heart appearance | Interaction | Used by |
|---|---|---|---|
| `'filter'` (default) | Filled red when active, outline when inactive | Toggles via internal `useFilters()` | GenreDetail, Artist, EditMetadata (no prop needed — default) |
| `'nav'` | Outline (always) | `<Link to="/favourited">` | Home |
| `'indicator'` | Filled red (always) | None (static) | Favourited page |

**Heart position:** stays in filter group (right side) for all modes.

## Favourited page (new)

`src/ui/src/pages/Favourited.tsx` — modelled on GenreDetail:

- Full song-list page with FilterBar (`favouriteMode="indicator"`), SongTable, GenreTagCloud, pagination, sorting, shuffle
- API query hardcodes `favorite=starred` regardless of URL `favorite` param
- All other filters work: genre exclude, BPM, search, sort, shuffle, edit link
- No page title

## Pages to update

| Page | Change |
|------|--------|
| **FilterBar.tsx** | Add `favouriteMode?: 'filter' \| 'nav' \| 'indicator'` (default `'filter'`); call `useFilters()` internally for toggle; remove `favoriteActive`/`onFavoriteToggle` props |
| **Home.tsx** | Add `favouriteMode="nav"`; remove `favoriteActive`/`onFavoriteToggle` props; remove `favoriteParam` from API query |
| **GenreDetail.tsx** | Remove `favoriteActive`/`onFavoriteToggle` props (no `favouriteMode` needed — default `'filter'`) |
| **Artist.tsx** | Same as GenreDetail |
| **EditMetadata.tsx** | Remove `favoriteActive` prop (no `favouriteMode` needed — default `'filter'`) |
| **Favourited.tsx** | **New** — song list with `favorite=starred` hardcoded |
| **App.tsx** | Add import + route |
| **AGENTS.md** | Add NZ/GB spelling convention |

## Edge cases

- **Favourited page URL manipulation:** `?favorite=false` in URL is ignored — API always sends `favorite=starred`
- **Edit link from Favourited:** `editHref` includes `favorite=starred` so EditMetadata also queries the favourited subset
- **Shuffle on Favourited:** works like any other song list page
- **Direct `/?favorite=true` on Home:** ignored by Home's API query (heart now navigates, not toggles)
