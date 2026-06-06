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
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export default function EditLayout({
  songs, selectedId, onSelect,
}: EditLayoutProps) {
  // Auto-select first song when none selected or selection is stale
  useEffect(() => {
    if (songs.length > 0 && (!selectedId || !songs.some(s => s._id === selectedId))) {
      const firstId = songs[0]._id;
      if (firstId && firstId !== selectedId) {
        onSelect(firstId);
      }
    }
  }, [songs, selectedId, onSelect]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement).tagName;
    const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
    if (isInput) return;

    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const currentIndex = songs.findIndex(s => s._id === selectedId);
      if (currentIndex === -1) return;
      const nextIndex = e.key === 'ArrowDown'
        ? Math.min(currentIndex + 1, songs.length - 1)
        : Math.max(currentIndex - 1, 0);
      if (nextIndex !== currentIndex) {
        onSelect(songs[nextIndex]._id!);
      }
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
  }, [songs, selectedId, onSelect]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const selectedSong = selectedId ? songs.find(s => s._id === selectedId) : undefined;

  return (
    <div className="EditLayout">
      <div className="EditLayout-list">
        <CompactSongTable
          songs={songs}
          selectedId={selectedId}
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
