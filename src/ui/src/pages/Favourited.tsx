import { useState, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useSongs } from '../hooks/useSongs';
import { fetchGenreStats } from '../api/client';
import { useFilters } from '../hooks/useFilters';
import { useSortShuffle } from '../hooks/useSortShuffle';
import { buildEditUrl } from '../utils/urlBuilder';
import FilterBar from '../components/FilterBar';
import { GenreTagCloud } from '../components/GenreTagCloud';
import './GenreDetail.scss';
import SongTable from '../components/SongTable';
import type { TagInfo } from '../types';
import type { SortField, SortDirection } from '../components/SongTable';

export default function Favourited() {
  const location = useLocation();
  const [page, setPage] = useState(1);

  const {
    sortField, sortDirection, shuffleSeed, shuffleMode,
    setSort, toggleShuffle, reshuffle,
  } = useSortShuffle();

  const handleSort = useCallback((field: SortField, direction: SortDirection) => {
    setSort(field, direction);
    setPage(1);
  }, [setSort, setPage]);

  const handleShuffleToggle = useCallback((on: boolean) => {
    toggleShuffle(on);
    setPage(1);
  }, [toggleShuffle, setPage]);

  const {
    filters, addExclude,
    removeExclude, setBpmRange, setSearch,
  } = useFilters();

  const genreNotParam = filters.genreNot.length > 0 ? filters.genreNot.join(',') : undefined;
  const bpmGteParam = filters.bpmGte !== undefined ? String(filters.bpmGte) : undefined;
  const bpmLteParam = filters.bpmLte !== undefined ? String(filters.bpmLte) : undefined;
  const searchParam = filters.search || undefined;

  const extraParams = {
    'favorite': 'starred',
    ...(genreNotParam && { 'genre.not': genreNotParam }),
    ...(bpmGteParam && { 'bpm.gte': bpmGteParam }),
    ...(bpmLteParam && { 'bpm.lte': bpmLteParam }),
    ...(searchParam && { 'search': searchParam }),
    ...(sortField && { sort: sortField }),
    ...(sortDirection && { sortDirection }),
  };

  const { data: paginated, isLoading, error } = useSongs({
    ...extraParams,
    shuffle: shuffleSeed,
    page,
    limit: 50,
  });

  const { data: relatedStats } = useQuery({
    queryKey: ['genreStats', 'favourite', genreNotParam, bpmGteParam, bpmLteParam, searchParam],
    queryFn: () => fetchGenreStats(extraParams),
  });

  const relatedTags: Record<string, TagInfo> = {};
  if (relatedStats) {
    for (const { genre, count } of relatedStats) {
      relatedTags[genre] = { count };
    }
  }

  const songs = paginated?.data ?? [];

  const editHref = buildEditUrl(location.search, 'favourited') + '&favorite=starred';

  return (
    <div className="GenreDetail">
      <FilterBar
        genreNot={filters.genreNot}
        bpmGte={filters.bpmGte}
        bpmLte={filters.bpmLte}
        onRemoveExclude={removeExclude}
        onBpmChange={setBpmRange}
        shuffleActive={shuffleMode}
        onShuffleToggle={handleShuffleToggle}
        onShuffleReseed={reshuffle}
        editHref={editHref}
        favouriteMode="indicator"
        search={filters.search}
        onSearchChange={setSearch}
      />

      {isLoading && <p>Loading songs...</p>}
      {error && <p style={{ color: 'red' }}>Failed to load songs</p>}
      {!isLoading && !error && paginated && (
        <>
          {songs.length > 0 && (
            <SongTable
              songs={songs}
              page={paginated.page}
              totalPages={paginated.totalPages}
              totalCount={paginated.total}
              onPageChange={setPage}
              sortField={sortField}
              sortDirection={sortDirection}
              onSortChange={handleSort}
            />
          )}

          {Object.keys(relatedTags).length > 0 && (
            <GenreTagCloud
              tags={relatedTags}
              onExclude={addExclude}
            />
          )}
        </>
      )}
    </div>
  );
}
