import type { Song, PaginatedResponse } from '../types';
import type { ApiSongParams, ApiGenreStatsParams } from '@cratecaddy-api/apiParams';

const API_URL = import.meta.env.VITE_API_URL;

function buildQueryString(params: ApiSongParams): string {
  const parts: string[] = [];
  const entries: [string, string | number | undefined][] = [
    ['genre.any', params['genre.any']],
    ['genre.all', params['genre.all']],
    ['genre.not', params['genre.not']],
    ['artist.any', params['artist.any']],
    ['artist.all', params['artist.all']],
    ['artist.not', params['artist.not']],
    ['bpm.gte', params['bpm.gte']],
    ['bpm.lte', params['bpm.lte']],
    ['search', params.search],
    ['shuffle', params.shuffle],
    ['page', params.page],
    ['limit', params.limit],
  ];
  for (const [key, val] of entries) {
    if (val !== undefined && val !== null && val !== '') {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(val))}`);
    }
  }
  return parts.length > 0 ? `?${parts.join('&')}` : '';
}

export async function fetchSongs(params?: ApiSongParams): Promise<PaginatedResponse<Song>> {
  const qs = params ? buildQueryString(params) : '';
  const response = await fetch(`${API_URL}/api/songs${qs}`);

  if (!response.ok) {
    throw new Error(`Failed to fetch songs: ${response.statusText}`);
  }

  return response.json();
}

export async function fetchSongById(id: string): Promise<Song> {
  const response = await fetch(`${API_URL}/api/songs/${id}`);

  if (!response.ok) {
    throw new Error(`Failed to fetch song: ${response.statusText}`);
  }

  return response.json();
}

export async function fetchGenreStats(params?: ApiGenreStatsParams): Promise<Array<{ genre: string; count: number }>> {
  const qs = params ? buildQueryString(params as ApiSongParams) : '';
  const response = await fetch(`${API_URL}/api/songs/stats/genres${qs}`);

  if (!response.ok) {
    throw new Error(`Failed to fetch genre stats: ${response.statusText}`);
  }

  return response.json();
}
