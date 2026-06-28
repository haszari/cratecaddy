# Sorting Refactor Plan

## Bugs

- Sort options are not used in fetch, sorting not working — `fetchSongs` query key missing `sortField`/`sortOrder` → React Query returns stale cache
- Search and shuffle are mutually exclusive — enabling shuffle should clear sort, clicking sort should disable shuffle
  - Sort params sent in API request even when shuffle is active (wasteful; server ignores them)
- No default sort state when shuffle is off

## Root cause

Sort state is scattered across 3 page components as local `useState`. No coordination with shuffle. No URL persistence. Duplicated toggle logic. Single-responsibility violation: `useFilters` manages both filtering (genre, BPM) and display options (shuffle).

## Solution — single `useSortShuffle` hook

One hook owns all list-arrangement state: sort field, sort direction, shuffle. It reads/writes URL search params, enforces mutual exclusion, provides sensible defaults. `useFilters` is freed of shuffle concerns.

### URL contract

Three params managed by the hook:

| URL param | Values | Meaning |
|-----------|--------|---------|
| `sort` | `artist`, `title`, `bpm`, `key`, `rating`, `year` | Sort field |
| `sortDirection` | `asc`, `desc` | Sort direction |
| `shuffle` | seed string or `false` | Shuffle seed; `false` means off |

**Conflict resolution**: if both `sort` and `shuffle` are present in the URL, shuffle wins — `sort` and `sortDirection` are treated as absent.

**Defaults** (applied when the param is absent from URL):

| Condition | sortField | sortDirection | shuffle |
|-----------|-----------|---------------|---------|
| No sort, no shuffle | `rating` | `desc` | off |
| Shuffle active | — | — | shuffled |

### Hook signature

```ts
function useSortShuffle(): {
  sortField: SortField | undefined;
  sortDirection: SortDirection | undefined;
  shuffleSeed: string | undefined;
  shuffleMode: boolean;
  setSort: (field: SortField, direction: SortDirection) => void;
  toggleShuffle: (on: boolean) => void;
  reshuffle: () => void;
  clearSort: () => void;
}
```

All state is derived from URL on every render — no `useState`, no `useEffect`. The hook reads `searchParams`, applies conflict resolution and defaults, returns resolved values. Mutations happen exclusively through `setSearchParams`.

### Mutual exclusion

- `setSort(field, direction)` writes `sort`, `sortDirection` to URL, sets `shuffle=false`
- `toggleShuffle(true)` generates/writes shuffle seed, removes `sort`/`sortDirection` from URL
- `toggleShuffle(false)` writes `sort=rating&sortDirection=desc`, sets `shuffle=false`
- `reshuffle()` generates a new seed, preserves current URL state (sort already absent if shuffle is on)
- `clearSort()` removes `sort`/`sortDirection` from URL

---

## Step 1 — Create `useSortShuffle` hook

**New file:** `src/ui/src/hooks/useSortShuffle.ts`

```ts
export function useSortShuffle() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Read raw values from URL
  const rawSortField = searchParams.get('sort') as SortField | null;
  const rawSortDirection = searchParams.get('sortDirection') as SortDirection | null;
  const rawShuffle = searchParams.get('shuffle');

  const shuffleSeed: string | undefined =
    rawShuffle && rawShuffle !== 'false' ? rawShuffle : undefined;
  const shuffleMode = shuffleSeed !== undefined;

  // Conflict resolution: shuffle wins
  const hasSortConflict = shuffleSeed && rawSortField;
  const resolvedSort: SortField | undefined =
    hasSortConflict ? undefined : (rawSortField ?? undefined);
  const resolvedDirection: SortDirection | undefined =
    hasSortConflict ? undefined : (rawSortDirection ?? undefined);

  // Defaults
  const sortField: SortField | undefined =
    resolvedSort ?? (shuffleMode ? undefined : 'rating');
  const sortDirection: SortDirection | undefined =
    resolvedDirection ?? (shuffleMode ? undefined : 'desc');

  // Mutators
  const setSort = useCallback((field: SortField, direction: SortDirection) => {
    setSearchParams(prev => {
      let next = new URLSearchParams(prev);
      next.set('sort', field);
      next.set('sortDirection', direction);
      next.set('shuffle', 'false');
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const toggleShuffle = useCallback((on: boolean) => {
    setSearchParams(prev => {
      let next = new URLSearchParams(prev);
      if (on) {
        const seed = generateSeed();
        next.set('shuffle', seed);
        next.delete('sort');
        next.delete('sortDirection');
      } else {
        next.set('shuffle', 'false');
        next.set('sort', 'rating');
        next.set('sortDirection', 'desc');
      }
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const reshuffle = useCallback(() => {
    setSearchParams(prev => {
      let next = new URLSearchParams(prev);
      next.set('shuffle', generateSeed());
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const clearSort = useCallback(() => {
    setSearchParams(prev => {
      let next = new URLSearchParams(prev);
      next.delete('sort');
      next.delete('sortDirection');
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  return {
    sortField, sortDirection, shuffleSeed, shuffleMode,
    setSort, toggleShuffle, reshuffle, clearSort,
  };
}
```

## Step 2 — Remove shuffle from `useFilters`

Delete from `useFilters.ts`:
- `shuffleSeed` from `FilterState` interface
- `generateSeed()` function
- `shuffleSeed` reading from URL in the `FilterState` object
- Auto-init `useEffect` that seeds shuffle on first load
- `toggleShuffle`, `reshuffle`, `shuffleMode` exports

Keep: `genreNot`, `bpmGte`, `bpmLte`, `addExclude`, `removeExclude`, `setBpmRange`, `clearFilters`, `hasActiveFilters`.

Consumer impact: Artist.tsx and GenreDetail.tsx previously destructured `{ shuffleMode, toggleShuffle, reshuffle }` from `useFilters`. After the change, they destructure these from `useSortShuffle` instead.

## Step 3 — Rename `sortOrder` → `sortDirection`

All files, both client and server.

| File | Change |
|------|--------|
| `SongTable.tsx` | type `SortOrder` → `SortDirection`; prop `sortOrder` → `sortDirection` |
| `useSortShuffle.ts` | return field `sortDirection` |
| `Artist.tsx` / `GenreDetail.tsx` | rename usage |
| `client.ts` | query string key `'sortOrder'` → `'sortDirection'` |
| `apiParams.ts` | `ApiPaginationParams.sortOrder` → `sortDirection` |
| `pagination.ts` | `PaginationResult.sortOrder` → `sortDirection`; `parsePagination` extraction |
| `songService.ts` | destructure + usage rename |

## Step 4 — SongTable: sort toggle in `SortableHeader` + `onSortChange` includes direction

```ts
interface SongTableProps {
  songs: Song[];
  page?: number;
  totalPages?: number;
  totalCount?: number;
  onPageChange?: (page: number) => void;
  sortField?: SortField;
  sortDirection?: SortDirection;
  onSortChange?: (field: SortField, direction: SortDirection) => void;
}
```

```ts
function SortableHeader({ field, label, sortField, sortDirection, onSortChange }) {
  const sortButton = (field === sortField) && <SortIcon ... />;
  return (
    <th onClick={() => {
      const nextDirection = (field === sortField && sortDirection === 'asc') ? 'desc' : 'asc';
      onSortChange?.(field, nextDirection);
    }}>
      {label}{sortButton}
    </th>
  );
}
```

Same-field toggles asc↔desc. New field starts asc.

## Step 5 — Strip Home.tsx

Remove everything song-list related:
- `fetchSongs` import and query
- `useQueryClient`, `useEditMode`, `SongTable`, `EditLayout`, `SortField`/`SortDirection` imports
- `editToggleRef`, keyboard shortcut handler, stale query invalidation logic
- `editMode.active` conditional return block
- `songs` const, SongTable rendering block
- `isInputFocused` helper

Home page after cleanup: `FilterBar` + help text + genre tag clouds + song count stats. No song list, no edit mode.

## Step 6 — Apply to Artist.tsx and GenreDetail.tsx

Both pages:

```ts
const {
  sortField, sortDirection, shuffleSeed, shuffleMode,
  setSort, toggleShuffle, reshuffle, clearSort,
} = useSortShuffle();
```

Replace local `useState<SortField>`, `useState<SortOrder>`, `handleSortChange` with the hook.

**Wire SongTable:**

```tsx
const handleSort = useCallback((field: SortField, direction: SortDirection) => {
  setSort(field, direction);
  setPage(1);
}, [setSort, setPage]);

<SongTable
  songs={songs}
  page={paginated.page}
  totalPages={paginated.totalPages}
  totalCount={paginated.total}
  onPageChange={setPage}
  sortField={sortField}
  sortDirection={sortDirection}
  onSortChange={handleSort}
/>
```

**Wire FilterBar:**

```tsx
const handleShuffleToggle = useCallback((on: boolean) => {
  toggleShuffle(on);
  setPage(1);
}, [toggleShuffle, setPage]);

<FilterBar
  ...
  shuffleActive={shuffleMode}
  onShuffleToggle={handleShuffleToggle}
  onShuffleReseed={reshuffle}
/>
```

**Wire API call:**

```ts
const extraParams = {
  ...(sortField && { sort: sortField }),
  ...(sortDirection && { sortDirection }),
  ...(genreNotParam && { 'genre.not': genreNotParam }),
  // ... other filters
};

const shuffleParam = shuffleSeed;

const { data: paginated } = useSongs({
  ...extraParams,
  shuffle: shuffleParam,
  page,
  limit: 50,
});
```

Also remove `filters.shuffleSeed` from the `extraParams`-building code in both pages — now `shuffleSeed` comes from `useSortShuffle`.

## Step 7 — Server-side rename

- `apiParams.ts`: `sortOrder` → `sortDirection` in `ApiPaginationParams`
- `pagination.ts`: `PaginationResult.sortOrder` → `sortDirection`; `parsePagination` reads `query.sortDirection`
- `songService.ts`: destructure `sortDirection`, use in sort object construction

## Test scenarios

| Scenario | Expected behavior |
|----------|-------------------|
| Load Artist, no URL params | Sort defaults to rating desc; shuffle off |
| Load Artist with `?shuffle=abc123` | Shuffle on; no sort indicator shown |
| Click sort header while shuffle active | Shuffle deactivates; sort indicator appears (asc for new field) |
| Click shuffle on while sort active | Sort indicator disappears; shuffle activates |
| Click same sort header twice | Order toggles asc→desc on second click |
| Click different sort header | Order resets to asc for new field |
| URL has both `?sort=bpm&shuffle=abc123` | Shuffle wins; sort cleared (rating default suppressed) |
| Navigate to Home | No song table, no sort/shuffle controls |
| Toggle shuffle off | Sort defaults to rating desc |
| Reshuffle | New seed; page unchanged |

## Files changed

| File | Action |
|------|--------|
| `src/ui/src/hooks/useSortShuffle.ts` | **Create** — sort + shuffle state, URL persistence, mutual exclusion, defaults |
| `src/ui/src/hooks/useFilters.ts` | Remove shuffleSeed, toggleShuffle, reshuffle, shuffleMode, auto-init effect |
| `src/ui/src/components/SongTable.tsx` | Rename `SortOrder`→`SortDirection`; `onSortChange(field, direction)`; toggle in `SortableHeader` |
| `src/ui/src/pages/Home.tsx` | Remove song-list, edit-mode, sort imports and blocks |
| `src/ui/src/pages/Artist.tsx` | Replace local sort + `useFilters` shuffle with `useSortShuffle`; add page reset |
| `src/ui/src/pages/GenreDetail.tsx` | Replace local sort + `useFilters` shuffle with `useSortShuffle`; add page reset |
| `src/ui/src/api/client.ts` | Query key `'sortOrder'` → `'sortDirection'` |
| `src/api/src/helpers/apiParams.ts` | Rename `sortOrder` → `sortDirection` in `ApiPaginationParams` |
| `src/api/src/helpers/pagination.ts` | Rename `PaginationResult.sortOrder` → `sortDirection`; update `parsePagination` |
| `src/api/src/services/songService.ts` | Rename destructured `sortOrder` → `sortDirection` |
