import { useEffect, useCallback } from 'react';
import type { Song } from '../types';
import CompactSongTable from './CompactSongTable';
import SongEditForm from './SongEditForm';
import './EditLayout.scss';

interface EditLayoutProps {
  songs: Song[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  onSelectNext: () => void;
  onSelectPrev: () => void;
  onExit: () => void;
}

export default function EditLayout({
  songs, selectedIndex, onSelect, onSelectNext, onSelectPrev, onExit,
}: EditLayoutProps) {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'j' && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      onSelectNext();
    } else if (e.key === 'k' && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      onSelectPrev();
    } else if (e.key === 'Escape') {
      onExit();
    }
  }, [onSelectNext, onSelectPrev, onExit]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const selectedSong = songs[selectedIndex];

  return (
    <div className="EditLayout">
      <div className="EditLayout-list">
        <CompactSongTable
          songs={songs}
          selectedIndex={selectedIndex}
          onSelect={onSelect}
        />
      </div>
      <div className="EditLayout-detail">
        {selectedSong ? (
          <SongEditForm key={selectedSong._id} song={selectedSong} />
        ) : (
          <p className="EditLayout-empty">Select a song to edit</p>
        )}
      </div>
    </div>
  );
}
