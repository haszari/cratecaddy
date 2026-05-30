import { useState, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { updateSongMetadata, exportToAppleMusic, fetchSongHistory } from '../api/client';
import type { Song } from '../types';
import './SongEditForm.scss';

interface SongEditFormProps {
  song: Song;
}

function decomposeGrouping(grouping: string[] = []): {
  stage: string;
  set: string;
  location: string;
  styles: string[];
} {
  return {
    stage: grouping[0] ?? '',
    set: grouping[1] ?? '',
    location: grouping[2] ?? '',
    styles: grouping.slice(3),
  };
}

function composeGrouping(stage: string, set: string, location: string, styles: string[]): string[] {
  const parts = [stage, set, location, ...styles];
  return parts.filter(Boolean);
}

const STAGE_OPTIONS = ['Warmup', 'Peak', 'Later'];
const SET_OPTIONS = ['Deep', 'BAM', 'Ambient'];
const STYLE_OPTIONS = ['Jazz', 'Funk', 'Classical', 'Contemporary', 'Electronic', 'Dance', 'Hip Hop', 'Pop', 'Rock', 'Country', 'Indie', 'Ambient'];

const FAVORITE_ICONS: Record<string, string> = {
  starred: '★',
  normal: '○',
  disliked: '✕',
};

export default function SongEditForm({ song }: SongEditFormProps) {
  const queryClient = useQueryClient();
  const init = decomposeGrouping(song.grouping);

  const [genresText, setGenresText] = useState(song.genres.join(', '));
  const [stage, setStage] = useState(init.stage);
  const [setField, setSetField] = useState(init.set);
  const [location, setLocation] = useState(init.location);
  const [styles, setStyles] = useState<string[]>(init.styles);
  const [bpm, setBpm] = useState(song.bpm ?? 0);
  const [key, setKey] = useState(song.key ?? '');
  const [rating, setRating] = useState(song.rating ?? 0);
  const [favorite, setFavorite] = useState(song.favorite ?? 'normal');
  const [exportMsg, setExportMsg] = useState('');

  const { data: history } = useQuery({
    queryKey: ['history', song._id],
    queryFn: () => fetchSongHistory(song._id!),
    enabled: !!song._id,
  });

  const saveMutation = useMutation({
    mutationFn: (data: Partial<Song>) => updateSongMetadata(song._id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['songs'] });
      queryClient.invalidateQueries({ queryKey: ['history', song._id] });
    },
  });

  const handleSave = useCallback(() => {
    const genres = genresText.split(',').map((g) => g.trim()).filter(Boolean);
    const grouping = composeGrouping(stage, setField, location, styles);
    saveMutation.mutate({
      genres,
      grouping,
      bpm: bpm || undefined,
      key: key || undefined,
      rating: rating || undefined,
      favorite: favorite === 'normal' ? undefined : favorite,
    });
  }, [genresText, stage, setField, location, styles, bpm, key, rating, favorite, saveMutation]);

  const handleExport = useCallback(async () => {
    const result = await exportToAppleMusic(song._id!);
    setExportMsg(result.success ? 'Exported ✓' : result.message);
    setTimeout(() => setExportMsg(''), 3000);
  }, [song._id]);

  const toggleStyle = (s: string) => {
    setStyles((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]);
  };

  return (
    <div className="SongEditForm">
      <h2 className="SongEditForm-header">
        {song.artist} – {song.title}
        {song.appleMusicId && <span className="SongEditForm-amid">⋮ {song.appleMusicId}</span>}
      </h2>

      <div className="SongEditForm-section">
        <label>Genres</label>
        <input
          value={genresText}
          onChange={(e) => setGenresText(e.target.value)}
          onBlur={handleSave}
          placeholder="e.g. Deep House, Tech House"
        />
      </div>

      <div className="SongEditForm-section">
        <label>Stage</label>
        <select value={stage} onChange={(e) => { setStage(e.target.value); }} onBlur={handleSave}>
          <option value="">—</option>
          {STAGE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>

      <div className="SongEditForm-section">
        <label>Set</label>
        <select value={setField} onChange={(e) => { setSetField(e.target.value); }} onBlur={handleSave}>
          <option value="">—</option>
          {SET_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>

      <div className="SongEditForm-section">
        <label>Location</label>
        <input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          onBlur={handleSave}
          placeholder="e.g. Room 1, Terrace"
        />
      </div>

      <div className="SongEditForm-section">
        <label>Styles</label>
        <div className="SongEditForm-styles">
          {STYLE_OPTIONS.map((s) => (
            <button
              key={s}
              className={`SongEditForm-style-btn ${styles.includes(s) ? 'SongEditForm-style-btn--active' : ''}`}
              onClick={() => { toggleStyle(s); handleSave(); }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="SongEditForm-row">
        <div className="SongEditForm-section SongEditForm-section--half">
          <label>BPM</label>
          <input
            type="number"
            value={bpm || ''}
            onChange={(e) => setBpm(parseFloat(e.target.value) || 0)}
            onBlur={handleSave}
            min={0} max={999}
          />
        </div>
        <div className="SongEditForm-section SongEditForm-section--half">
          <label>Key</label>
          <input
            value={key}
            onChange={(e) => setKey(e.target.value)}
            onBlur={handleSave}
            placeholder="e.g. Fm"
          />
        </div>
      </div>

      <div className="SongEditForm-row">
        <div className="SongEditForm-section SongEditForm-section--half">
          <label>Rating</label>
          <input
            type="number"
            value={rating || ''}
            onChange={(e) => setRating(parseFloat(e.target.value) || 0)}
            onBlur={handleSave}
            min={0} max={5} step={0.5}
          />
        </div>
        <div className="SongEditForm-section SongEditForm-section--half">
          <label>Favorite</label>
          <div className="SongEditForm-fav-row">
            {(['starred', 'normal', 'disliked'] as const).map((f) => (
              <button
                key={f}
                className={`SongEditForm-fav-btn ${favorite === f ? `SongEditForm-fav-btn--${f}` : ''}`}
                onClick={() => { setFavorite(f); handleSave(); }}
              >
                {FAVORITE_ICONS[f]}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="SongEditForm-actions">
        <button className="SongEditForm-export-btn" onClick={handleExport}>
          Export to Apple Music
        </button>
        {exportMsg && <span className="SongEditForm-export-msg">{exportMsg}</span>}
      </div>

      {history && history.length > 0 && (
        <div className="SongEditForm-history">
          <h3>History</h3>
          {history.slice(0, 20).map((entry) => (
            <div key={entry._id} className="SongEditForm-history-entry">
              <span className="SongEditForm-history-date">
                {new Date(entry.dateEdited).toLocaleString()}
              </span>
              <span className="SongEditForm-history-source">{entry.sourceType}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
