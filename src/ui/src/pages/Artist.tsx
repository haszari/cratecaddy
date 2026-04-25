import { useParams, Link } from 'react-router-dom';
import { useMemo } from 'react';
import { useSongsByArtist } from '../hooks/useSongsByArtist';
import { indexTags } from '../utils/tagUtils';
import { GenreTagCloud } from '../components/GenreTagCloud';
import './GenreDetail.scss';
import SongTable from '../components/SongTable';

export default function Artist() {
  const { artistName } = useParams<{ artistName: string }>();
  const decodedArtist = artistName ? decodeURIComponent(artistName) : '';

  const { data: filteredSongs, isLoading, error } = useSongsByArtist(decodedArtist);

  const tags = useMemo(() => {
    if (!filteredSongs) return {};
    const allTags = indexTags(filteredSongs);
    // delete allTags[decodedGenre];
    return allTags;
  }, [filteredSongs]);

  return (
    <div className="GenreDetail">
      <Link to="/" className="back-link">
        ← Back
      </Link>

      {/* <div className="genre-heading-container">
        <GenreTagWithCount tagText={decodedGenre} tagCount={0} isHeading={true} />
      </div> */}

      {isLoading && <p>Loading songs...</p>}
      {error && <p style={{ color: 'red' }}>Failed to load songs</p>}
      {!isLoading && !error && filteredSongs && (
        <>
          <p className="song-count">{filteredSongs.length} songs by this artist</p>

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
