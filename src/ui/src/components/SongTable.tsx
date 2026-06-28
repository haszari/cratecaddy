import { SourcesIcons } from './SourcesIcons';
import GenreTagWithCount from './GenreTag';
import type { Song } from '../types';
import { Link } from 'react-router-dom';
import { Heart } from 'lucide-react';

export type SortField = 'artist' | 'title' | 'bpm' | 'key' | 'rating' | 'year';
export type SortDirection = 'asc' | 'desc';

interface SongTableProps {
  songs: Song[];
  page?: number;
  totalPages?: number;
  totalCount?: number;
  onPageChange?: (page: number) => void;
  sortField?: SortField;
  sortDirection?: SortDirection;
  onSortChange?: (field: SortField, direction: SortDirection) => void;
}

function SortIcon({ sortDirection }: { field: SortField; sortField?: SortField; sortDirection?: SortDirection }) {
  return (
    <span className="SongTable-sort-icon SongTable-sort-icon--active">
      {sortDirection === 'desc' ? '\u25B2' : '\u25BC'}
    </span>
  );
}

function SortableHeader({ field, label, sortField, sortDirection, onSortChange }: {
  field: SortField;
  label: string;
  sortField?: SortField;
  sortDirection?: SortDirection;
  onSortChange?: (field: SortField, direction: SortDirection) => void;
}) {
  const sortButton = (field === sortField) && <SortIcon field={field} sortField={sortField} sortDirection={sortDirection} />;
  return (
    <th
    className={`col-${field} SongTable-sortable`}
    onClick={() => {
      const nextDirection = (field === sortField && sortDirection === 'asc') ? 'desc' : 'asc';
      onSortChange?.(field, nextDirection);
    }}
    >
      {label}
      {sortButton}
    </th>
  );
}

export default function SongTable({ songs, page, totalPages, totalCount, onPageChange, sortField, sortDirection, onSortChange }: SongTableProps) {
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
            <th className="col-heart" />
            <th className="col-sources">Sources</th>
            <SortableHeader field="artist" label="Artist" sortField={sortField} sortDirection={sortDirection} onSortChange={onSortChange} />
            <SortableHeader field="title" label="Title" sortField={sortField} sortDirection={sortDirection} onSortChange={onSortChange} />
            <SortableHeader field="bpm" label="BPM" sortField={sortField} sortDirection={sortDirection} onSortChange={onSortChange} />
            <SortableHeader field="key" label="Key" sortField={sortField} sortDirection={sortDirection} onSortChange={onSortChange} />
            <SortableHeader field="rating" label="Rating" sortField={sortField} sortDirection={sortDirection} onSortChange={onSortChange} />
            <th className="col-genres">Genres</th>
          </tr>
        </thead>
        <tbody>
            {songs.map((song) => (
            <tr key={song._id}>
              <td className="col-heart">
                {song.favorite === 'starred' && <Heart size={12} />}
              </td>
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
              <td className="col-bpm">{song.bpm != null ? Math.round(song.bpm) : ''}</td>
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
