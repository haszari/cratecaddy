import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchGenreStats, fetchSongs } from '../api/client';
import { GenreTagCloud } from '../components/GenreTagCloud';
import { useFilters } from '../hooks/useFilters';
import FilterBar from '../components/FilterBar';
import ShuffleControl from '../components/ShuffleControl';
import SongTable from '../components/SongTable';
import type { TagInfo } from '../types';

export default function Home() {
  const navigate = useNavigate();
  const {
    filters, shuffleMode,
    addExclude,
    removeExclude,
    setBpmRange, toggleShuffle, reshuffle, hasActiveFilters,
  } = useFilters();
  const [page, setPage] = useState(1);

  const genreNotParam = filters.genreNot.length > 0 ? filters.genreNot.join(',') : undefined;
  const bpmGteParam = filters.bpmGte !== undefined ? String(filters.bpmGte) : undefined;
  const bpmLteParam = filters.bpmLte !== undefined ? String(filters.bpmLte) : undefined;
  const shuffleParam = filters.shuffleSeed;

  const extraParams = {
    ...(genreNotParam && { 'genre.not': genreNotParam }),
    ...(bpmGteParam && { 'bpm.gte': bpmGteParam }),
    ...(bpmLteParam && { 'bpm.lte': bpmLteParam }),
  };

  const { data: stats, isLoading, error } = useQuery({
    queryKey: ['genreStats', genreNotParam, bpmGteParam, bpmLteParam],
    queryFn: () => fetchGenreStats(extraParams),
  });

  const { data: paginated } = useQuery({
    queryKey: ['songs', 'filtered', genreNotParam, bpmGteParam, bpmLteParam, shuffleParam, page],
    queryFn: () => fetchSongs({ ...extraParams, shuffle: shuffleParam, page, limit: 50 }),
    enabled: hasActiveFilters,
  });

  const handleAddInclude = useCallback(
    (genre: string) => {
      navigate(`/genre/${encodeURIComponent(genre)}`, { replace: false });
    },
    [navigate],
  );

  const tags: Record<string, TagInfo> = {};
  const main: Record<string, TagInfo> = {};
  const fringe: Record<string, TagInfo> = {};
  if (stats) {
    for (const { genre, count } of stats) {
      tags[genre] = { count };
      if (count > 1) {
        main[genre] = { count };
      } else {
        fringe[genre] = { count };
      }
    }
  }

  const totalSongs = stats ? stats.reduce((sum, s) => sum + s.count, 0) : 0;
  const hasTag = (genre: string) =>
    filters.genreNot.includes(genre);

  return (
    <div className="HomePage">
      <FilterBar
        genreNot={filters.genreNot}
        bpmGte={filters.bpmGte}
        bpmLte={filters.bpmLte}
        onRemoveExclude={removeExclude}
        onBpmChange={setBpmRange}
      />
      {isLoading && <p>Loading genres...</p>}
      {error && <p style={{ color: 'red' }}>Failed to load genres</p>}
      {!isLoading && stats && (
        <>
          <GenreTagCloud
            tags={Object.fromEntries(
              Object.entries(main).filter(([g]) => !hasTag(g))
            )}
            onInclude={handleAddInclude}
            onExclude={addExclude}
          />
          {Object.keys(fringe).length > 0 && (
            <GenreTagCloud
              tags={Object.fromEntries(
                Object.entries(fringe).filter(([g]) => !hasTag(g))
              )}
              onInclude={handleAddInclude}
              onExclude={addExclude}
            />
          )}
        </>
      )}
      {hasActiveFilters && paginated && (
        <>
          <div className="song-table-header">
            <ShuffleControl
              active={shuffleMode}
              onToggle={toggleShuffle}
              onReseed={reshuffle}
            />
          </div>
          <SongTable
            songs={paginated.data}
            page={paginated.page}
            totalPages={paginated.totalPages}
            onPageChange={setPage}
          />
        </>
      )}
      {stats && (
        <div className="page-footer">
          {totalSongs} song{totalSongs !== 1 ? 's' : ''} across {Object.keys(tags).length} genre{Object.keys(tags).length !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}
