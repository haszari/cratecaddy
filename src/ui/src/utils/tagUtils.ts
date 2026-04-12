import type { Song, TagInfo } from '../types';

export function indexTags(songs: Song[]): Record<string, TagInfo> {
  const tagsMap: Record<string, TagInfo> = {};
  songs.forEach((song) => {
    song.genres.forEach((genre) => {
      const trimmedGenre = genre.trim();
      if (trimmedGenre === '') return;
      if (trimmedGenre in tagsMap) {
        tagsMap[trimmedGenre].count += 1;
      } else {
        tagsMap[trimmedGenre] = { count: 1 };
      }
    });
  });

  return tagsMap;
}
