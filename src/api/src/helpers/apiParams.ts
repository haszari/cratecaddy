export const KEY = {
  genreAny: 'genre.any',
  genreAll: 'genre.all',
  genreNot: 'genre.not',
  artistAny: 'artist.any',
  artistAll: 'artist.all',
  artistNot: 'artist.not',
  bpmGte: 'bpm.gte',
  bpmLte: 'bpm.lte',
  ratingGte: 'rating.gte',
  ratingLte: 'rating.lte',
  key: 'key',
  keyTolerance: 'key.tolerance',
  yearGte: 'year.gte',
  yearLte: 'year.lte',
  favorite: 'favorite',
  ownership: 'ownership',
  search: 'search',
} as const;

export interface ApiFilterParams {
  [KEY.genreAny]?: string;
  [KEY.genreAll]?: string;
  [KEY.genreNot]?: string;
  [KEY.artistAny]?: string;
  [KEY.artistAll]?: string;
  [KEY.artistNot]?: string;
  [KEY.bpmGte]?: string;
  [KEY.bpmLte]?: string;
  [KEY.ratingGte]?: string;
  [KEY.ratingLte]?: string;
  /** Target key (note name or Camelot index/label). */
  [KEY.key]?: string;
  /** ±N Camelot wheel steps around the target key. */
  [KEY.keyTolerance]?: string;
  [KEY.yearGte]?: string;
  [KEY.yearLte]?: string;
  [KEY.favorite]?: string;
  /** `owned` = has a local file source; `streaming` = cloud only. */
  [KEY.ownership]?: string;
  [KEY.search]?: string;
}

export interface ApiPaginationParams {
  page?: string | number;
  limit?: string | number;
  shuffle?: string;
  sort?: string;
  sortDirection?: string;
}

export type ApiSongParams = ApiFilterParams & ApiPaginationParams;
export type ApiGenreStatsParams = ApiFilterParams;

export const FILTER_PARAM_KEYS: (keyof ApiFilterParams)[] = Object.values(KEY);

export const PAGINATION_PARAM_KEYS: (keyof ApiPaginationParams)[] = [
  'page', 'limit', 'shuffle', 'sort', 'sortDirection',
];

export function buildApiParams(filters: {
  genreNot?: string[];
  bpmGte?: number;
  bpmLte?: number;
  ratingGte?: number;
  ratingLte?: number;
  musicalKey?: string;
  keyTolerance?: number;
  yearGte?: number;
  yearLte?: number;
  favoriteActive?: boolean;
  ownership?: string;
  search?: string;
}): ApiFilterParams {
  const params: ApiFilterParams = {};
  if (filters.genreNot && filters.genreNot.length > 0) {
    params[KEY.genreNot] = filters.genreNot.join(',');
  }
  if (filters.bpmGte !== undefined) {
    params[KEY.bpmGte] = String(filters.bpmGte);
  }
  if (filters.bpmLte !== undefined) {
    params[KEY.bpmLte] = String(filters.bpmLte);
  }
  if (filters.ratingGte !== undefined) {
    params[KEY.ratingGte] = String(filters.ratingGte);
  }
  if (filters.ratingLte !== undefined) {
    params[KEY.ratingLte] = String(filters.ratingLte);
  }
  if (filters.musicalKey) {
    params[KEY.key] = filters.musicalKey;
  }
  if (filters.keyTolerance !== undefined) {
    params[KEY.keyTolerance] = String(filters.keyTolerance);
  }
  if (filters.yearGte !== undefined) {
    params[KEY.yearGte] = String(filters.yearGte);
  }
  if (filters.yearLte !== undefined) {
    params[KEY.yearLte] = String(filters.yearLte);
  }
  if (filters.favoriteActive) {
    params[KEY.favorite] = 'true';
  }
  if (filters.ownership) {
    params[KEY.ownership] = filters.ownership;
  }
  if (filters.search) {
    params[KEY.search] = filters.search;
  }
  return params;
}

export function readApiParams(sp: URLSearchParams): ApiFilterParams {
  const params: ApiFilterParams = {};
  for (const key of FILTER_PARAM_KEYS) {
    const val = sp.get(key);
    if (val) {
      params[key] = val;
    }
  }
  return params;
}
