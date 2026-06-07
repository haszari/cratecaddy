import { ApiPaginationParams } from './apiParams.js';

const VALID_SORT_FIELDS = ['artist', 'title', 'bpm', 'key', 'rating', 'year', 'createdAt'];

export interface PaginationResult {
  page: number;
  limit: number;
  skip: number;
  shuffleSeed?: string;
  sort?: string;
  sortDirection?: 'asc' | 'desc';
}

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 500;

function toPositiveInt(value: string | number | undefined, fallback: number): number {
  if (value === undefined || value === null) return fallback;
  const n = typeof value === 'number' ? Math.floor(value) : parseInt(value, 10);
  if (isNaN(n) || n < 1) return fallback;
  return n;
}

function generateSeed(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function parsePagination(query: ApiPaginationParams): PaginationResult {
  const page = toPositiveInt(query.page, DEFAULT_PAGE);
  const limit = Math.min(toPositiveInt(query.limit, DEFAULT_LIMIT), MAX_LIMIT);
  const skip = (page - 1) * limit;

  let shuffleSeed: string | undefined;
  if (query.shuffle && query.shuffle !== 'false') {
    shuffleSeed = query.shuffle === 'true' || !query.shuffle
      ? generateSeed()
      : query.shuffle;
  }

  let sort: string | undefined;
  let sortDirection: 'asc' | 'desc' | undefined;
  if (query.sort && VALID_SORT_FIELDS.includes(query.sort as string)) {
    sort = query.sort as string;
    sortDirection = query.sortDirection === 'desc' ? 'desc' : 'asc';
  }

  return { page, limit, skip, shuffleSeed, sort, sortDirection };
}
