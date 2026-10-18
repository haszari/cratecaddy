/**
 * Pure, in-memory query implementation of CrateCaddy browse semantics.
 *
 * This module is the contract shared by the two filter implementations (see
 * docs/adr/0014-parallel-filter-implementations-parity-contract.md):
 *
 * - `buildSongFilter.ts` translates the same params into a MongoDB query and is
 *   the path used by the API.
 * - The functions here evaluate params against an in-memory song list and are
 *   used by the static Snapshot build in the browser.
 *
 * Both are deliberate and are kept honest by `scripts/check-browse.ts` (`npm run check:browse`), which
 * asserts identical membership, counts, and genre stats for a fixed param
 * matrix. Sort order is NOT asserted: MongoDB collation cannot be mirrored
 * exactly, and ordering is presentation, not correctness. Strings are compared
 * byte-wise (UTF-16 code units), which is the closest practical match to
 * MongoDB's default ordering.
 *
 * Documented compromises, inherited from the Mongo implementation:
 *
 * - Genre and artist matching is case-insensitive *substring*, not equality.
 *   `House` matches `Deep House`; `genre.not=Ambient` also excludes
 *   `Ambient Techno`.
 * - A BPM range includes songs with no BPM (the filter is opt-in narrowing).
 *   A rating range does not include unrated songs.
 * - `artist.all` matches the artist field only, while `artist.any` matches
 *   artist OR title.
 * - `favorite` only recognises `true`/`1`/`starred` and `disliked`; other
 *   values are ignored rather than treated as "not starred".
 *
 * Add new filters to both implementations and to the parity matrix.
 */
import { KEY } from './apiParams.js';
import type { ApiFilterParams } from './apiParams.js';

/** Fields the query layer needs. Structurally satisfied by ISong and the UI Song type. */
export interface QueryableSong {
  artist?: string;
  title?: string;
  genres?: string[];
  bpm?: number;
  rating?: number;
  year?: number;
  key?: string;
  favorite?: 'starred' | 'normal' | 'disliked';
}

/** Secondary sort always applied, in this order, after the user's sort field. */
export const FALLBACK_SORT_CHAIN = ['artist', 'year', 'title', 'rating', 'key', 'bpm'] as const;

function splitValues(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
}

function includesFold(haystack: string | undefined, needle: string): boolean {
  if (!haystack) return false;
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

function songGenres(song: QueryableSong): string[] {
  return song.genres ?? [];
}

function genreMatchesAny(song: QueryableSong, values: string[]): boolean {
  return values.some((value) => songGenres(song).some((genre) => includesFold(genre, value)));
}

function genreMatchesAll(song: QueryableSong, values: string[]): boolean {
  return values.every((value) => songGenres(song).some((genre) => includesFold(genre, value)));
}

function artistOrTitleMatchesAny(song: QueryableSong, values: string[]): boolean {
  return values.some(
    (value) => includesFold(song.artist, value) || includesFold(song.title, value),
  );
}

function artistMatchesAll(song: QueryableSong, values: string[]): boolean {
  return values.every((value) => includesFold(song.artist, value));
}

function artistMatchesAny(song: QueryableSong, values: string[]): boolean {
  return values.some((value) => includesFold(song.artist, value));
}

interface NumericRange {
  gte?: number;
  lte?: number;
}

/** Parses a range the way buildSongFilter does: invalid bounds are dropped, then swapped if inverted. */
function parseRange(gte: string | undefined, lte: string | undefined): NumericRange | undefined {
  const range: NumericRange = {};
  if (gte !== undefined) {
    const value = parseFloat(gte);
    if (!isNaN(value)) range.gte = value;
  }
  if (lte !== undefined) {
    const value = parseFloat(lte);
    if (!isNaN(value)) range.lte = value;
  }
  if (range.gte === undefined && range.lte === undefined) return undefined;
  if (range.gte !== undefined && range.lte !== undefined && range.gte > range.lte) {
    const swap = range.gte;
    range.gte = range.lte;
    range.lte = swap;
  }
  return range;
}

function inRange(value: number, range: NumericRange): boolean {
  if (range.gte !== undefined && value < range.gte) return false;
  if (range.lte !== undefined && value > range.lte) return false;
  return true;
}

/**
 * Evaluates browse filter params against one song.
 * Mirrors buildSongFilter: every param group is AND-ed.
 */
export function matchesFilters(song: QueryableSong, params: ApiFilterParams): boolean {
  const anyGenre = splitValues(params[KEY.genreAny]);
  if (anyGenre.length > 0 && !genreMatchesAny(song, anyGenre)) return false;

  const allGenre = splitValues(params[KEY.genreAll]);
  if (allGenre.length > 0 && !genreMatchesAll(song, allGenre)) return false;

  const notGenre = splitValues(params[KEY.genreNot]);
  if (notGenre.length > 0 && genreMatchesAny(song, notGenre)) return false;

  const anyArtist = splitValues(params[KEY.artistAny]);
  if (anyArtist.length > 0 && !artistOrTitleMatchesAny(song, anyArtist)) return false;

  const allArtist = splitValues(params[KEY.artistAll]);
  if (allArtist.length > 0 && !artistMatchesAll(song, allArtist)) return false;

  const notArtist = splitValues(params[KEY.artistNot]);
  if (notArtist.length > 0 && artistMatchesAny(song, notArtist)) return false;

  const bpmRange = parseRange(params[KEY.bpmGte], params[KEY.bpmLte]);
  if (bpmRange) {
    // Songs with no BPM are always included, matching the MongoDB $or.
    if (song.bpm !== undefined && song.bpm !== null && !inRange(song.bpm, bpmRange)) {
      return false;
    }
  }

  const ratingRange = parseRange(params[KEY.ratingGte], params[KEY.ratingLte]);
  if (ratingRange) {
    if (song.rating === undefined || song.rating === null) return false;
    if (!inRange(song.rating, ratingRange)) return false;
  }

  const favorite = params[KEY.favorite];
  if (favorite === 'true' || favorite === '1' || favorite === 'starred') {
    if (song.favorite !== 'starred') return false;
  } else if (favorite === 'disliked') {
    if (song.favorite !== 'disliked') return false;
  }

  const searchTerm = params[KEY.search];
  if (searchTerm && searchTerm.trim()) {
    const term = searchTerm.trim();
    const matchesSearch =
      includesFold(song.artist, term) ||
      includesFold(song.title, term) ||
      songGenres(song).some((genre) => includesFold(genre, term));
    if (!matchesSearch) return false;
  }

  return true;
}

function compareValues(a: unknown, b: unknown): number {
  // MongoDB sorts missing/null lowest. Treat only undefined/null as missing;
  // the empty string is a real value and sorts before letters.
  const aMissing = a === undefined || a === null;
  const bMissing = b === undefined || b === null;
  if (aMissing && bMissing) return 0;
  if (aMissing) return -1;
  if (bMissing) return 1;

  if (typeof a === 'number' && typeof b === 'number') return a - b;

  const aText = String(a);
  const bText = String(b);
  if (aText < bText) return -1;
  if (aText > bText) return 1;
  return 0;
}

function compareByField(
  a: QueryableSong & Record<string, unknown>,
  b: QueryableSong & Record<string, unknown>,
  field: string,
  direction: 1 | -1,
): number {
  return compareValues(a[field], b[field]) * direction;
}

/**
 * Sorts songs using the same primary + fallback chain as the API.
 * Ordering is presentation-only and is not parity-asserted (see module header).
 */
export function sortSongs<T extends QueryableSong>(
  songs: T[],
  sort?: string,
  sortDirection?: 'asc' | 'desc',
): T[] {
  const primaryField = sort ?? FALLBACK_SORT_CHAIN[0];
  const primaryDirection: 1 | -1 = sort ? (sortDirection === 'desc' ? -1 : 1) : 1;
  const fields: Array<{ field: string; direction: 1 | -1 }> = [
    { field: primaryField, direction: primaryDirection },
    ...FALLBACK_SORT_CHAIN.filter((field) => field !== primaryField).map((field) => ({
      field,
      direction: 1 as const,
    })),
  ];

  return [...songs].sort((a, b) => {
    for (const { field, direction } of fields) {
      const result = compareByField(
        a as QueryableSong & Record<string, unknown>,
        b as QueryableSong & Record<string, unknown>,
        field,
        direction,
      );
      if (result !== 0) return result;
    }
    return 0;
  });
}

/** Page size cap, matching the API's parsePagination. */
export const MAX_PAGE_LIMIT = 500;

export interface PageResult<T> {
  data: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/** Slices an already filtered and sorted list into a page, matching the API response shape. */
export function paginateSongs<T>(songs: T[], page = 1, limit = 50): PageResult<T> {
  const safePage = page >= 1 ? Math.floor(page) : 1;
  const safeLimit = limit >= 1 ? Math.min(Math.floor(limit), MAX_PAGE_LIMIT) : 50;
  const skip = (safePage - 1) * safeLimit;
  return {
    data: songs.slice(skip, skip + safeLimit),
    page: safePage,
    limit: safeLimit,
    total: songs.length,
    totalPages: Math.ceil(songs.length / safeLimit),
  };
}

/**
 * Counts genres across the given songs. Genre names are compared
 * case-sensitively, matching the MongoDB $group, and sorted byte-wise to
 * match its $sort.
 */
export function computeGenreStats(songs: QueryableSong[]): Array<{ genre: string; count: number }> {
  const counts = new Map<string, number>();
  for (const song of songs) {
    for (const genre of songGenres(song)) {
      counts.set(genre, (counts.get(genre) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort(([a], [b]) => compareValues(a, b))
    .map(([genre, count]) => ({ genre, count }));
}
