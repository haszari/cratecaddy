import { useEffect, useCallback, useRef, useState } from 'react';
import type { Song } from '../types';
import CompactSongTable from './CompactSongTable';
import SingleSongMetadataEditForm from './SingleSongMetadataEditForm';
import MultiSongMetadataEditForm from './MultiSongMetadataEditForm';
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
  selectedIds: Set<string>;
  onSelect: (id: string, mode?: 'toggle' | 'range') => void;
}

export default function EditLayout({
  songs, selectedIds, onSelect,
}: EditLayoutProps) {
  const dirtyRef = useRef(false);

  const [songExportStatuses, setSongExportStatuses] = useState<Map<string, { success: boolean; message: string }>>(new Map());

  const handleDirtyChange = useCallback((dirty: boolean) => {
    dirtyRef.current = dirty;
  }, []);

  const handleExportComplete = useCallback(
    (results: { id: string; success: boolean; message: string }[]) => {
      setSongExportStatuses(prev => {
        const next = new Map(prev);
        for (const r of results) {
          next.set(r.id, { success: r.success, message: r.message });
        }
        return next;
      });
    }, []);

  const handleSelect = useCallback((id: string, mode?: 'toggle' | 'range') => {
    if (dirtyRef.current) return;
    onSelect(id, mode);
  }, [onSelect]);

  const hasSelection = selectedIds.size > 0 && Array.from(selectedIds).some(id => songs.some(s => s._id === id));
  useEffect(() => {
    if (songs.length > 0 && !hasSelection) {
      const firstId = songs[0]._id;
      if (firstId) {
        handleSelect(firstId);
      }
    }
  }, [songs, hasSelection, handleSelect]);

  const firstSelectedIndex = songs.findIndex(s => s._id && selectedIds.has(s._id));
  const isMulti = selectedIds.size > 1;

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement).tagName;
    const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
    if (isInput) return;

    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (isMulti) return;
      e.preventDefault();
      const currentIndex = firstSelectedIndex;
      if (currentIndex === -1) return;
      const nextIndex = e.key === 'ArrowDown'
        ? Math.min(currentIndex + 1, songs.length - 1)
        : Math.max(currentIndex - 1, 0);
      if (nextIndex !== currentIndex) {
        handleSelect(songs[nextIndex]._id!);
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
  }, [songs, firstSelectedIndex, isMulti, handleSelect]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const selectedSongs = songs.filter(s => s._id && selectedIds.has(s._id));

  return (
    <div className="EditLayout">
      <div className="EditLayout-list">
        <CompactSongTable
          songs={songs}
          selectedIds={selectedIds}
          onSelect={handleSelect}
          exportStatuses={songExportStatuses}
        />
      </div>
      <div className="EditLayout-detail">
        {selectedSongs.length === 0 && (
          <p className="EditLayout-empty">Select songs to edit</p>
        )}
        {selectedSongs.length === 1 && (
          <SingleSongMetadataEditForm
            key={selectedSongs[0]._id}
            song={selectedSongs[0]}
            onDirtyChange={handleDirtyChange}
          />
        )}
        {selectedSongs.length > 1 && (
          <MultiSongMetadataEditForm
            key={selectedSongs.map(s => s._id).join(',')}
            songs={selectedSongs}
            onDirtyChange={handleDirtyChange}
            onExportComplete={handleExportComplete}
          />
        )}
      </div>
    </div>
  );
}
