import { useQuery } from '@tanstack/react-query';
import { fetchSongs } from '../api/client';
import type { ApiSongParams } from '@cratecaddy-api/apiParams';
import type { PaginatedResponse, Song } from '../types';

export function useSongs(params?: ApiSongParams) {
  return useQuery<PaginatedResponse<Song>>({
    queryKey: ['songs', params],
    queryFn: () => fetchSongs(params),
  });
}
