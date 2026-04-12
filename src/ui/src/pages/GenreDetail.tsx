import { useParams, Link } from 'react-router-dom';
import { useMemo } from 'react';
import { useSongsByGenre } from '../hooks/useSongsByGenre';
import { indexTags } from '../utils/tagUtils';
import { GenreTagCloud } from '../components/GenreTagCloud';
import GenreTagWithCount from '../components/GenreTag';
import { SourcesIcons } from '../components/SourcesIcons';
import '../pages/GenreDetail.scss';
import type { Song } from '../types';

function SongTable({ songs }: { songs: Song[] }) {
  const sortedSongs = [...songs].sort((a, b) => (b.rating || 0) - (a.rating || 0));

  const formatRating = (rating: number | undefined) => {
    if (rating === undefined) return '—';
    return rating === Math.round(rating) ? Math.round(rating).toString() : rating.toFixed(1);
  };

  return (
    <table>
      <thead>
        <tr>
          <th>Artist</th>
          <th>Title</th>
          <th>BPM</th>
          <th>Key</th>
          <th>Rating</th>
          <th>Sources</th>
          <th>Genres</th>
        </tr>
      </thead>
      <tbody>
        {sortedSongs.map((song) => (
          <tr key={song._id}>
            <td>{song.artist}</td>
            <td>{song.title}</td>
            <td>{song.bpm || '—'}</td>
            <td>{song.key || '—'}</td>
            <td>{formatRating(song.rating)}</td>
            <td>
              <SourcesIcons sources={song.sources} />
            </td>
            <td>
              <div className="genres-cell">
                {song.genres.map((genre) => (
                  <GenreTagWithCount
                    key={genre}
                    tagText={genre}
                    tagCount={0}
                  />
                ))}
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

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
