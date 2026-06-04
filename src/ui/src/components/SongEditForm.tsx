import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';

import { updateSongMetadata, writeToAppleMusic, fetchGenreStats, fetchSongHistory } from '../api/client';
import { decomposeGenres, reassembleGenres } from '../hooks/useGenreDecomposition';
import type { Song } from '../types';
import TextField from '@mui/material/TextField';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import { X } from 'lucide-react';
import './SongEditForm.scss';

const KEY_ROOTS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const STAGE_OPTIONS = ['Warmup', 'Peak', 'Later'];
const SET_OPTIONS = ['Deep', 'BAM', 'Ambient'];
const LISTENING_ROW1 = ['Dance', 'Electronic', 'Jazz', 'Funk', 'Contemporary', 'Classical'];
const LISTENING_ROW2 = ['Reggae', 'Hip Hop', 'Pop', 'Rock', 'Country', 'Indie'];

const KNOWN_TAGS = new Set([
  ...STAGE_OPTIONS, ...SET_OPTIONS, ...LISTENING_ROW1, ...LISTENING_ROW2, 'NZ',
]);

function parseKeyField(value: string | undefined): { root: string; minor: boolean } {
  if (!value) return { root: '', minor: false };
  const minor = value.endsWith('m');
  const root = minor ? value.slice(0, -1) : value;
  return { root: KEY_ROOTS.includes(root) ? root : '', minor };
}

function formatKeyField(root: string, minor: boolean): string {
  if (!root) return '';
  return root + (minor ? 'm' : '');
}

interface SongEditFormProps {
  song: Song;
}

export default function SongEditForm({ song }: SongEditFormProps) {
  const init = useMemo(() => decomposeGenres(song.genres), [song.genres]);
  const initKey = useMemo(() => parseKeyField(song.key), [song.key]);

  const [artist, setArtist] = useState(song.artist);
  const [title, setTitle] = useState(song.title);
  const [stage, setStage] = useState(init.stage);
  const [setField, setSetField] = useState(init.set);
  const [locationNz, setLocationNz] = useState(init.locationNz);
  const [styles, setStyles] = useState<string[]>(init.styles);
  const [listening, setListening] = useState<string[]>(init.listening);
  const [grouping, setGrouping] = useState<string[]>(song.grouping ?? []);
  const [bpm, setBpm] = useState(song.bpm ?? null);
  const [keyRoot, setKeyRoot] = useState(initKey.root);
  const [keyMinor, setKeyMinor] = useState(initKey.minor);
  const [year, setYear] = useState(song.year ?? null);
  const [rating, setRating] = useState(song.rating ?? 0);
  const [exportMsg, setExportMsg] = useState('');
  const [exportIsError, setExportIsError] = useState(false);

  const keyFieldRef = useRef<HTMLDivElement>(null);
  const isFirstRender = useRef(true);

  const saveMutation = useMutation({
    mutationFn: (data: Partial<Song>) => updateSongMetadata(song._id!, data),
    onError: (err) => {
      console.error('Save failed', err);
    },
  });

  const mutateRef = useRef(saveMutation.mutate);
  useEffect(() => { mutateRef.current = saveMutation.mutate; }, [saveMutation.mutate]);

  // Debounced auto-save on any state change. Each render starts an 800ms timer;
  // cleanup cancels it so rapid changes collapse into one save.
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const timer = setTimeout(() => {
      const genres = reassembleGenres(stage, setField, locationNz, listening, styles);
      const key = formatKeyField(keyRoot, keyMinor);
      mutateRef.current({
        artist: artist || undefined,
        title: title || undefined,
        genres,
        grouping,
        bpm: bpm ?? undefined,
        key: key || undefined,
        year: year ?? undefined,
        rating: rating > 0 ? rating : undefined,
      });
    }, 800);
    return () => clearTimeout(timer);
  }, [
    artist, title, stage, setField, locationNz, listening, styles,
    grouping, bpm, keyRoot, keyMinor, year, rating,
  ]);

  // Latest-state ref (updated after every render) for unmount flush and export.
  const latestRef = useRef({
    artist, title, stage, setField, locationNz, listening, styles,
    grouping, bpm, keyRoot, keyMinor, year, rating, id: song._id,
  });
  useEffect(() => {
    latestRef.current = {
      artist, title, stage, setField, locationNz, listening, styles,
      grouping, bpm, keyRoot, keyMinor, year, rating, id: song._id,
    };
  });

  // Unmount: flush any unsaved changes
  useEffect(() => {
    return () => {
      const f = latestRef.current;
      const genres = reassembleGenres(f.stage, f.setField, f.locationNz, f.listening, f.styles);
      const key = formatKeyField(f.keyRoot, f.keyMinor);
      mutateRef.current({
        artist: f.artist || undefined,
        title: f.title || undefined,
        genres,
        grouping: f.grouping,
        bpm: f.bpm ?? undefined,
        key: key || undefined,
        year: f.year ?? undefined,
        rating: f.rating > 0 ? f.rating : undefined,
      });
    };
  }, []);

  const { data: allGenreStats } = useQuery({
    queryKey: ['genres', 'stats'],
    queryFn: () => fetchGenreStats(),
  });

  const allStyleSuggestions = useMemo(() => {
    if (!allGenreStats) return [];
    return allGenreStats
      .filter((g: { genre: string; count: number }) => !KNOWN_TAGS.has(g.genre))
      .sort((a, b) => b.count - a.count)
      .map((g: { genre: string }) => g.genre);
  }, [allGenreStats]);

  const { data: history } = useQuery({
    queryKey: ['song-history', song._id],
    queryFn: () => fetchSongHistory(song._id!),
    enabled: !!song._id,
  });

  // Handlers only update state. The effect above debounces saves.
  // No inline save calls — no double saves, no stale closures.

  const handleArtistBlur = useCallback(() => {
    if (!artist.trim()) setArtist(song.artist);
  }, [artist, song.artist]);

  const handleTitleBlur = useCallback(() => {
    if (!title.trim()) setTitle(song.title);
  }, [title, song.title]);

  const toggleStage = useCallback((opt: string) => {
    setStage((prev) =>
      prev.includes(opt) ? prev.filter((s) => s !== opt) : [...prev, opt],
    );
  }, []);

  const toggleSet = useCallback((opt: string) => {
    setSetField((prev) =>
      prev.includes(opt) ? prev.filter((s) => s !== opt) : [...prev, opt],
    );
  }, []);

  const toggleListening = useCallback((opt: string) => {
    setListening((prev) =>
      prev.includes(opt) ? prev.filter((s) => s !== opt) : [...prev, opt],
    );
  }, []);

  const toggleGroupingPill = useCallback((opt: string) => {
    setGrouping((prev) => {
      if (prev.includes(opt)) {
        if (prev.length === 1) return prev;
        return prev.filter((g) => g !== opt);
      }
      return [...prev, opt];
    });
  }, []);

  const handleKeyRootChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setKeyRoot(e.target.value);
  }, []);

  const handleMinorToggle = useCallback(() => {
    setKeyMinor((prev) => !prev);
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement).tagName;
    const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
    const keyFieldActive = keyFieldRef.current?.contains(e.target as Node);

    if (isInput && !keyFieldActive) return;

    if (e.key >= '1' && e.key <= '5' && !isInput) {
      e.preventDefault();
      setRating(parseInt(e.key, 10));
      return;
    }

    if (!isInput) {
      if (e.key === 'd') {
        setGrouping((prev) => {
          if (prev.includes('DJing')) return prev;
          return [...prev, 'DJing'];
        });
        return;
      }
      if (e.key === 'l') {
        setGrouping((prev) => {
          if (prev.includes('Listening')) return prev;
          return [...prev, 'Listening'];
        });
        return;
      }
    }

    if (keyFieldActive) {
      const SHARP_MAP: Record<string, string> = {
        C: 'C#', 'C#': 'C', D: 'D#', 'D#': 'D', E: 'F', F: 'F#', 'F#': 'F',
        G: 'G#', 'G#': 'G', A: 'A#', 'A#': 'A', B: 'C',
      };
      const ROOT_FROM_KEY: Record<string, string> = {
        a: 'A', b: 'B', c: 'C', d: 'D', e: 'E', f: 'F', g: 'G',
      };
      const lower = e.key.toLowerCase();
      if (lower >= 'a' && lower <= 'g') {
        e.preventDefault();
        setKeyRoot(ROOT_FROM_KEY[lower] || '');
        return;
      }
      if (e.key === '+') {
        e.preventDefault();
        setKeyRoot((prev) => SHARP_MAP[prev] || prev);
        return;
      }
      if (e.key === 'm') {
        e.preventDefault();
        setKeyMinor((prev) => !prev);
        return;
      }
    }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const handleExport = useCallback(async () => {
    setExportMsg('');
    setExportIsError(false);
    try {
      const f = latestRef.current;
      const genres = reassembleGenres(f.stage, f.setField, f.locationNz, f.listening, f.styles);
      const key = formatKeyField(f.keyRoot, f.keyMinor);
      await updateSongMetadata(f.id!, {
        artist: f.artist || undefined,
        title: f.title || undefined,
        genres,
        grouping: f.grouping,
        bpm: f.bpm ?? undefined,
        key: key || undefined,
        year: f.year ?? undefined,
        rating: f.rating > 0 ? f.rating : undefined,
      });
      const result = await writeToAppleMusic(f.id!);
      setExportMsg(result.message);
      setExportIsError(!result.success);
    } catch {
      setExportMsg('Write to Apple Music failed');
      setExportIsError(true);
    }
  }, []);

  return (
    <Box className="SongEditForm">
      <Box className="SongEditForm-row">
          <Box className="SongEditForm-field">
            <span className="SongEditForm-field-label">artist</span>
            <TextField
              id="edit-field-artist"
              value={artist}
              onChange={(e) => setArtist(e.target.value)}
              onBlur={handleArtistBlur}
              size="small"
              fullWidth
            />
          </Box>
          <Box className="SongEditForm-field">
            <span className="SongEditForm-field-label">title</span>
            <TextField
              id="edit-field-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={handleTitleBlur}
              size="small"
              fullWidth
            />
          </Box>
          <Box className="SongEditForm-field SongEditForm-field--no-label" id="edit-field-rating">
            <Box className="SongEditForm-rating" tabIndex={-1}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Box
                  key={n}
                  component="span"
                  className={`SongEditForm-star ${n <= rating ? 'SongEditForm-star--on' : ''}`}
                  onClick={() => setRating(n)}
                >
                  {n <= rating ? '\u2605' : '\u2606'}
                </Box>
              ))}
            </Box>
          </Box>
        </Box>

        <Box className="SongEditForm-row">
          <Box className="SongEditForm-field">
            <span className="SongEditForm-field-label">grouping</span>
            <span className="SongEditForm-composite-pill">
              {['DJing', 'Listening'].map((opt) => (
                <span
                  key={opt}
                  className={`SongEditForm-composite-segment ${grouping.includes(opt) ? 'SongEditForm-composite-segment--on' : ''}`}
                  onClick={() => toggleGroupingPill(opt)}
                >
                  {opt}
                </span>
              ))}
            </span>
          </Box>
          <Box className="SongEditForm-field">
            <span className="SongEditForm-field-label">bpm</span>
            <TextField
              id="edit-field-bpm"
              type="number"
              value={bpm ?? ''}
              onChange={(e) => setBpm(e.target.value ? parseFloat(e.target.value) : null)}
              size="small"
              slotProps={{ htmlInput: { min: 0, max: 999, step: 1 } }}
            />
          </Box>
          <Box className="SongEditForm-field" ref={keyFieldRef}>
            <span className="SongEditForm-field-label">key</span>
            <Box className="SongEditForm-key-row">
              <select
                value={keyRoot || ''}
                onChange={handleKeyRootChange}
                className="SongEditForm-key-select"
              >
                <option value="">—</option>
                {KEY_ROOTS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
              <span
                className={`SongEditForm-pill SongEditForm-pill--sm ${keyMinor ? 'SongEditForm-pill--on' : ''}`}
                onClick={handleMinorToggle}
              >
                m
              </span>
            </Box>
          </Box>
          <Box className="SongEditForm-field">
            <span className="SongEditForm-field-label">year</span>
            <TextField
              id="edit-field-year"
              type="number"
              value={year ?? ''}
              onChange={(e) => setYear(e.target.value ? parseInt(e.target.value, 10) : null)}
              size="small"
              slotProps={{ htmlInput: { min: 1900, max: 2099, step: 1 } }}
            />
          </Box>
        </Box>

        <Box className="SongEditForm-row">
          <Box className="SongEditForm-field">
            <span className="SongEditForm-field-label">set</span>
            <span className="SongEditForm-composite-pill">
              {SET_OPTIONS.map((opt) => (
                <span
                  key={opt}
                  className={`SongEditForm-composite-segment ${setField.includes(opt) ? 'SongEditForm-composite-segment--on' : ''}`}
                  onClick={() => toggleSet(opt)}
                >
                  {opt}
                </span>
              ))}
            </span>
          </Box>
          <Box className="SongEditForm-field">
            <span className="SongEditForm-field-label">stage</span>
            <span className="SongEditForm-composite-pill">
              {STAGE_OPTIONS.map((opt) => (
                <span
                  key={opt}
                  className={`SongEditForm-composite-segment ${stage.includes(opt) ? 'SongEditForm-composite-segment--on' : ''}`}
                  onClick={() => toggleStage(opt)}
                >
                  {opt}
                </span>
              ))}
            </span>
          </Box>
          <Box className="SongEditForm-field SongEditForm-field--nz SongEditForm-field--no-label">
            <span
              className={`SongEditForm-pill SongEditForm-pill--nz ${locationNz ? 'SongEditForm-pill--on' : ''}`}
              onClick={() => setLocationNz((prev) => !prev)}
            >
              NZ
            </span>
          </Box>
        </Box>

        <Box className="SongEditForm-row">
          <Box className="SongEditForm-field SongEditForm-field--styles">
            <span className="SongEditForm-field-label">styles</span>
            {styles.length > 0 && (
              <span className="SongEditForm-styles-pills">
                {styles.map((opt) => (
                  <span key={opt} className="SongEditForm-pill SongEditForm-pill--on SongEditForm-pill--removable" onClick={() => setStyles(prev => prev.filter(s => s !== opt))}>
                    <X size={18} />{opt}
                  </span>
                ))}
              </span>
            )}
            <Autocomplete
              multiple
              freeSolo
              id="edit-field-styles"
              options={allStyleSuggestions}
              value={styles}
              onChange={(_, newVal) => {
                setStyles(newVal as string[]);
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  placeholder="Add style..."
                  size="small"
                  onPaste={(e) => {
                    const text = e.clipboardData.getData('text');
                    if (!text.includes(',')) return;
                    e.preventDefault();
                    const items = [...new Set(
                      text.split(',').map(s => s.trim()).filter(Boolean),
                    )];
                    setStyles(prev => [...new Set([...prev, ...items])]);
                  }}
                />
              )}
              fullWidth
            />
          </Box>
        </Box>

        {grouping.includes('Listening') && (
          <>
            <Box className="SongEditForm-row">
              <Box className="SongEditForm-field">
                <span className="SongEditForm-field-label">listening</span>
                <span className="SongEditForm-pill-group">
                  {LISTENING_ROW1.map((opt) => (
                    <span
                      key={opt}
                      className={`SongEditForm-pill ${listening.includes(opt) ? 'SongEditForm-pill--on' : ''}`}
                      onClick={() => toggleListening(opt)}
                    >
                      {opt}
                    </span>
                  ))}
                </span>
              </Box>
            </Box>
            <Box className="SongEditForm-row SongEditForm-row--tight">
              <Box className="SongEditForm-field">
                <span className="SongEditForm-pill-group">
                  {LISTENING_ROW2.map((opt) => (
                    <span
                      key={opt}
                      className={`SongEditForm-pill ${listening.includes(opt) ? 'SongEditForm-pill--on' : ''}`}
                      onClick={() => toggleListening(opt)}
                    >
                      {opt}
                    </span>
                  ))}
                </span>
              </Box>
            </Box>
          </>
        )}

        <Box className="SongEditForm-export">
          <span className="SongEditForm-pill SongEditForm-pill--action" onClick={handleExport}>
            Save to Apple Music
          </span>
          {exportMsg && (
            <Box component="span" className={`SongEditForm-export-msg${exportIsError ? ' SongEditForm-export-msg--error' : ''}`}>{exportMsg}</Box>
          )}
        </Box>

        {history && history.length > 0 && (
          <details className="SongEditForm-history">
            <summary className="SongEditForm-history-summary">
              edit history ({history.length})
            </summary>
            <Box className="SongEditForm-history-list">
              {history.map((entry) => (
                <Box key={entry._id} className="SongEditForm-history-entry">
                  <span className="SongEditForm-history-date">
                    {new Date(entry.dateEdited).toLocaleString()}
                  </span>
                  <span className="SongEditForm-history-source">
                    {entry.sourceType}
                  </span>
                  {entry.snapshot.genres.length > 0 && (
                    <span className="SongEditForm-history-genres">
                      {entry.snapshot.genres.join(', ')}
                    </span>
                  )}
                </Box>
              ))}
            </Box>
          </details>
        )}
    </Box>
  );
}
