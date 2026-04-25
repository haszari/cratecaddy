import { useMemo } from 'react';
import { useSongs } from '../hooks/useSongs';
import { indexTags } from '../utils/tagUtils';
import { GenreTagCloud } from '../components/GenreTagCloud';
import type { TagInfo } from '../types';



export default function Home() {
  const { data: songs, isLoading, error } = useSongs();

  const tags = useMemo(() => {
    if (!songs) return {};
    return indexTags(songs);
  }, [songs]);

  const main: Record<string, TagInfo> = {};
  const fringe: Record<string, TagInfo> = {};
  for (const [tagName, tagInfo] of Object.entries(tags)) {
    if (tags[tagName].count > 1) {
      main[tagName] = tagInfo;
    } else {
      fringe[tagName] = tagInfo;
    }
  }

  return (
    <div className="HomePage">
      <h1>Crate Caddy</h1>
      {isLoading && <p>Loading songs...</p>}
      {error && <p style={{ color: 'red' }}>Failed to load songs</p>}
      {!isLoading && !error && songs && <p>{songs.length} songs loaded</p>}
      <GenreTagCloud tags={main} />
      <GenreTagCloud tags={fringe} />
    </div>
  );
}
