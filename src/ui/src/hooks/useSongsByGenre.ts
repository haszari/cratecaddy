import { useSongs } from './useSongs';

export function useSongsByGenre(genre: string | undefined, page = 1) {
  const decodedGenre = genre ? decodeURIComponent(genre) : undefined;
  return useSongs({
    'genre.any': decodedGenre,
    page,
    limit: 50,
  });
}
