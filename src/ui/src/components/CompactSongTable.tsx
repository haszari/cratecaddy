import { SourcesIcons } from './SourcesIcons';
import type { Song } from '../types';
import './CompactSongTable.scss';

interface CompactSongTableProps {
  songs: Song[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}

export default function CompactSongTable({ songs, selectedIndex, onSelect }: CompactSongTableProps) {
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
          {songs.map((song, i) => (
            <tr
              key={song._id}
              className={i === selectedIndex ? 'CompactSongTable-row--selected' : ''}
              onClick={() => onSelect(i)}
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
