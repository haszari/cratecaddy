import { useQuery } from '@tanstack/react-query';
import { fetchSongs } from '../api/client';
import type { Song } from '../types';

export function useSongs() {
  return useQuery<Song[]>({
    queryKey: ['songs'],
    queryFn: fetchSongs,
  });
}
