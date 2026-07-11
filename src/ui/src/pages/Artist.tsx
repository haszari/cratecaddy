import { useState, useCallback } from 'react';
import { useParams, useSearchParams, useLocation } from 'react-router-dom';
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
import { KEY, buildApiParams } from '@cratecaddy-api/apiParams';
import { splitCSV, setParam } from '../utils/urlParams';

export default function Artist() {
  const { artistName } = useParams<{ artistName: string }>();
  const decodedArtist = artistName ? decodeURIComponent(artistName) : '';
  const [searchParams, setSearchParams] = useSearchParams();
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

  const requiredGenres = splitCSV(searchParams.get(KEY.genreAll));

  const {
    filters, addExclude,
    removeExclude, setBpmRange, setRatingRange, setSearch,
  } = useFilters();

  const requiredGenresParam = requiredGenres.length > 0 ? requiredGenres.join(',') : undefined;

  const extraParams = {
    [KEY.artistAny]: decodedArtist || undefined,
    ...(requiredGenresParam && { [KEY.genreAll]: requiredGenresParam }),
    ...buildApiParams(filters),
    ...(sortField && { sort: sortField }),
    ...(sortDirection && { sortDirection }),
  };

  const { data: paginated, isLoading, error } = useSongs({
    ...extraParams,
    shuffle: shuffleSeed,
    page,
    limit: 50,
  });

  const { data: relateStats } = useQuery({
    queryKey: ['genreStats', decodedArtist, requiredGenresParam, filters],
    queryFn: () => fetchGenreStats(extraParams),
    enabled: !!decodedArtist,
  });

  const relatedTags: Record<string, TagInfo> = {};
  if (relateStats) {
    const lowerRequired = new Set(requiredGenres.map((g) => g.toLowerCase()));
    for (const { genre, count } of relateStats) {
      if (!lowerRequired.has(genre.toLowerCase())) {
        relatedTags[genre] = { count };
      }
    }
  }

  const handleAddRequired = useCallback(
    (genre: string) => {
      setSearchParams((prev) => {
        const current = splitCSV(prev.get(KEY.genreAll));
        if (current.includes(genre)) return prev;
        return setParam(prev, KEY.genreAll, [...current, genre].join(','));
      });
    },
    [setSearchParams],
  );

  const handleRemoveRequired = useCallback(
    (genre: string) => {
      setSearchParams((prev) => {
        const current = splitCSV(prev.get(KEY.genreAll)).filter((g) => g !== genre);
        return setParam(prev, KEY.genreAll, current.length > 0 ? current.join(',') : null);
      });
    },
    [setSearchParams],
  );

  const songs = paginated?.data ?? [];
  const hasTag = (genre: string) => filters.genreNot.includes(genre);

  const editHref = buildEditUrl(
    location.search,
    'artist',
    { artistAny: decodedArtist },
  );

  return (
    <div className="GenreDetail">
      <BasePageCriteria
        artists={[decodedArtist]}
        genres={requiredGenres.map((g) => ({ name: g, mode: 'and' }))}
        onRemoveGenre={handleRemoveRequired}
      />

      <FilterBar
        genreNot={filters.genreNot}
        bpmGte={filters.bpmGte}
        bpmLte={filters.bpmLte}
        ratingGte={filters.ratingGte}
        ratingLte={filters.ratingLte}
        onRemoveExclude={removeExclude}
        onBpmChange={setBpmRange}
        onRatingChange={setRatingRange}
        shuffleActive={shuffleMode}
        onShuffleToggle={handleShuffleToggle}
        onShuffleReseed={reshuffle}
        editHref={editHref}
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
              tags={Object.fromEntries(
                Object.entries(relatedTags).filter(([g]) => !hasTag(g))
              )}
              onInclude={handleAddRequired}
              onExclude={addExclude}
            />
          )}
        </>
      )}
    </div>
  );
}
