import { SourcesIcons } from './SourcesIcons';
import GenreTagWithCount from './GenreTag';
import type { Song } from '../types';
import { Link } from 'react-router-dom';

interface SongTableProps {
  songs: Song[];
  page?: number;
  totalPages?: number;
  totalCount?: number;
  onPageChange?: (page: number) => void;
}

export default function SongTable({ songs, page, totalPages, totalCount, onPageChange }: SongTableProps) {
  const showPagination = totalPages !== undefined && totalPages > 1;

  const formatRating = (rating: number | undefined) => {
    if (rating === undefined) return '';
    return rating === Math.round(rating) ? Math.round(rating).toString() : rating.toFixed(1);
  };

  return (
    <>
      <table>
        <thead>
          <tr>
            <th className="col-sources">Sources</th>
            <th className="col-artist">Artist</th>
            <th className="col-title">Title</th>
            <th className="col-bpm">BPM</th>
            <th className="col-key">Key</th>
            <th className="col-rating">Rating</th>
            <th className="col-genres">Genres</th>
          </tr>
        </thead>
        <tbody>
            {songs.map((song) => (
            <tr key={song._id}>
              <td className="col-sources">
                <SourcesIcons sources={song.sources} />
              </td>
              <td className="col-artist">
                <Link
                  to={`/artist/${encodeURIComponent(song.artist)}`}
                  className="Artist-link"
                >{song.artist}</Link>
              </td>
              <td className="col-title">
                <Link to={`/song/${song._id}`} className="Song-link">{song.title}</Link>
              </td>
              <td className="col-bpm">{song.bpm}</td>
              <td className="col-key">{song.key}</td>
              <td className="col-rating">{formatRating(song.rating)}</td>
              <td className="col-genres">
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
      {page !== undefined && totalPages !== undefined && (
        <div className="pagination">
          {showPagination && (
            <button
              disabled={page <= 1}
              onClick={() => onPageChange?.(page - 1)}
            >
              ← Prev
            </button>
          )}
          <div className="pagination-center">
            {totalCount !== undefined && (
              <span className="pagination-count">{totalCount} song{totalCount !== 1 ? 's' : ''}</span>
            )}
            {showPagination && (
              <span className="pagination-pages">Page {page} of {totalPages}</span>
            )}
          </div>
          {showPagination && (
            <button
              disabled={page >= totalPages}
              onClick={() => onPageChange?.(page + 1)}
            >
              Next →
            </button>
          )}
        </div>
      )}
    </>
  );
}