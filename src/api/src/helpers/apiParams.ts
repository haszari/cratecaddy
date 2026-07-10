export interface ApiFilterParams {
  'genre.any'?: string;
  'genre.all'?: string;
  'genre.not'?: string;
  'artist.any'?: string;
  'artist.all'?: string;
  'artist.not'?: string;
  'bpm.gte'?: string;
  'bpm.lte'?: string;
  'rating.gte'?: string;
  'rating.lte'?: string;
  'favorite'?: string;
  search?: string;
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

export const FILTER_PARAM_KEYS: (keyof ApiFilterParams)[] = [
  'genre.any', 'genre.all', 'genre.not',
  'artist.any', 'artist.all', 'artist.not',
  'bpm.gte', 'bpm.lte', 'rating.gte', 'rating.lte', 'favorite', 'search',
];

export const PAGINATION_PARAM_KEYS: (keyof ApiPaginationParams)[] = [
  'page', 'limit', 'shuffle', 'sort', 'sortDirection',
];
