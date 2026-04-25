import { useMemo } from 'react';
import { useSongs } from './useSongs';

// Returns songs filtered by artist:
// - fuzzy match
// - artist in artist (e.g. includes combined artists)
// - artist in title (e.g. remixes)
export function useSongsByArtist(artist: string | undefined) {
  const { data: songs, isLoading, error, refetch } = useSongs();

  const filteredSongs = useMemo(() => {
    if (!songs || !artist) return [];
    const decodedArtist = decodeURIComponent(artist);
    return songs.filter((song) => 
      song.artist.indexOf(decodedArtist) !== -1 ||
      song.title.indexOf(decodedArtist) !== -1
    );
  }, [songs, artist]);

  return { data: filteredSongs, isLoading, error, refetch };
}
