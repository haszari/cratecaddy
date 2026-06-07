import { useState, useMemo, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { updateSongsBatch, fetchGenreStats, writeToAppleMusicBatch } from '../api/client';
import { decomposeGenres } from '../hooks/useGenreDecomposition';
import type { Song } from '../types';
import TextField from '@mui/material/TextField';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import { X, Loader2 } from 'lucide-react';
import './MultiSongMetadataEditForm.scss';

const KEY_ROOTS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const STAGE_OPTIONS = ['Warmup', 'Peak', 'Later'];
const SET_OPTIONS = ['Deep', 'BAM', 'Ambient'];
const LISTENING_ROW1 = ['Dance', 'Electronic', 'Jazz', 'Funk', 'Contemporary', 'Classical'];
const LISTENING_ROW2 = ['Reggae', 'Hip Hop', 'Pop', 'Rock', 'Country', 'Indie'];

const KNOWN_TAGS = new Set([
  ...STAGE_OPTIONS, ...SET_OPTIONS, ...LISTENING_ROW1, ...LISTENING_ROW2, 'NZ',
]);

type ScalarField = 'artist' | 'bpm' | 'key' | 'year' | 'rating';

function formatKeyField(root: string, minor: boolean): string {
  if (!root) return '';
  return root + (minor ? 'm' : '');
}

function parseKeyField(value: string): { root: string; minor: boolean } {
  if (!value) return { root: '', minor: false };
  const minor = value.endsWith('m');
  const root = minor ? value.slice(0, -1) : value;
  return { root: KEY_ROOTS.includes(root) ? root : '', minor };
}

function tagInAllSongs(songs: Song[], tag: string, addTags: string[], removeTags: string[]): boolean {
  return songs.every(s => {
    const hasOriginal = s.genres.includes(tag);
    const isAdded = addTags.includes(tag);
    const isRemoved = removeTags.includes(tag);
    return (hasOriginal && !isRemoved) || isAdded;
  });
}

function groupingInAllSongs(songs: Song[], tag: string, addTags: string[], removeTags: string[]): boolean {
  return songs.every(s => {
    const hasOriginal = (s.grouping ?? []).includes(tag);
    const isAdded = addTags.includes(tag);
    const isRemoved = removeTags.includes(tag);
    return (hasOriginal && !isRemoved) || isAdded;
  });
}

interface MultiSongMetadataEditFormProps {
  songs: Song[];
  onDirtyChange?: (dirty: boolean) => void;
}

export default function MultiSongMetadataEditForm({ songs, onDirtyChange }: MultiSongMetadataEditFormProps) {
  const queryClient = useQueryClient();

  const commonInit = useMemo(() => {
    if (songs.length === 0) return { artist: '', bpm: '', year: '', keyRoot: '', keyMinor: false, rating: 0 };
    const f = songs[0];
    const allSame = <T,>(get: (s: Song) => T): T | undefined =>
      songs.every(s => get(s) === get(f)) ? get(f) : undefined;
    const commonKey = parseKeyField(allSame(s => s.key) ?? '');
    return {
      artist: allSame(s => s.artist) ?? '',
      bpm: (() => {
        const v = allSame(s => s.bpm);
        return v != null ? String(v) : '';
      })(),
      year: (() => {
        const v = allSame(s => s.year);
        return v != null ? String(v) : '';
      })(),
      keyRoot: commonKey.root,
      keyMinor: commonKey.minor,
      rating: allSame(s => s.rating) ?? 0,
    };
  }, [songs]);

  const [addGenres, setAddGenres] = useState<string[]>([]);
  const [removeGenres, setRemoveGenres] = useState<string[]>([]);
  const [addGrouping, setAddGrouping] = useState<string[]>([]);
  const [removeGrouping, setRemoveGrouping] = useState<string[]>([]);
  const [artist, setArtist] = useState('');
  const [bpm, setBpm] = useState('');
  const [year, setYear] = useState('');
  const [keyRoot, setKeyRoot] = useState('');
  const [keyMinor, setKeyMinor] = useState(false);
  const [rating, setRating] = useState(0);
  const [dirtyFields, setDirtyFields] = useState<Set<ScalarField>>(new Set());
  const [statusMsg, setStatusMsg] = useState('');
  const [saveIsError, setSaveIsError] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportMsg, setExportMsg] = useState('');
  const [exportIsError, setExportIsError] = useState(false);
  const [hasSavedBefore, setHasSavedBefore] = useState(false);
  const [exportResults, setExportResults] = useState<Map<string, { success: boolean; message: string }>>(new Map());

  const hasChanges = dirtyFields.size > 0
    || addGenres.length > 0 || removeGenres.length > 0
    || addGrouping.length > 0 || removeGrouping.length > 0;

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (dirtyFields.has('key') && !keyRoot) {
        throw new Error('Please select a musical key and minor/major');
      }
      const updates = songs.map(s => {
        const data: Record<string, unknown> = {};
        const effectiveGenres = [...new Set([
          ...s.genres.filter(g => !removeGenres.includes(g)),
          ...addGenres,
        ])];
        if (JSON.stringify(effectiveGenres) !== JSON.stringify(s.genres)) {
          data.genres = effectiveGenres;
        }
        const effectiveGrouping = [...new Set([
          ...(s.grouping ?? []).filter(g => !removeGrouping.includes(g)),
          ...addGrouping,
        ])];
        if (JSON.stringify(effectiveGrouping) !== JSON.stringify(s.grouping ?? [])) {
          data.grouping = effectiveGrouping;
        }
        if (dirtyFields.has('artist')) data.artist = artist;
        if (dirtyFields.has('bpm') && bpm !== '') data.bpm = parseFloat(bpm);
        if (dirtyFields.has('year') && year !== '') data.year = parseInt(year, 10);
        if (dirtyFields.has('key')) data.key = formatKeyField(keyRoot, keyMinor);
        if (dirtyFields.has('rating') && rating > 0) data.rating = rating;
        return { id: s._id!, data };
      });
      const nonEmpty = updates.filter(u => Object.keys(u.data).length > 0);
      if (nonEmpty.length === 0) throw new Error('No changes to save');
      const result = await updateSongsBatch(nonEmpty);
      if (result.errors.length > 0) {
        throw new Error(`${result.errors.length} song(s) failed to update`);
      }
      return result;
    },
    onSuccess: () => {
      onDirtyChange?.(false);
      setHasSavedBefore(true);
      queryClient.invalidateQueries({ queryKey: ['songs'] });
      setStatusMsg(`${songs.length} song${songs.length > 1 ? 's' : ''} updated`);
      setSaveIsError(false);
      setAddGenres([]);
      setRemoveGenres([]);
      setAddGrouping([]);
      setRemoveGrouping([]);
      setDirtyFields(new Set());
      setArtist('');
      setBpm('');
      setYear('');
      setKeyRoot('');
      setKeyMinor(false);
      setRating(0);
    },
    onError: (err) => {
      setStatusMsg(err instanceof Error ? err.message : 'Save failed');
      setSaveIsError(true);
    },
  });

  const allUniqueStyles = useMemo(() => {
    const styleSets = songs.map(s => decomposeGenres(s.genres).styles);
    if (styleSets.length === 0) return [];
    return styleSets.reduce(
      (acc, set) => acc.filter(s => set.includes(s)),
    ).sort();
  }, [songs]);

  const isTagOn = useCallback((tag: string) => {
    return tagInAllSongs(songs, tag, addGenres, removeGenres);
  }, [songs, addGenres, removeGenres]);

  const toggleTag = useCallback((tag: string) => {
    onDirtyChange?.(true);
    const on = tagInAllSongs(songs, tag, addGenres, removeGenres);
    if (on) {
      setRemoveGenres(prev => prev.includes(tag) ? prev : [...prev, tag]);
      setAddGenres(prev => prev.filter(t => t !== tag));
    } else {
      setAddGenres(prev => prev.includes(tag) ? prev : [...prev, tag]);
      setRemoveGenres(prev => prev.filter(t => t !== tag));
    }
  }, [songs, addGenres, removeGenres, onDirtyChange]);

  const isGroupingOn = useCallback((opt: string) => {
    return groupingInAllSongs(songs, opt, addGrouping, removeGrouping);
  }, [songs, addGrouping, removeGrouping]);

  const toggleGrouping = useCallback((opt: string) => {
    onDirtyChange?.(true);
    const on = groupingInAllSongs(songs, opt, addGrouping, removeGrouping);
    if (on) {
      setRemoveGrouping(prev => prev.includes(opt) ? prev : [...prev, opt]);
      setAddGrouping(prev => prev.filter(t => t !== opt));
    } else {
      setAddGrouping(prev => prev.includes(opt) ? prev : [...prev, opt]);
      setRemoveGrouping(prev => prev.filter(t => t !== opt));
    }
  }, [songs, addGrouping, removeGrouping, onDirtyChange]);

  const showListeningSection = groupingInAllSongs(songs, 'Listening', addGrouping, removeGrouping);

  const markDirty = useCallback((field: ScalarField) => {
    onDirtyChange?.(true);
    setDirtyFields(prev => {
      if (prev.has(field)) return prev;
      const next = new Set(prev);
      next.add(field);
      return next;
    });
  }, [onDirtyChange]);

  const handleCancel = useCallback(() => {
    onDirtyChange?.(false);
    setAddGenres([]);
    setRemoveGenres([]);
    setAddGrouping([]);
    setRemoveGrouping([]);
    setArtist('');
    setBpm('');
    setYear('');
    setKeyRoot('');
    setKeyMinor(false);
    setRating(0);
    setDirtyFields(new Set());
    setStatusMsg('');
    setSaveIsError(false);
    setExportMsg('');
    setExportIsError(false);
  }, [onDirtyChange]);

  const handleExportBatch = useCallback(async () => {
    setIsExporting(true);
    onDirtyChange?.(true);
    try {
      const { results } = await writeToAppleMusicBatch(songs.map(s => s._id!));
      setExportResults(prev => {
        const next = new Map(prev);
        for (const r of results) {
          next.set(r.id, { success: r.success, message: r.message });
        }
        return next;
      });
      const errors = results.filter(r => !r.success);
      if (errors.length === 0) {
        setExportMsg(`Written to ${results.length} song${results.length > 1 ? 's' : ''} in Apple Music`);
        setExportIsError(false);
      } else {
        setExportMsg(`${errors.length} song(s) failed: ${errors[0].message}`);
        setExportIsError(true);
      }
    } catch (err) {
      setExportMsg(err instanceof Error ? err.message : 'Write to Apple Music failed');
      setExportIsError(true);
    } finally {
      setIsExporting(false);
      onDirtyChange?.(false);
    }
  }, [songs, onDirtyChange]);

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

  const displayStyles = useMemo(() => {
    const effective = allUniqueStyles.filter(s => !removeGenres.includes(s));
    for (const t of addGenres) {
      if (!KNOWN_TAGS.has(t) && !effective.includes(t)) effective.push(t);
    }
    return effective.sort();
  }, [allUniqueStyles, addGenres, removeGenres]);

  const displayArtist = dirtyFields.has('artist') ? artist : commonInit.artist;
  const displayBpm = dirtyFields.has('bpm') ? bpm : commonInit.bpm;
  const displayYear = dirtyFields.has('year') ? year : commonInit.year;
  const displayKeyRoot = dirtyFields.has('key') ? keyRoot : commonInit.keyRoot;
  const displayKeyMinor = dirtyFields.has('key') ? keyMinor : commonInit.keyMinor;
  const displayRating = dirtyFields.has('rating') ? rating : commonInit.rating;

  const statusMode: 'idle' | 'saving' | 'exporting' | 'save-result' | 'export-result' = (() => {
    if (isExporting) return 'exporting';
    if (saveMutation.isPending) return 'saving';
    if (statusMsg) return 'save-result';
    if (exportMsg) return 'export-result';
    return 'idle';
  })();

  const statusText = statusMode === 'exporting'
    ? 'Writing to Apple Music…'
    : statusMode === 'saving'
      ? 'Saving changes…'
      : statusMode === 'save-result'
        ? statusMsg
        : statusMode === 'export-result'
          ? exportMsg
          : '';

  const statusIsError = (statusMode === 'save-result' && saveIsError)
    || (statusMode === 'export-result' && exportIsError);

  const statusSpinner = statusMode === 'saving' || statusMode === 'exporting';

  return (
    <Box className="MultiSongMetadataEditForm">
      <div className="MultiSongMetadataEditForm-header">
        Editing {songs.length} song{songs.length > 1 ? 's' : ''}
      </div>

      <Box className="MultiSongMetadataEditForm-row">
        <Box className="MultiSongMetadataEditForm-field">
          <span className="MultiSongMetadataEditForm-field-label">artist</span>
          <TextField
            value={displayArtist}
            onChange={(e) => {
              setArtist(e.target.value);
              markDirty('artist');
            }}
            size="small"
            fullWidth
            placeholder={!commonInit.artist ? '-' : undefined}
          />
        </Box>
        <Box className="MultiSongMetadataEditForm-field MultiSongMetadataEditForm-field--no-label">
          <Box className="MultiSongMetadataEditForm-rating">
            {[1, 2, 3, 4, 5].map((n) => (
              <Box
                key={n}
                component="span"
                className={`MultiSongMetadataEditForm-star ${displayRating >= n ? 'MultiSongMetadataEditForm-star--on' : ''}`}
                onClick={() => {
                  setRating(n);
                  markDirty('rating');
                }}
              >
                {displayRating >= n ? '\u2605' : '\u2606'}
              </Box>
            ))}
          </Box>
        </Box>
      </Box>

      <Box className="MultiSongMetadataEditForm-row">
        <Box className="MultiSongMetadataEditForm-field">
          <span className="MultiSongMetadataEditForm-field-label">grouping</span>
          <span className="MultiSongMetadataEditForm-composite-pill">
            {['DJing', 'Listening'].map((opt) => (
              <span
                key={opt}
                className={`MultiSongMetadataEditForm-composite-segment ${isGroupingOn(opt) ? 'MultiSongMetadataEditForm-composite-segment--on' : ''}`}
                onClick={() => toggleGrouping(opt)}
              >
                {opt}
              </span>
            ))}
          </span>
        </Box>
        <Box className="MultiSongMetadataEditForm-field">
          <span className="MultiSongMetadataEditForm-field-label">bpm</span>
          <TextField
            type="number"
            value={displayBpm}
            onChange={(e) => {
              setBpm(e.target.value);
              markDirty('bpm');
            }}
            size="small"
            slotProps={{ htmlInput: { min: 0, max: 999, step: 1 } }}
            placeholder={!commonInit.bpm ? '---' : undefined}
          />
        </Box>
        <Box className="MultiSongMetadataEditForm-field">
          <span className="MultiSongMetadataEditForm-field-label">key</span>
          <Box className="MultiSongMetadataEditForm-key-row">
            <select
              value={displayKeyRoot}
              onChange={(e) => {
                setKeyRoot(e.target.value);
                markDirty('key');
              }}
              className="MultiSongMetadataEditForm-key-select"
            >
              <option value="">—</option>
              {KEY_ROOTS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <span
              className={`MultiSongMetadataEditForm-pill MultiSongMetadataEditForm-pill--sm ${displayKeyMinor ? 'MultiSongMetadataEditForm-pill--on' : ''}`}
              onClick={() => {
                setKeyMinor(prev => !prev);
                markDirty('key');
              }}
            >
              {displayKeyRoot ? 'm' : '-'}
            </span>
          </Box>
        </Box>
        <Box className="MultiSongMetadataEditForm-field">
          <span className="MultiSongMetadataEditForm-field-label">year</span>
          <TextField
            type="number"
            value={displayYear}
            onChange={(e) => {
              setYear(e.target.value);
              markDirty('year');
            }}
            size="small"
            slotProps={{ htmlInput: { min: 1900, max: 2099, step: 1 } }}
            placeholder={!commonInit.year ? '----' : undefined}
          />
        </Box>
      </Box>

      <Box className="MultiSongMetadataEditForm-row">
        <Box className="MultiSongMetadataEditForm-field">
          <span className="MultiSongMetadataEditForm-field-label">set</span>
          <span className="MultiSongMetadataEditForm-composite-pill">
            {SET_OPTIONS.map((opt) => (
              <span
                key={opt}
                className={`MultiSongMetadataEditForm-composite-segment ${isTagOn(opt) ? 'MultiSongMetadataEditForm-composite-segment--on' : ''}`}
                onClick={() => toggleTag(opt)}
              >
                {opt}
              </span>
            ))}
          </span>
        </Box>
        <Box className="MultiSongMetadataEditForm-field">
          <span className="MultiSongMetadataEditForm-field-label">stage</span>
          <span className="MultiSongMetadataEditForm-composite-pill">
            {STAGE_OPTIONS.map((opt) => (
              <span
                key={opt}
                className={`MultiSongMetadataEditForm-composite-segment ${isTagOn(opt) ? 'MultiSongMetadataEditForm-composite-segment--on' : ''}`}
                onClick={() => toggleTag(opt)}
              >
                {opt}
              </span>
            ))}
          </span>
        </Box>
        <Box className="MultiSongMetadataEditForm-field MultiSongMetadataEditForm-field--nz MultiSongMetadataEditForm-field--no-label">
          <span
            className={`MultiSongMetadataEditForm-pill MultiSongMetadataEditForm-pill--nz ${isTagOn('NZ') ? 'MultiSongMetadataEditForm-pill--on' : ''}`}
            onClick={() => toggleTag('NZ')}
          >
            NZ
          </span>
        </Box>
      </Box>

      <Box className="MultiSongMetadataEditForm-row">
        <Box className="MultiSongMetadataEditForm-field MultiSongMetadataEditForm-field--styles">
          <span className="MultiSongMetadataEditForm-field-label">styles</span>
          {displayStyles.length > 0 && (
            <span className="MultiSongMetadataEditForm-styles-pills">
              {displayStyles.map((opt) => (
                <span
                  key={opt}
                  className="MultiSongMetadataEditForm-pill MultiSongMetadataEditForm-pill--on MultiSongMetadataEditForm-pill--removable"
                  onClick={() => {
                    onDirtyChange?.(true);
                    setRemoveGenres(prev => prev.includes(opt) ? prev : [...prev, opt]);
                    setAddGenres(prev => prev.filter(t => t !== opt));
                  }}
                >
                  <X size={18} />{opt}
                </span>
              ))}
            </span>
          )}
          <Autocomplete
            multiple
            freeSolo
            options={allStyleSuggestions}
            value={addGenres.filter(t => !KNOWN_TAGS.has(t))}
            onChange={(_, newVal) => {
              onDirtyChange?.(true);
              const added = newVal.filter((v: string) => !addGenres.includes(v) && !KNOWN_TAGS.has(v));
              if (added.length > 0) {
                setAddGenres(prev => [...new Set([...prev, ...added])]);
              }
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
                  onDirtyChange?.(true);
                  const items = [...new Set(
                    text.split(',').map(s => s.trim()).filter(Boolean),
                  )];
                  setAddGenres(prev => [...new Set([...prev, ...items])]);
                }}
              />
            )}
            fullWidth
          />
        </Box>
      </Box>

      {showListeningSection && (
        <>
          <Box className="MultiSongMetadataEditForm-row">
            <Box className="MultiSongMetadataEditForm-field">
              <span className="MultiSongMetadataEditForm-field-label">listening</span>
              <span className="MultiSongMetadataEditForm-pill-group">
                {LISTENING_ROW1.map((opt) => (
                  <span
                    key={opt}
                    className={`MultiSongMetadataEditForm-pill ${isTagOn(opt) ? 'MultiSongMetadataEditForm-pill--on' : ''}`}
                    onClick={() => toggleTag(opt)}
                  >
                    {opt}
                  </span>
                ))}
              </span>
            </Box>
          </Box>
          <Box className="MultiSongMetadataEditForm-row MultiSongMetadataEditForm-row--tight">
            <Box className="MultiSongMetadataEditForm-field">
              <span className="MultiSongMetadataEditForm-pill-group">
                {LISTENING_ROW2.map((opt) => (
                  <span
                    key={opt}
                    className={`MultiSongMetadataEditForm-pill ${isTagOn(opt) ? 'MultiSongMetadataEditForm-pill--on' : ''}`}
                    onClick={() => toggleTag(opt)}
                  >
                    {opt}
                  </span>
                ))}
              </span>
            </Box>
          </Box>
        </>
      )}

      <Box className="MultiSongMetadataEditForm-actions">
        <button
          className="MultiSongMetadataEditForm-save"
          disabled={!hasChanges || saveMutation.isPending || isExporting}
          onClick={() => saveMutation.mutate()}
        >
          {saveMutation.isPending ? (
            <><Loader2 className="MultiSongMetadataEditForm-spinner" size={14} /> Saving…</>
          ) : (
            'Save Changes'
          )}
        </button>
        <button
          className="MultiSongMetadataEditForm-cancel"
          disabled={!hasChanges || saveMutation.isPending || isExporting}
          onClick={handleCancel}
        >
          Cancel
        </button>
        <span className="MultiSongMetadataEditForm-actions-gap" />
        <button
          className="MultiSongMetadataEditForm-export"
          disabled={!hasSavedBefore || hasChanges || saveMutation.isPending || isExporting}
          onClick={handleExportBatch}
        >
          {isExporting ? (
            <><Loader2 className="MultiSongMetadataEditForm-spinner" size={14} /> Writing…</>
          ) : (
            'Save to Apple Music'
          )}
        </button>
        <span className={`MultiSongMetadataEditForm-status${
          statusSpinner
            ? ' MultiSongMetadataEditForm-status--visible'
            : statusMode === 'save-result' || statusMode === 'export-result'
              ? ` MultiSongMetadataEditForm-status--result${statusIsError ? ' MultiSongMetadataEditForm-status--error' : ''}`
              : ''
        }`}>
          {statusSpinner && <Loader2 className="MultiSongMetadataEditForm-spinner" size={14} />}
          {statusText}
        </span>
      </Box>

      <Box className="MultiSongMetadataEditForm-song-list">
        {songs.map(s => (
          <div key={s._id} className="MultiSongMetadataEditForm-song-item">
            {s._id && exportResults.has(s._id) ? (
              <span
                className={`MultiSongMetadataEditForm-song-export-status--${exportResults.get(s._id)!.success ? 'success' : 'error'}`}
                title={exportResults.get(s._id)!.message}
              >
                {exportResults.get(s._id)!.success ? '\u2713' : '\u2717'}
              </span>
            ) : null}
            {s.artist} — {s.title}
          </div>
        ))}
      </Box>
    </Box>
  );
}
