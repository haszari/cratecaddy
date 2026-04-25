import { SourcesIcons } from './SourcesIcons';
import GenreTagWithCount from './GenreTag';
import type { Song } from '../types';
import { Link } from 'react-router-dom';

export default function SongTable({ songs }: { songs: Song[] }) {
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
            <td>
              <Link
                to={`/artist/${encodeURIComponent(song.artist)}`}
                className="Artist-link"
              >{song.artist}</Link>
            </td>
            <td>{song.title}</td>
            <td>{song.bpm}</td>
            <td>{song.key}</td>
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