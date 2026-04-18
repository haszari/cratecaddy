import { useParams, Link } from 'react-router-dom';
import { useMemo } from 'react';
import { useSongsByGenre } from '../hooks/useSongsByGenre';
import { indexTags } from '../utils/tagUtils';
import { GenreTagCloud } from '../components/GenreTagCloud';
import GenreTagWithCount from '../components/GenreTag';
import './GenreDetail.scss';
import SongTable from '../components/SongTable';

export default function GenreDetail() {
  const { genreName } = useParams<{ genreName: string }>();
  const decodedGenre = genreName ? decodeURIComponent(genreName) : '';

  const { data: filteredSongs, isLoading, error } = useSongsByGenre(genreName);

  const tags = useMemo(() => {
    if (!filteredSongs) return {};
    const allTags = indexTags(filteredSongs);
    delete allTags[decodedGenre];
    return allTags;
  }, [filteredSongs, decodedGenre]);

  return (
    <div className="GenreDetail">
      <Link to="/" className="back-link">
        ← Back to all genres
      </Link>

      <div className="genre-heading-container">
        <GenreTagWithCount tagText={decodedGenre} tagCount={0} isHeading={true} />
      </div>

      {isLoading && <p>Loading songs...</p>}
      {error && <p style={{ color: 'red' }}>Failed to load songs</p>}
      {!isLoading && !error && filteredSongs && (
        <>
          <p className="song-count">{filteredSongs.length} songs with this tag</p>

          {Object.keys(tags).length > 0 && (
            <>
              <h3>Related Tags</h3>
              <GenreTagCloud tags={tags} />
            </>
          )}

          {filteredSongs.length > 0 && <SongTable songs={filteredSongs} />}
        </>
      )}
    </div>
  );
}
