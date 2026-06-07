import { useRef, useCallback } from 'react';
import { SourcesIcons } from './SourcesIcons';
import type { Song } from '../types';
import './CompactSongTable.scss';

interface CompactSongTableProps {
  songs: Song[];
  selectedIds: Set<string>;
  onSelect: (id: string, mode?: 'toggle' | 'range') => void;
}

export default function CompactSongTable({ songs, selectedIds, onSelect }: CompactSongTableProps) {
  const lastClickedIdRef = useRef<string | null>(null);

  const handleRowClick = useCallback((id: string, e: React.MouseEvent) => {
    if (e.shiftKey && lastClickedIdRef.current) {
      onSelect(id, 'range');
    } else if (e.metaKey || e.ctrlKey) {
      onSelect(id, 'toggle');
    } else {
      onSelect(id);
    }
    lastClickedIdRef.current = id;
  }, [onSelect]);

  return (
    <div className="CompactSongTable">
      <table>
        <thead>
          <tr>
            <th className="col-sources">Sources</th>
            <th className="col-artist">Artist</th>
            <th className="col-title">Title</th>
          </tr>
        </thead>
        <tbody>
          {songs.map((song) => (
            <tr
              key={song._id}
              className={song._id && selectedIds.has(song._id) ? 'CompactSongTable-row--selected' : ''}
              onClick={(e) => song._id && handleRowClick(song._id, e)}
            >
              <td className="col-sources">
                <SourcesIcons sources={song.sources} />
              </td>
              <td className="col-artist"><span className="Artist-link">{song.artist}</span></td>
              <td className="col-title"><span className="Song-link">{song.title}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
