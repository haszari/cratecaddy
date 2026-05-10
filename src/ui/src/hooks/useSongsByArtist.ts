import { useSongs } from './useSongs';
import type { ApiSongParams } from '@cratecaddy-api/apiParams';

export function useSongsByArtist(artist: string | undefined, page = 1) {
  return useSongs({
    'artist.any': artist,
    page,
    limit: 50,
  } satisfies ApiSongParams);
}
