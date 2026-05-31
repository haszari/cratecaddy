import { useEffect, useCallback } from 'react';
import type { Song } from '../types';
import CompactSongTable from './CompactSongTable';
import SongEditForm from './SongEditForm';
import './EditLayout.scss';

const FIELD_FOCUS_MAP: Record<string, string> = {
  t: 'edit-field-title',
  a: 'edit-field-artist',
  b: 'edit-field-bpm',
  y: 'edit-field-year',
  r: 'edit-field-rating',
};

interface EditLayoutProps {
  songs: Song[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  onSelectNext: () => void;
  onSelectPrev: () => void;
}

export default function EditLayout({
  songs, selectedIndex, onSelect, onSelectNext, onSelectPrev,
}: EditLayoutProps) {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement).tagName;
    const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
    if (isInput) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      onSelectNext();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      onSelectPrev();
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const fieldId = FIELD_FOCUS_MAP[e.key];
      if (fieldId) {
        const el = document.getElementById(fieldId);
        if (el) {
          e.preventDefault();
          el.focus();
        }
      }
    }
  }, [onSelectNext, onSelectPrev]);

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
