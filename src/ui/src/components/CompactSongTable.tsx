import type { Song } from '../types';
import './CompactSongTable.scss';

interface CompactSongTableProps {
  songs: Song[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}

function favoriteIcon(fav: Song['favorite']): string {
  switch (fav) {
    case 'starred': return '★';
    case 'disliked': return '✕';
    default: return '';
  }
}

export default function CompactSongTable({ songs, selectedIndex, onSelect }: CompactSongTableProps) {
  return (
    <div className="CompactSongTable">
      {songs.map((song, i) => (
        <div
          key={song._id}
          className={`CompactSongTable-row ${i === selectedIndex ? 'CompactSongTable-row--selected' : ''}`}
          onClick={() => onSelect(i)}
        >
          <span className="CompactSongTable-fav">{favoriteIcon(song.favorite)}</span>
          <span className="CompactSongTable-artist">{song.artist}</span>
          <span className="CompactSongTable-sep"> – </span>
          <span className="CompactSongTable-title">{song.title}</span>
          <span className="CompactSongTable-bpm">{song.bpm ?? ''}</span>
        </div>
      ))}
    </div>
  );
}
