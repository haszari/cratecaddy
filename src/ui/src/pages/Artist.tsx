import { useState, useCallback } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useSongs } from '../hooks/useSongs';
import { fetchGenreStats } from '../api/client';
import { useFilters } from '../hooks/useFilters';
import FilterBar from '../components/FilterBar';
import ShuffleControl from '../components/ShuffleControl';
import { GenreTagCloud } from '../components/GenreTagCloud';
import './GenreDetail.scss';
import SongTable from '../components/SongTable';
import type { TagInfo } from '../types';

function splitCSV(val: string | null): string[] {
  if (!val) return [];
  return val.split(',').map((s) => s.trim()).filter(Boolean);
}

function setParam(
  params: URLSearchParams,
  key: string,
  value: string | null,
): URLSearchParams {
  const next = new URLSearchParams(params);
  if (value === null || value === '') {
    next.delete(key);
  } else {
    next.set(key, value);
  }
  return next;
}

export default function Artist() {
  const { artistName } = useParams<{ artistName: string }>();
  const decodedArtist = artistName ? decodeURIComponent(artistName) : '';
  const [searchParams, setSearchParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const [shuffleMode, setShuffleMode] = useState(true);
  const [shuffleSeed, setShuffleSeed] = useState(() => Math.random().toString(36).slice(2, 10));
  const reshuffle = useCallback(() => setShuffleSeed(Math.random().toString(36).slice(2, 10)), []);

  const genreAll = splitCSV(searchParams.get('genre.all'));

  const {
    filters, addExclude,
    removeExclude, setBpmRange, hasActiveFilters,
  } = useFilters();

  const genreAllParam = genreAll.length > 0 ? genreAll.join(',') : undefined;
  const genreNotParam = filters.genreNot.length > 0 ? filters.genreNot.join(',') : undefined;
  const bpmGteParam = filters.bpmGte !== undefined ? String(filters.bpmGte) : undefined;
  const bpmLteParam = filters.bpmLte !== undefined ? String(filters.bpmLte) : undefined;
  const shuffleParam = shuffleMode ? shuffleSeed : undefined;

  const extraParams = {
    'artist.any': decodedArtist || undefined,
    ...(genreAllParam && { 'genre.all': genreAllParam }),
    ...(genreNotParam && { 'genre.not': genreNotParam }),
    ...(bpmGteParam && { 'bpm.gte': bpmGteParam }),
    ...(bpmLteParam && { 'bpm.lte': bpmLteParam }),
  };

  const { data: paginated, isLoading, error } = useSongs({
    ...extraParams,
    shuffle: shuffleParam,
    page,
    limit: 50,
  });

  const { data: relateStats } = useQuery({
    queryKey: ['genreStats', decodedArtist, genreAllParam, genreNotParam, bpmGteParam, bpmLteParam],
    queryFn: () => fetchGenreStats(extraParams),
    enabled: !!decodedArtist,
  });

  const relatedTags: Record<string, TagInfo> = {};
  if (relateStats) {
    for (const { genre, count } of relateStats) {
      relatedTags[genre] = { count };
    }
  }

  const handleAddInclude = useCallback(
    (genre: string) => {
      setSearchParams((prev) => {
        const current = splitCSV(prev.get('genre.all'));
        if (current.includes(genre)) return prev;
        return setParam(prev, 'genre.all', [...current, genre].join(','));
      }, { replace: true });
    },
    [setSearchParams],
  );

  const handleRemoveInclude = useCallback(
    (genre: string) => {
      setSearchParams((prev) => {
        const current = splitCSV(prev.get('genre.all')).filter((g) => g !== genre);
        return setParam(prev, 'genre.all', current.length > 0 ? current.join(',') : null);
      }, { replace: true });
    },
    [setSearchParams],
  );

  const songs = paginated?.data ?? [];
  const hasTag = (genre: string) =>
    genreAll.includes(genre) || filters.genreNot.includes(genre);

  const activeFilterLabels = [...genreAll, ...filters.genreNot];
  const hasActive = hasActiveFilters || genreAll.length > 0;

  return (
    <div className="GenreDetail">
      <h2 className="GenreTag GenreTag-heading" style={{ fontSize: '2.5em' }}>
        {decodedArtist}
      </h2>

      {genreAll.length > 0 && (
        <div className="and-genre-bar">
          {genreAll.map((genre) => (
            <span
              key={genre}
              className="and-genre-pill"
              onClick={() => handleRemoveInclude(genre)}
              title={`Remove ${genre}`}
            >
              {genre}
            </span>
          ))}
        </div>
      )}

      <FilterBar
        genreNot={filters.genreNot}
        bpmGte={filters.bpmGte}
        bpmLte={filters.bpmLte}
        onRemoveExclude={removeExclude}
        onBpmChange={setBpmRange}
      />

      {isLoading && <p>Loading songs...</p>}
      {error && <p style={{ color: 'red' }}>Failed to load songs</p>}
      {!isLoading && !error && paginated && (
        <>
          {Object.keys(relatedTags).length > 0 && (
            <GenreTagCloud
              tags={Object.fromEntries(
                Object.entries(relatedTags).filter(([g]) => !hasTag(g))
              )}
              onInclude={handleAddInclude}
              onExclude={addExclude}
            />
          )}

          {songs.length > 0 && (
            <>
              <div className="song-table-header">
                <ShuffleControl
                  active={shuffleMode}
                  onToggle={setShuffleMode}
                  onReseed={reshuffle}
                />
              </div>
              <SongTable
                songs={songs}
                page={paginated.page}
                totalPages={paginated.totalPages}
                onPageChange={setPage}
              />
            </>
          )}

          <div className="page-footer">
            {paginated.total} song{paginated.total !== 1 ? 's' : ''}
            {activeFilterLabels.length > 0 && ' (filtered)'}
          </div>
        </>
      )}
    </div>
  );
}
