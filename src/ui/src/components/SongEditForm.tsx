import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { updateSongMetadata, exportToAppleMusic, fetchSongHistory, fetchGenreStats } from '../api/client';
import { decomposeGenres, reassembleGenres } from '../hooks/useGenreDecomposition';
import type { Song } from '../types';
import TextField from '@mui/material/TextField';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import { Star, ThumbsDown } from 'lucide-react';
import './SongEditForm.scss';

const KEY_ROOTS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const STAGE_OPTIONS = ['Warmup', 'Peak', 'Later'];
const SET_OPTIONS = ['Deep', 'BAM', 'Ambient'];
const LISTENING_ROW1 = ['Dance', 'Electronic', 'Jazz', 'Funk', 'Contemporary', 'Classical'];
const LISTENING_ROW2 = ['Reggae', 'Hip Hop', 'Pop', 'Rock', 'Country', 'Indie'];
const LISTENING_OPTIONS = [...LISTENING_ROW1, ...LISTENING_ROW2];
const ORG_TAGS = new Set([...STAGE_OPTIONS, ...SET_OPTIONS, ...LISTENING_OPTIONS, 'NZ']);

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
  const [favorite, setFavorite] = useState<Song['favorite']>(song.favorite ?? 'normal');
  const [exportMsg, setExportMsg] = useState('');

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<Partial<Song> | null>(null);

  const keyFieldRef = useRef<HTMLDivElement>(null);

  const saveMutation = useMutation({
    mutationFn: (data: Partial<Song>) => updateSongMetadata(song._id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['songs'] });
      queryClient.invalidateQueries({ queryKey: ['history', song._id] });
    },
  });

  const flushSave = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = null;
    if (pendingRef.current && Object.keys(pendingRef.current).length > 0) {
      saveMutation.mutate(pendingRef.current);
      pendingRef.current = null;
    }
  }, [saveMutation]);

  const scheduleSave = useCallback((data: Partial<Song>) => {
    pendingRef.current = { ...pendingRef.current, ...data };
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(flushSave, 800);
  }, [flushSave]);

  const handleSave = useCallback(() => {
    const genres = reassembleGenres(stage, setField, locationNz, listening, styles);
    const key = formatKeyField(keyRoot, keyMinor);
    scheduleSave({
      artist: artist || undefined,
      title: title || undefined,
      genres,
      grouping,
      bpm: bpm ?? undefined,
      key: key || undefined,
      year: year ?? undefined,
      rating: rating > 0 ? rating : undefined,
      favorite: favorite === 'normal' ? undefined : favorite,
    });
  }, [artist, title, stage, setField, locationNz, listening, styles, grouping, bpm, keyRoot, keyMinor, year, rating, favorite, scheduleSave]);

  const saveRef = useRef(handleSave);
  useEffect(() => { saveRef.current = handleSave; }, [handleSave]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      flushSave();
    };
  }, [flushSave]);

  useEffect(() => {
    const SHARP_MAP: Record<string, string> = {
      C: 'C#', 'C#': 'C', D: 'D#', 'D#': 'D', E: 'F', F: 'F#', 'F#': 'F',
      G: 'G#', 'G#': 'G', A: 'A#', 'A#': 'A', B: 'C',
    };
    const ROOT_FROM_KEY: Record<string, string> = {
      a: 'A', b: 'B', c: 'C', d: 'D', e: 'E', f: 'F', g: 'G',
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
      const keyFieldActive = keyFieldRef.current?.contains(e.target as Node);

      if (isInput && !keyFieldActive) return;

      if (e.key >= '1' && e.key <= '5' && !isInput) {
        e.preventDefault();
        setRating(parseInt(e.key, 10));
        setTimeout(() => saveRef.current(), 0);
        return;
      }

      if (!isInput) {
        if (e.key === 'd') {
          setGrouping((prev) => {
            if (prev.includes('DJing')) return prev;
            const next = [...prev, 'DJing'];
            setTimeout(() => saveRef.current(), 0);
            return next;
          });
          return;
        }
        if (e.key === 'l') {
          setGrouping((prev) => {
            if (prev.includes('Listening')) return prev;
            const next = [...prev, 'Listening'];
            setTimeout(() => saveRef.current(), 0);
            return next;
          });
          return;
        }
      }

      if (keyFieldActive) {
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
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const { data: history } = useQuery({
    queryKey: ['history', song._id],
    queryFn: () => fetchSongHistory(song._id!),
    enabled: !!song._id,
  });

  const { data: genreStats } = useQuery({
    queryKey: ['genreStats'],
    queryFn: () => fetchGenreStats(),
    staleTime: 60000,
  });

  const styleSuggestions = useMemo(() => {
    if (!genreStats) return [];
    return genreStats
      .map((g) => g.genre)
      .filter((g) => !ORG_TAGS.has(g))
      .sort((a, b) => {
        const aCount = genreStats.find((g) => g.genre === a)?.count ?? 0;
        const bCount = genreStats.find((g) => g.genre === b)?.count ?? 0;
        return bCount - aCount;
      });
  }, [genreStats]);

  const handleExport = useCallback(async () => {
    const result = await exportToAppleMusic(song._id!);
    setExportMsg(result.success ? 'Saved \u2713' : result.message);
    setTimeout(() => setExportMsg(''), 3000);
  }, [song._id]);

  const handleFlush = useCallback(() => {
    handleSave();
  }, [handleSave]);

  const handleArtistBlur = useCallback(() => {
    if (!artist.trim()) setArtist(song.artist);
    handleSave();
  }, [artist, song.artist, handleSave]);

  const handleTitleBlur = useCallback(() => {
    if (!title.trim()) setTitle(song.title);
    handleSave();
  }, [title, song.title, handleSave]);

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

  return (
    <Box className="SongEditForm">
      <Box className="SongEditForm-header">
        {song.artist} – {song.title}
        {song.appleMusicId && (
          <Box component="span" className="SongEditForm-amid">
            {' '}⋮ {song.appleMusicId}
          </Box>
        )}
      </Box>

      <Box className="SongEditForm-body">
        <Box className="SongEditForm-actions">
          <Box className="SongEditForm-pill-group">
            <span
              className={`SongEditForm-pill ${favorite === 'starred' ? 'SongEditForm-pill--on' : ''}`}
              onClick={() => setFavorite((prev) => prev === 'starred' ? 'normal' : 'starred')}
            >
              <Star size={14} fill={favorite === 'starred' ? 'currentColor' : 'none'} />
            </span>
            <span
              className={`SongEditForm-pill ${favorite === 'disliked' ? 'SongEditForm-pill--on' : ''}`}
              onClick={() => setFavorite((prev) => prev === 'disliked' ? 'normal' : 'disliked')}
            >
              <ThumbsDown size={14} />
            </span>
          </Box>
          <Box className="SongEditForm-export">
            <span className="SongEditForm-pill SongEditForm-pill--action" onClick={handleExport}>
              Save to Apple Music
            </span>
            {exportMsg && (
              <Box component="span" className="SongEditForm-export-msg">{exportMsg}</Box>
            )}
          </Box>
        </Box>

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
              onBlur={handleFlush}
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
                onBlur={handleFlush}
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
              onBlur={handleFlush}
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
          <Box className="SongEditForm-field">
            <span className="SongEditForm-field-label">styles</span>
            <Autocomplete
              multiple
              freeSolo
              id="edit-field-styles"
              options={styleSuggestions}
              value={styles}
              onChange={(_, newVal) => {
                setStyles(newVal);
              }}
              onBlur={handleFlush}
              renderInput={(params) => (
                <TextField {...params} placeholder="Add style..." size="small" />
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

        {history && history.length > 0 && (
          <Box className="SongEditForm-history">
            <Box className="SongEditForm-history-title">History</Box>
            {history.slice(0, 20).map((entry) => (
              <Box key={entry._id} className="SongEditForm-history-entry">
                <span className="SongEditForm-history-date">
                  {new Date(entry.dateEdited).toLocaleString()}
                </span>
                <span className="SongEditForm-history-source">{entry.sourceType}</span>
              </Box>
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );
}
