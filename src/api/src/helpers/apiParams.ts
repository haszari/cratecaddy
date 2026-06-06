export interface ApiFilterParams {
  'genre.any'?: string;
  'genre.all'?: string;
  'genre.not'?: string;
  'artist.any'?: string;
  'artist.all'?: string;
  'artist.not'?: string;
  'bpm.gte'?: string;
  'bpm.lte'?: string;
  search?: string;
}

export interface ApiPaginationParams {
  page?: string | number;
  limit?: string | number;
  shuffle?: string;
  sort?: string;
  sortOrder?: string;
}

export type ApiSongParams = ApiFilterParams & ApiPaginationParams;
export type ApiGenreStatsParams = ApiFilterParams;

export const FILTER_PARAM_KEYS: (keyof ApiFilterParams)[] = [
  'genre.any', 'genre.all', 'genre.not',
  'artist.any', 'artist.all', 'artist.not',
  'bpm.gte', 'bpm.lte', 'search',
];

export const PAGINATION_PARAM_KEYS: (keyof ApiPaginationParams)[] = [
  'page', 'limit', 'shuffle', 'sort', 'sortOrder',
];
