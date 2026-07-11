import type { Song, PaginatedResponse } from '../types';
import { KEY } from '@cratecaddy-api/apiParams';
import type { ApiSongParams, ApiGenreStatsParams } from '@cratecaddy-api/apiParams';

const API_URL = import.meta.env.VITE_API_URL;

function buildQueryString(params: ApiSongParams): string {
  const parts: string[] = [];
  const entries: [string, string | number | undefined][] = [
    [KEY.genreAny, params[KEY.genreAny]],
    [KEY.genreAll, params[KEY.genreAll]],
    [KEY.genreNot, params[KEY.genreNot]],
    [KEY.artistAny, params[KEY.artistAny]],
    [KEY.artistAll, params[KEY.artistAll]],
    [KEY.artistNot, params[KEY.artistNot]],
    [KEY.bpmGte, params[KEY.bpmGte]],
    [KEY.bpmLte, params[KEY.bpmLte]],
    [KEY.ratingGte, params[KEY.ratingGte]],
    [KEY.ratingLte, params[KEY.ratingLte]],
    [KEY.favorite, params[KEY.favorite]],
    [KEY.search, params[KEY.search]],
    ['shuffle', params.shuffle],
    ['sort', params.sort],
    ['sortDirection', params.sortDirection],
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

export async function updateSongMetadata(
  id: string,
  data: Partial<Song>,
): Promise<Song> {
  const response = await fetch(`${API_URL}/api/songs/${id}/metadata`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error(`Failed to update metadata: ${response.statusText}`);
  }

  return response.json();
}

export async function writeToAppleMusic(id: string): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`${API_URL}/api/songs/write-to-apple-music/${id}`, {
    method: 'POST',
  });

  if (!response.ok) {
    const body = await response.json();
    throw new Error(body.error ?? body.message ?? 'Failed to write to Apple Music');
  }

  return response.json();
}

export async function writeToAppleMusicBatch(ids: string[]): Promise<{ results: { id: string; success: boolean; message: string }[] }> {
  const response = await fetch(`${API_URL}/api/songs/write-to-apple-music`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
  });

  if (!response.ok) {
    const body = await response.json();
    throw new Error(body.error ?? body.message ?? 'Failed to write to Apple Music');
  }

  return response.json();
}

export interface SnapshotDiff {
  field: string;
  value: string | string[];
}

export interface HistoryEntry {
  _id: string;
  songId: string;
  dateEdited: string;
  sourceType: string;
  snapshot: {
    title: string;
    artist: string;
    genres: string[];
    grouping: string[];
    bpm?: number;
    key?: string;
    rating?: number;
    year?: number;
    favorite?: 'starred' | 'normal' | 'disliked';
  };
  diff: SnapshotDiff[];
  importMeta?: Record<string, unknown>;
}

export async function fetchSongHistory(id: string): Promise<HistoryEntry[]> {
  const response = await fetch(`${API_URL}/api/songs/${id}/history`);

  if (!response.ok) {
    throw new Error(`Failed to fetch history: ${response.statusText}`);
  }

  return response.json();
}

export async function updateSongsBatch(
  updates: { id: string; data: Partial<Song> }[],
): Promise<{ success: boolean; updated: Song[]; errors: { id: string; error: string }[] }> {
  const response = await fetch(`${API_URL}/api/songs/metadata/batch`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ updates }),
  });

  if (!response.ok) {
    throw new Error(`Failed to update batch metadata: ${response.statusText}`);
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
