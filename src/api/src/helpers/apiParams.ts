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
  favorite: 'favorite',
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
  [KEY.favorite]?: string;
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
  favoriteActive?: boolean;
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
  if (filters.favoriteActive) {
    params[KEY.favorite] = 'true';
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
