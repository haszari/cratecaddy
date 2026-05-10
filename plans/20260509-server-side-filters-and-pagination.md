# Implementation Plan: Server-Side Query Layer with Pagination

## Overview

Move filtering, search, and pagination from client-side (in-memory JavaScript) to server-side (MongoDB queries). Two API endpoints share a unified filter interface. React hooks update to pass query params and consume paginated responses.

## Current State

- `GET /api/songs` returns all 8493 songs as a bare array
- React Query caches the full dataset client-side
- GenreDetail and Artist pages fetch ALL songs, then filter with `useMemo` + `.filter()` / `.indexOf()`
- Home page fetches all songs just to compute tag counts via `indexTags()`
- No pagination, no search, no boolean filtering
- `GET /api/songs/stats/genres` exists but accepts no filters

## Design Decisions (agreed)

**Param encoding**: Dot-qualifier suffix per mode — `genre.any`, `genre.all`, `genre.not`, `artist.any`, `artist.all`, `artist.not`. Bare param (`genre=X`) is sugar for `.any`.

**Composition rules**:
- Values within `.any` / `.all` / `.not` are comma-separated
- `.any` values are OR-ed (substring match)
- `.all` values are AND-ed (song must match all)
- `.not` values are OR-ed internally (exclude song if ANY match)
- All param groups are AND-ed together at the top level

**Substring matching**: `genre=Techno` matches ["Minimal Techno", ...]. Artist uses regex (same `indexOf`-like behaviour as current client).

**Response envelope**: `{ data: Song[], page: number, limit: number, total: number, totalPages: number }`

**Shuffle param**: `shuffle=<seed>` for deterministic random order (Phase 5, defined but not implemented here).

**Out of scope**: Portable offline JSON mode.

---

## File-by-file plan

### Backend (src/api/)

#### 1. Create `src/api/src/helpers/buildSongFilter.ts` (new)

Parse dot-qualified params into a Mongoose filter object.

```
Input:  req.query = { 'genre.any': 'Techno,House', 'genre.not': 'Ambient' }
Output: { $and: [
           { $or:  [{ genres: /techno/i }, { genres: /house/i }] },
           { $nor: [{ genres: /ambient/i }]               } ]
         }
```

One function per param mode, composed by a single `buildSongFilter(query)` entry point:

```typescript
interface SongFilterParams {
  'genre.any'?: string;   // comma-separated
  'genre.all'?: string;
  'genre.not'?: string;
  'artist.any'?: string;
  'artist.all'?: string;
  'artist.not'?: string;
  search?: string;        // free text across artist+title+genres
}

function buildSongFilter(params: SongFilterParams): FilterQuery<ISong>
```

Each mode dispatches to a builder:
- `buildAnyFilter(field, values)` → `{ $or: [...] }`
- `buildAllFilter(field, values)` → `{ $and: [...] }`
- `buildNotFilter(field, values)` → `{ $nor: [...] }`
- `buildSearchFilter(term)` → `{ $or: [/term/i on artist, title, genres] }`

Params apply to `genres` or `artist` fields based on the param prefix. Shared helper:

```typescript
function buildCondition(field: 'genres' | 'artist', mode: 'any' | 'all' | 'not', values: string[]): FilterQuery<ISong>
```

Values are split on comma, trimmed. Each value becomes a case-insensitive regex.

#### 2. Create `src/api/src/helpers/pagination.ts` (new)

Parse page/limit from query, apply to Mongoose query.

```typescript
interface PaginationParams {
  page?: string;   // 1-indexed, default 1
  limit?: string;  // default 50, max 200
}

interface PaginationResult {
  page: number;
  limit: number;
  skip: number;
}

function parsePagination(query: PaginationParams): PaginationResult
```

#### 3. Update `src/api/src/services/songService.ts`

Add two new methods. Keep existing methods for backward compat (import scripts still use them).

```typescript
class SongService {
  // Existing methods (untouched):
  //   getAllSongs(), getSongById(), findMatchingSong(), mergeSongData(),
  //   upsertSongWithMerge(), createSong(), updateSong(), deleteSong()

  // New:
  async querySongs(params: {
    filters: SongFilterParams;
    pagination: PaginationParams;
  }): Promise<{ data: ISong[]; page: number; limit: number; total: number; totalPages: number }>

  async getFilteredGenreStats(filters: SongFilterParams): Promise<
    Array<{ genre: string; count: number }>
  >
}
```

`querySongs` implementation:
```
1. buildSongFilter(filters) → mongoose filter
2. parsePagination(pagination) → { page, limit, skip }
3. const [data, total] = await Promise.all([
     Song.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
     Song.countDocuments(filter)
   ])
4. return { data, page, limit, total, totalPages: Math.ceil(total / limit) }
```

`getFilteredGenreStats` implementation:
```
1. buildSongFilter(filters) → $match stage
2. Prepend $match to existing aggregation pipeline:
     [ { $match: filter }, { $unwind: '$genres' }, { $group: ... }, { $sort: ... } ]
```

#### 4. Update `src/api/src/controllers/songController.ts`

Rewrite `getAllSongs` to accept filter + pagination params. Update `getGenreStats` to accept filter params.

```typescript
async getAllSongs(req: Request, res: Response) {
  const filters = extractSongFilterParams(req.query);  // pull known params
  const pagination = extractPaginationParams(req.query); // page, limit
  const result = await songService.querySongs({ filters, pagination });
  // Normalize genres on each song in result.data
  res.json(result);
}

async getGenreStats(req: Request, res: Response) {
  const filters = extractSongFilterParams(req.query);
  const stats = await songService.getFilteredGenreStats(filters);
  res.json(stats);
}
```

No changes to CRUD by ID (create, update, delete, getSongById stay the same).

#### 5. Update `src/api/src/routes/songs.ts`

No route changes needed — filter params are query params on existing `GET /` and `GET /stats/genres`. The route file stays identical.

---

### Frontend (src/ui/)

#### 6. Update `src/ui/src/types/index.ts`

Add paginated response type:

```typescript
export interface PaginatedResponse<T> {
  data: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
```

#### 7. Update `src/ui/src/api/client.ts`

New functions, existing ones kept or deprecated:

```typescript
export async function fetchSongs(params?: {
  genreAny?: string;
  genreAll?: string;
  genreNot?: string;
  artistAny?: string;
  artistAll?: string;
  artistNot?: string;
  search?: string;
  page?: number;
  limit?: number;
}): Promise<PaginatedResponse<Song>>

export async function fetchGenreStats(params?: {
  genreAny?: string;
  genreAll?: string;
  genreNot?: string;
  artistAny?: string;
  artistAll?: string;
  artistNot?: string;
  search?: string;
}): Promise<Array<{ genre: string; count: number }>>
```

Build query string from the params object, skip undefined keys.

#### 8. Update `src/ui/src/hooks/useSongs.ts`

Accept filter + pagination params, pass to `fetchSongs`. Query key includes params so React Query cache invalidation works per-filter.

```typescript
export function useSongs(params?: {
  genreAny?: string;
  // ...all filter params...
  page?: number;
  limit?: number;
}) {
  return useQuery({
    queryKey: ['songs', params],     // cache per filter config
    queryFn: () => fetchSongs(params ?? {}),
  });
}
```

#### 9. Create `src/ui/src/hooks/useSongsByGenre.ts` (replacement)

Currently fetches all songs and client-filters. New version calls server:

```typescript
export function useSongsByGenre(genre: string | undefined, page = 1) {
  return useSongs({
    genreAny: genre,
    page,
    limit: 50,
  });
}
```

Thin wrapper. Same for `useSongsByArtist`.

#### 10. Update `src/ui/src/hooks/useSongsByArtist.ts`

```typescript
export function useSongsByArtist(artist: string | undefined, page = 1) {
  return useSongs({
    artistAny: artist,
    page,
    limit: 50,
  });
}
```

#### 11. Update `src/ui/src/pages/Home.tsx`

Switch from `useSongs()` to `fetchGenreStats()` directly:

```typescript
const { data: stats, isLoading } = useQuery({
  queryKey: ['genreStats'],
  queryFn: fetchGenreStats,
});
```

No more song data fetched for the home page. Tag cloud built from stats response directly, no `indexTags()` needed.

Remove the `useSongs` import, replace with `useQuery` + `fetchGenreStats`.

#### 12. Update `src/ui/src/pages/GenreDetail.tsx`

Use new `useSongsByGenre` hook with pagination. Fetch genre stats in parallel for related tags:

```typescript
const [page, setPage] = useState(1);

const { data: paginatedSongs, isLoading: songsLoading } = useSongsByGenre(genreName, page);
const { data: relatedTags } = useQuery({
  queryKey: ['genreStats', 'genre.any', genreName],
  queryFn: () => fetchGenreStats({ genreAny: genreName }),
});
```

Add pagination controls (prev/next buttons, page indicator). Remove `indexTags` — related tags come from the filtered stats API.

#### 13. Update `src/ui/src/pages/Artist.tsx`

Same pattern as GenreDetail but for artist:

```typescript
const [page, setPage] = useState(1);

const { data: paginatedSongs, isLoading } = useSongsByArtist(artistName, page);
const { data: relatedTags } = useQuery({
  queryKey: ['genreStats', 'artist.any', artistName],
  queryFn: () => fetchGenreStats({ artistAny: artistName }),
});
```

#### 14. Update `src/ui/src/components/SongTable.tsx`

Accept songs as data (already does). Add optional pagination props:

```typescript
interface SongTableProps {
  songs: Song[];
  page?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
}
```

Render prev/next buttons when pagination props provided. Page state lives in the parent page component.

---

## Dependency flow

```
buildSongFilter.ts  ←── pagination.ts
        ↓                    ↓
  songService.ts ────────────┘
        ↓
  songController.ts
        ↓
  routes/songs.ts (unchanged)
```

```
  client.ts ──→ useSongs() ──→ useSongsByGenre() / useSongsByArtist()
                                     ↓
                              Home / GenreDetail / Artist
```

---

## Files to create

| File | Purpose |
|------|---------|
| `src/api/src/helpers/buildSongFilter.ts` | Build Mongoose filter from dot-qualified params |
| `src/api/src/helpers/pagination.ts` | Parse page/limit, compute skip |

## Files to modify

| File | Change |
|------|--------|
| `src/api/src/services/songService.ts` | Add `querySongs()`, `getFilteredGenreStats()` |
| `src/api/src/controllers/songController.ts` | Accept filter + pagination params in `getAllSongs` and `getGenreStats` |
| `src/ui/src/types/index.ts` | Add `PaginatedResponse<T>` |
| `src/ui/src/api/client.ts` | Add `fetchSongs(params)`, `fetchGenreStats(params)` |
| `src/ui/src/hooks/useSongs.ts` | Accept optional filter/pagination params, update query key |
| `src/ui/src/hooks/useSongsByGenre.ts` | Pass `genreAny` param to `useSongs` |
| `src/ui/src/hooks/useSongsByArtist.ts` | Pass `artistAny` param to `useSongs` |
| `src/ui/src/pages/Home.tsx` | Use `fetchGenreStats()` instead of `useSongs()` |
| `src/ui/src/pages/GenreDetail.tsx` | Use `useSongsByGenre(page)`, add pagination UI, fetch related tags from API |
| `src/ui/src/pages/Artist.tsx` | Use `useSongsByArtist(page)`, add pagination UI, fetch related tags from API |
| `src/ui/src/components/SongTable.tsx` | Add optional pagination controls |

## Files not changed

- `src/api/src/routes/songs.ts` — route paths stay the same, only query params change
- `src/api/src/models/Song.ts` — no schema change (shuffle is Phase 5)
- `src/api/src/config/database.ts` — no change
- `src/api/src/server.ts` — no change
- `src/ui/src/main.tsx` — no change
- `src/ui/src/lib/queryClient.ts` — no change (existing React Query config works)
- `src/ui/src/utils/tagUtils.ts` — kept for now, can be removed as follow-up
- `src/ui/src/components/GenreTag.tsx`, `GenreTagCloud.tsx`, `SourcesIcons.tsx` — no change

## Edge cases

- **No params**: `GET /api/songs` returns page 1, limit 50, all songs sorted by createdAt desc (current default sort)
- **Empty result**: `{ data: [], page: 1, limit: 50, total: 0, totalPages: 0 }`
- **Page beyond range**: Return empty data array, current page, total stays correct
- **Invalid page/limit**: Fall back to defaults (page=1, limit=50)
- **Malformed regex characters** in genre/artist values: escape with `escapeRegex()` before constructing `RegExp`
- **Unknown params**: Silently ignored (future-proof, `shuffle` will be added later)

## Manual test plan

1. `GET /api/songs` with no params → first 50 songs, total = 8493
2. `GET /api/songs?genre.any=Techno` → only Techno-matching songs, paginated
3. `GET /api/songs?genre.all=Techno,House` → songs with both tags
4. `GET /api/songs?genre.not=Ambient,Pop` → no songs with those tags
5. `GET /api/songs?page=2&limit=10` → correct offset
6. `GET /api/songs?artist.any=Bailey` → matches artist containing "Bailey"
7. `GET /api/songs/stats/genres?genre.any=Techno` → genre distribution within Techno
8. Home page loads without fetching songs (check network tab)
9. GenreDetail page loads only paginated subset + filtered stats
10. Artist page same as GenreDetail
11. Pagination controls navigate pages correctly
12. URL params compose: `?genre.any=Techno,House&genre.not=Ambient&artist.any=Jim&page=1`
