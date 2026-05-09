import { useSongs } from './useSongs';

export function useSongsByArtist(artist: string | undefined, page = 1) {
  return useSongs({
    'artist.any': artist,
    page,
    limit: 50,
  });
}
