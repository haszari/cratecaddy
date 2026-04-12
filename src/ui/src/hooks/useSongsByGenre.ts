import { useMemo } from 'react';
import { useSongs } from './useSongs';

export function useSongsByGenre(genre: string | undefined) {
  const { data: songs, isLoading, error, refetch } = useSongs();

  const filteredSongs = useMemo(() => {
    if (!songs || !genre) return [];
    const decodedGenre = decodeURIComponent(genre);
    return songs.filter((song) =>
      song.genres.some((g) => g.trim().toLowerCase() === decodedGenre.toLowerCase())
    );
  }, [songs, genre]);

  return { data: filteredSongs, isLoading, error, refetch };
}
