import { useMemo } from 'react';
import { useSongs } from './useSongs';

// Returns songs by artist or songs containing the artist in the title - fuzzy match for remixes.
export function useSongsByArtist(artist: string | undefined) {
  const { data: songs, isLoading, error, refetch } = useSongs();

  const filteredSongs = useMemo(() => {
    if (!songs || !artist) return [];
    const decodedArtist = decodeURIComponent(artist);
    return songs.filter((song) => 
      song.artist === decodedArtist || 
      song.title.indexOf(decodedArtist) !== -1
    );
  }, [songs, artist]);

  return { data: filteredSongs, isLoading, error, refetch };
}
