import { useQuery } from '@tanstack/react-query';
import { fetchSongs, type FetchSongsParams } from '../api/client';
import type { PaginatedResponse, Song } from '../types';

export function useSongs(params?: FetchSongsParams) {
  return useQuery<PaginatedResponse<Song>>({
    queryKey: ['songs', params ?? {}],
    queryFn: () => fetchSongs(params ?? {}),
  });
}
