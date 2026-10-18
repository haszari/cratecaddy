/**
 * Snapshot data source for the static site. Selected by the `@data` alias at
 * build time, so hooks and components are identical across build targets.
 *
 * Read-only by design: there are no mutation exports here. Writes exist only
 * in the API client, which the static site never imports.
 *
 * Filtering, sorting and pagination go through the shared songQuery contract so
 * semantics match the API (see docs/adr/0014).
 */
import type { PaginatedResponse, Song } from '../types';
import type { ApiSongParams, ApiGenreStatsParams } from '@cratecaddy-api/apiParams';
import { KEY } from '@cratecaddy-api/apiParams';
import {
  matchesFilters,
  sortSongs,
  paginateSongs,
  computeGenreStats,
  type QueryableSong,
} from '@cratecaddy-api/songQuery';
import { shuffleHash } from '@cratecaddy-api/shuffleHash';

export interface SnapshotMeta {
  version: string;
  takenAt: string;
  appVersion: string;
  commit: string;
  filter: Record<string, unknown>;
  count: number;
}

interface SnapshotPayload {
  snapshot: SnapshotMeta;
  songs: Song[];
}

let songs: Song[] = [];
let meta: SnapshotMeta | null = null;
let loadPromise: Promise<void> | null = null;

/** Snapshot provenance for the footer and staleness display. */
export function getSnapshotMeta(): SnapshotMeta | null {
  return meta;
}

/**
 * Loads the Snapshot once. Safe to call repeatedly; concurrent calls share one
 * request. Throws with a useful message if the data cannot be read (offline on
 * a first visit, or a missing file).
 */
export function loadSnapshot(): Promise<void> {
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    const url = `${import.meta.env.BASE_URL}${__SNAPSHOT_FILE__}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Could not load the Snapshot (${response.status}) from ${url}`);
    }
    const payload = (await response.json()) as SnapshotPayload;
    songs = payload.songs ?? [];
    meta = payload.snapshot ?? null;
  })();

  return loadPromise;
}

function assertLoaded(): void {
  if (!meta) {
    throw new Error('Snapshot not loaded — call loadSnapshot() before rendering');
  }
}

function shuffleSeedFrom(params: ApiSongParams | undefined): string | undefined {
  const raw = params?.shuffle;
  if (raw === undefined || raw === null || raw === '' || raw === 'false') return undefined;
  return String(raw);
}

export async function fetchSongs(params?: ApiSongParams): Promise<PaginatedResponse<Song>> {
  assertLoaded();
  const matching = songs.filter((song) => matchesFilters(song as QueryableSong, params ?? {}));

  const seed = shuffleSeedFrom(params);
  const ordered = seed
    ? [...matching].sort((a, b) => shuffleHash(a._id ?? '', seed) - shuffleHash(b._id ?? '', seed))
    : sortSongs(matching, params?.sort ? String(params.sort) : undefined, params?.sortDirection as 'asc' | 'desc' | undefined);

  const page = params?.page !== undefined ? Number(params.page) : 1;
  const limit = params?.limit !== undefined ? Number(params.limit) : 50;
  const result = paginateSongs(ordered, page, limit);

  if (seed) {
    return { ...result, shuffleSeed: seed };
  }
  return result;
}

export async function fetchSongById(id: string): Promise<Song> {
  assertLoaded();
  const song = songs.find((candidate) => candidate._id === id);
  if (!song) {
    throw new Error(`Song not found: ${id}`);
  }
  return song;
}

export async function fetchGenreStats(params?: ApiGenreStatsParams): Promise<Array<{ genre: string; count: number }>> {
  assertLoaded();
  const matching = songs.filter((song) => matchesFilters(song as QueryableSong, params ?? {}));
  return computeGenreStats(matching);
}

// Re-export the filter key map so callers importing only @data still get it.
export { KEY };
