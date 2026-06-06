import { SourcesIcons } from './SourcesIcons';
import type { Song } from '../types';
import './CompactSongTable.scss';

interface CompactSongTableProps {
  songs: Song[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export default function CompactSongTable({ songs, selectedId, onSelect }: CompactSongTableProps) {
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
              className={song._id === selectedId ? 'CompactSongTable-row--selected' : ''}
              onClick={() => song._id && onSelect(song._id)}
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
