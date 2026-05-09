export interface PaginationParams {
  page?: string;
  limit?: string;
  shuffle?: string;
}

export interface PaginationResult {
  page: number;
  limit: number;
  skip: number;
  shuffleSeed?: string;
}

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

function toPositiveInt(value: string | undefined, fallback: number): number {
  if (value === undefined || value === null) return fallback;
  const n = parseInt(value, 10);
  if (isNaN(n) || n < 1) return fallback;
  return n;
}

function generateSeed(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function parsePagination(query: PaginationParams): PaginationResult {
  const page = toPositiveInt(query.page, DEFAULT_PAGE);
  const limit = Math.min(toPositiveInt(query.limit, DEFAULT_LIMIT), MAX_LIMIT);
  const skip = (page - 1) * limit;

  let shuffleSeed: string | undefined;
  if (query.shuffle && query.shuffle !== 'false') {
    shuffleSeed = query.shuffle === 'true' || !query.shuffle
      ? generateSeed()
      : query.shuffle;
  }

  return { page, limit, skip, shuffleSeed };
}
