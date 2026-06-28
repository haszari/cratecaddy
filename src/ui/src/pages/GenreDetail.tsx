import { useState, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useSongs } from '../hooks/useSongs';
import { fetchGenreStats } from '../api/client';
import { useFilters } from '../hooks/useFilters';
import { useSortShuffle } from '../hooks/useSortShuffle';
import { buildEditUrl } from '../utils/urlBuilder';
import FilterBar from '../components/FilterBar';
import { GenreTagCloud } from '../components/GenreTagCloud';
import BasePageCriteria from '../components/BasePageCriteria';
import './GenreDetail.scss';
import SongTable from '../components/SongTable';
import type { TagInfo } from '../types';
import type { SortField, SortDirection } from '../components/SongTable';
import { withSearch } from '../utils/url';

export default function GenreDetail() {
  const { genrePath } = useParams<{ genrePath: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const separator = genrePath && genrePath.includes(',') ? ',' : '+';
  const isOrMode = separator === ',';

  const decodedGenres = genrePath
    ? genrePath.split(separator).map(decodeURIComponent).filter(Boolean)
    : [];

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
    removeExclude, setBpmRange, toggleFavorite, setSearch,
  } = useFilters();

  const genreParam = decodedGenres.length > 0 ? decodedGenres.join(',') : undefined;
  const genreNotParam = filters.genreNot.length > 0 ? filters.genreNot.join(',') : undefined;
  const bpmGteParam = filters.bpmGte !== undefined ? String(filters.bpmGte) : undefined;
  const bpmLteParam = filters.bpmLte !== undefined ? String(filters.bpmLte) : undefined;
  const favoriteParam = filters.favoriteActive ? 'true' : undefined;
  const searchParam = filters.search || undefined;

  const extraParams = {
    ...(genreParam && (isOrMode ? { 'genre.any': genreParam } : { 'genre.all': genreParam })),
    ...(genreNotParam && { 'genre.not': genreNotParam }),
    ...(bpmGteParam && { 'bpm.gte': bpmGteParam }),
    ...(bpmLteParam && { 'bpm.lte': bpmLteParam }),
    ...(favoriteParam && { 'favorite': favoriteParam }),
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
    queryKey: ['genreStats', genreParam, isOrMode ? 'any' : 'all', genreNotParam, bpmGteParam, bpmLteParam, favoriteParam, searchParam],
    queryFn: () => fetchGenreStats(extraParams),
    enabled: decodedGenres.length > 0,
  });

  const relatedTags: Record<string, TagInfo> = {};
  if (relatedStats) {
    const lowerAndGenres = new Set(decodedGenres.map((g) => g.toLowerCase()));
    for (const { genre, count } of relatedStats) {
      if (!lowerAndGenres.has(genre.toLowerCase())) {
        relatedTags[genre] = { count };
      }
    }
  }

  const handleAddInclude = useCallback(
    (genre: string) => {
      const lower = decodedGenres.map((g) => g.toLowerCase());
      if (lower.includes(genre.toLowerCase())) return;
      const sep = isOrMode ? ',' : '+';
      const newPath = `/genre/${decodedGenres.map((g) => encodeURIComponent(g)).join(sep)}${sep}${encodeURIComponent(genre)}`;
      navigate(withSearch(newPath), { replace: false });
    },
    [decodedGenres, isOrMode, navigate],
  );

  const handleRemoveInclude = useCallback(
    (genre: string) => {
      const remaining = decodedGenres.filter((g) => g.toLowerCase() !== genre.toLowerCase());
      if (remaining.length === 0) {
        navigate(withSearch('/'), { replace: false });
      } else {
        const sep = isOrMode ? ',' : '+';
        const newPath = `/genre/${remaining.map((g) => encodeURIComponent(g)).join(sep)}`;
        navigate(withSearch(newPath), { replace: false });
      }
    },
    [decodedGenres, isOrMode, navigate],
  );

  const songs = paginated?.data ?? [];

  const editHref = buildEditUrl(
    location.search,
    'genre',
    isOrMode ? { genreAny: decodedGenres.join(',') } : { genreAll: decodedGenres.join(',') },
  );

  return (
    <div className="GenreDetail">
      <BasePageCriteria
        genres={decodedGenres.map((g) => ({ name: g, mode: isOrMode ? 'or' : 'and' }))}
        onRemoveGenre={handleRemoveInclude}
      />

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
        favoriteActive={filters.favoriteActive}
        onFavoriteToggle={toggleFavorite}
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
              onInclude={handleAddInclude}
              onExclude={addExclude}
            />
          )}
        </>
      )}
    </div>
  );
}
