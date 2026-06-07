import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { updateSongMetadata, writeToAppleMusic, fetchGenreStats, fetchSongHistory } from '../api/client';
import { decomposeGenres, reassembleGenres } from '../hooks/useGenreDecomposition';
import type { PaginatedResponse, Song } from '../types';
import TextField from '@mui/material/TextField';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import { X, Loader2 } from 'lucide-react';
import './SingleSongMetadataEditForm.scss';

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

interface SnapshotData {
  artist: string;
  title: string;
  genres: string[];
  grouping: string[];
  bpm: number | null;
  key: string;
  year: number | null;
  rating: number;
}

interface SingleSongMetadataEditFormProps {
  song: Song;
  onDirtyChange?: (dirty: boolean) => void;
}

export default function SingleSongMetadataEditForm({ song, onDirtyChange }: SingleSongMetadataEditFormProps) {
  const queryClient = useQueryClient();
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
  const [isExporting, setIsExporting] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [saveIsError, setSaveIsError] = useState(false);
  const [exportMsg, setExportMsg] = useState('');
  const [exportIsError, setExportIsError] = useState(false);

  const keyFieldRef = useRef<HTMLDivElement>(null);
  const isFirstRender = useRef(true);
  const dirtyRef = useRef(false);

  const [initialSnapshot, setInitialSnapshot] = useState<SnapshotData>({
    artist: song.artist,
    title: song.title,
    genres: song.genres,
    grouping: song.grouping ?? [],
    bpm: song.bpm ?? null,
    key: song.key ?? '',
    year: song.year ?? null,
    rating: song.rating ?? 0,
  });

  const isDirty = (
    artist !== initialSnapshot.artist ||
    title !== initialSnapshot.title ||
    JSON.stringify(reassembleGenres(stage, setField, locationNz, listening, styles)) !== JSON.stringify(initialSnapshot.genres) ||
    JSON.stringify(grouping) !== JSON.stringify(initialSnapshot.grouping) ||
    (bpm ?? null) !== initialSnapshot.bpm ||
    formatKeyField(keyRoot, keyMinor) !== initialSnapshot.key ||
    (year ?? null) !== initialSnapshot.year ||
    rating !== initialSnapshot.rating
  );

  const patchSongsCache = useCallback((updated: Song) => {
    queryClient.setQueriesData<PaginatedResponse<Song>>(
      { queryKey: ['songs'] },
      (old) => {
        if (!old) return old;
        return {
          ...old,
          data: old.data.map((s) =>
            s._id === updated._id ? { ...s, ...updated } : s,
          ),
        };
      },
    );
  }, [queryClient]);

  function resetSnapshot(f: typeof latestRef.current) {
    setInitialSnapshot({
      artist: f.artist,
      title: f.title,
      genres: reassembleGenres(f.stage, f.setField, f.locationNz, f.listening, f.styles),
      grouping: f.grouping,
      bpm: f.bpm ?? null,
      key: formatKeyField(f.keyRoot, f.keyMinor),
      year: f.year ?? null,
      rating: f.rating,
    });
  }

  const saveMutation = useMutation({
    mutationFn: (data: Partial<Song>) => updateSongMetadata(song._id!, data),
    onSuccess: (updated) => {
      patchSongsCache(updated);
      dirtyRef.current = false;
      onDirtyChange?.(false);
      resetSnapshot(latestRef.current);
      setSaveMsg('');
      setSaveIsError(false);
      queryClient.invalidateQueries({ queryKey: ['song-history', song._id] });
    },
    onError: (err) => {
      console.error('Save failed', err);
      setSaveMsg(err instanceof Error ? err.message : 'Save failed');
      setSaveIsError(true);
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
      dirtyRef.current = true;
      onDirtyChange?.(true);
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
    grouping, bpm, keyRoot, keyMinor, year, rating, onDirtyChange,
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

  // Warn on tab close / reload when there are unsaved changes
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirtyRef.current || saveMutation.isPending || isExporting) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [saveMutation.isPending, isExporting]);

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
    setIsExporting(true);
    setExportMsg('');
    setExportIsError(false);
    try {
      const f = latestRef.current;
      const genres = reassembleGenres(f.stage, f.setField, f.locationNz, f.listening, f.styles);
      const key = formatKeyField(f.keyRoot, f.keyMinor);
      const updated = await updateSongMetadata(f.id!, {
        artist: f.artist || undefined,
        title: f.title || undefined,
        genres,
        grouping: f.grouping,
        bpm: f.bpm ?? undefined,
        key: key || undefined,
        year: f.year ?? undefined,
        rating: f.rating > 0 ? f.rating : undefined,
      });
      patchSongsCache(updated);
      dirtyRef.current = false;
      onDirtyChange?.(false);
      resetSnapshot(latestRef.current);
      const result = await writeToAppleMusic(f.id!);
      setIsExporting(false);
      setExportMsg(result.message);
      setExportIsError(!result.success);
    } catch {
      setIsExporting(false);
      setExportMsg('Write to Apple Music failed');
      setExportIsError(true);
    }
  }, [patchSongsCache, onDirtyChange]);

  const statusMode: 'idle' | 'saving' | 'exporting' | 'save-result' | 'export-result' = (() => {
    if (isExporting) return 'exporting';
    if (saveMutation.isPending || isDirty) return 'saving';
    if (saveMsg) return 'save-result';
    if (exportMsg) return 'export-result';
    return 'idle';
  })();

  const statusText = statusMode === 'exporting'
    ? 'Writing metadata to Apple Music library…'
    : statusMode === 'saving'
      ? 'Saving changes…'
      : statusMode === 'save-result'
        ? saveMsg
        : statusMode === 'export-result'
          ? exportMsg
          : '';

  const statusIsError = (statusMode === 'save-result' && saveIsError)
    || (statusMode === 'export-result' && exportIsError);

  const statusSpinner = statusMode === 'saving' || statusMode === 'exporting';

  return (
    <Box className="SingleSongMetadataEditForm">
      <Box className="SingleSongMetadataEditForm-row">
          <Box className="SingleSongMetadataEditForm-field">
            <span className="SingleSongMetadataEditForm-field-label">artist</span>
            <TextField
              id="edit-field-artist"
              value={artist}
              onChange={(e) => setArtist(e.target.value)}
              onBlur={handleArtistBlur}
              size="small"
              fullWidth
            />
          </Box>
          <Box className="SingleSongMetadataEditForm-field">
            <span className="SingleSongMetadataEditForm-field-label">title</span>
            <TextField
              id="edit-field-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={handleTitleBlur}
              size="small"
              fullWidth
            />
          </Box>
          <Box className="SingleSongMetadataEditForm-field SingleSongMetadataEditForm-field--no-label" id="edit-field-rating">
            <Box className="SingleSongMetadataEditForm-rating" tabIndex={-1}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Box
                  key={n}
                  component="span"
                  className={`SingleSongMetadataEditForm-star ${n <= rating ? 'SingleSongMetadataEditForm-star--on' : ''}`}
                  onClick={() => setRating(n)}
                >
                  {n <= rating ? '\u2605' : '\u2606'}
                </Box>
              ))}
            </Box>
          </Box>
        </Box>

        <Box className="SingleSongMetadataEditForm-row">
          <Box className="SingleSongMetadataEditForm-field">
            <span className="SingleSongMetadataEditForm-field-label">grouping</span>
            <span className="SingleSongMetadataEditForm-composite-pill">
              {['DJing', 'Listening'].map((opt) => (
                <span
                  key={opt}
                  className={`SingleSongMetadataEditForm-composite-segment ${grouping.includes(opt) ? 'SingleSongMetadataEditForm-composite-segment--on' : ''}`}
                  onClick={() => toggleGroupingPill(opt)}
                >
                  {opt}
                </span>
              ))}
            </span>
          </Box>
          <Box className="SingleSongMetadataEditForm-field">
            <span className="SingleSongMetadataEditForm-field-label">bpm</span>
            <TextField
              id="edit-field-bpm"
              type="number"
              value={bpm ?? ''}
              onChange={(e) => setBpm(e.target.value ? parseFloat(e.target.value) : null)}
              size="small"
              slotProps={{ htmlInput: { min: 0, max: 999, step: 1 } }}
            />
          </Box>
          <Box className="SingleSongMetadataEditForm-field" ref={keyFieldRef}>
            <span className="SingleSongMetadataEditForm-field-label">key</span>
            <Box className="SingleSongMetadataEditForm-key-row">
              <select
                value={keyRoot || ''}
                onChange={handleKeyRootChange}
                className="SingleSongMetadataEditForm-key-select"
              >
                <option value="">—</option>
                {KEY_ROOTS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
              <span
                className={`SingleSongMetadataEditForm-pill SingleSongMetadataEditForm-pill--sm ${keyMinor ? 'SingleSongMetadataEditForm-pill--on' : ''}`}
                onClick={handleMinorToggle}
              >
                m
              </span>
            </Box>
          </Box>
          <Box className="SingleSongMetadataEditForm-field">
            <span className="SingleSongMetadataEditForm-field-label">year</span>
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

        <Box className="SingleSongMetadataEditForm-row">
          <Box className="SingleSongMetadataEditForm-field">
            <span className="SingleSongMetadataEditForm-field-label">set</span>
            <span className="SingleSongMetadataEditForm-composite-pill">
              {SET_OPTIONS.map((opt) => (
                <span
                  key={opt}
                  className={`SingleSongMetadataEditForm-composite-segment ${setField.includes(opt) ? 'SingleSongMetadataEditForm-composite-segment--on' : ''}`}
                  onClick={() => toggleSet(opt)}
                >
                  {opt}
                </span>
              ))}
            </span>
          </Box>
          <Box className="SingleSongMetadataEditForm-field">
            <span className="SingleSongMetadataEditForm-field-label">stage</span>
            <span className="SingleSongMetadataEditForm-composite-pill">
              {STAGE_OPTIONS.map((opt) => (
                <span
                  key={opt}
                  className={`SingleSongMetadataEditForm-composite-segment ${stage.includes(opt) ? 'SingleSongMetadataEditForm-composite-segment--on' : ''}`}
                  onClick={() => toggleStage(opt)}
                >
                  {opt}
                </span>
              ))}
            </span>
          </Box>
          <Box className="SingleSongMetadataEditForm-field SingleSongMetadataEditForm-field--nz SingleSongMetadataEditForm-field--no-label">
            <span
              className={`SingleSongMetadataEditForm-pill SingleSongMetadataEditForm-pill--nz ${locationNz ? 'SingleSongMetadataEditForm-pill--on' : ''}`}
              onClick={() => setLocationNz((prev) => !prev)}
            >
              NZ
            </span>
          </Box>
        </Box>

        <Box className="SingleSongMetadataEditForm-row">
          <Box className="SingleSongMetadataEditForm-field SingleSongMetadataEditForm-field--styles">
            <span className="SingleSongMetadataEditForm-field-label">styles</span>
            {styles.length > 0 && (
              <span className="SingleSongMetadataEditForm-styles-pills">
                {styles.map((opt) => (
                  <span key={opt} className="SingleSongMetadataEditForm-pill SingleSongMetadataEditForm-pill--on SingleSongMetadataEditForm-pill--removable" onClick={() => setStyles(prev => prev.filter(s => s !== opt))}>
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
            <Box className="SingleSongMetadataEditForm-row">
              <Box className="SingleSongMetadataEditForm-field">
                <span className="SingleSongMetadataEditForm-field-label">listening</span>
                <span className="SingleSongMetadataEditForm-pill-group">
                  {LISTENING_ROW1.map((opt) => (
                    <span
                      key={opt}
                      className={`SingleSongMetadataEditForm-pill ${listening.includes(opt) ? 'SingleSongMetadataEditForm-pill--on' : ''}`}
                      onClick={() => toggleListening(opt)}
                    >
                      {opt}
                    </span>
                  ))}
                </span>
              </Box>
            </Box>
            <Box className="SingleSongMetadataEditForm-row SingleSongMetadataEditForm-row--tight">
              <Box className="SingleSongMetadataEditForm-field">
                <span className="SingleSongMetadataEditForm-pill-group">
                  {LISTENING_ROW2.map((opt) => (
                    <span
                      key={opt}
                      className={`SingleSongMetadataEditForm-pill ${listening.includes(opt) ? 'SingleSongMetadataEditForm-pill--on' : ''}`}
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

        <Box className="SingleSongMetadataEditForm-export">
          <span
            className={`SingleSongMetadataEditForm-pill SingleSongMetadataEditForm-pill--action${isExporting ? ' SingleSongMetadataEditForm-pill--disabled' : ''}`}
            onClick={isExporting ? undefined : handleExport}
          >
            Save to Apple Music
          </span>
          <span className={`SingleSongMetadataEditForm-status${
            statusSpinner
              ? ' SingleSongMetadataEditForm-status--visible'
              : statusMode !== 'idle'
                ? ` SingleSongMetadataEditForm-status--result${statusIsError ? ' SingleSongMetadataEditForm-status--error' : ''}`
                : ''
          }`}>
            {statusSpinner && <Loader2 className="SingleSongMetadataEditForm-spinner" size={14} />}
            {statusText}
          </span>
        </Box>

        {history && history.length > 0 && (
          <details className="SingleSongMetadataEditForm-history">
            <summary className="SingleSongMetadataEditForm-history-summary">
              edit history ({history.length})
            </summary>
            <Box className="SingleSongMetadataEditForm-history-list">
              {history.map((entry) => (
                  <Box key={entry._id} className="SingleSongMetadataEditForm-history-entry">
                    <span className="SingleSongMetadataEditForm-history-date">
                      {new Date(entry.dateEdited).toLocaleString()}
                    </span>
                    <span className="SingleSongMetadataEditForm-history-source">
                      {entry.sourceType}
                    </span>
                    {entry.diff.length > 0 && (
                      <span className="SingleSongMetadataEditForm-history-diffs">
                        {entry.diff.map((d) => (
                          <span key={d.field} className="SingleSongMetadataEditForm-history-field">
                            <span className="SingleSongMetadataEditForm-history-field-label">{d.field}:</span>
                            {Array.isArray(d.value) ? (
                              d.value.map((v) => (
                                <span key={v} className="SingleSongMetadataEditForm-history-token">{v}</span>
                              ))
                            ) : (
                              <span className="SingleSongMetadataEditForm-history-value">{d.value}</span>
                            )}
                          </span>
                        ))}
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
