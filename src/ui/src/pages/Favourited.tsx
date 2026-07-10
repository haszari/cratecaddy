import { useState, useCallback } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useSongs } from '../hooks/useSongs';
import { fetchGenreStats } from '../api/client';
import { useFilters } from '../hooks/useFilters';
import { useSortShuffle } from '../hooks/useSortShuffle';
import { buildEditUrl } from '../utils/urlBuilder';
import FilterBar from '../components/FilterBar';
import BasePageCriteria from '../components/BasePageCriteria';
import { GenreTagCloud } from '../components/GenreTagCloud';
import './GenreDetail.scss';
import SongTable from '../components/SongTable';
import type { TagInfo } from '../types';
import type { SortField, SortDirection } from '../components/SongTable';
import { Heart } from 'lucide-react';

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

export default function Favourited() {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
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

  const requiredGenres = splitCSV(searchParams.get('genre.all'));

  const {
    filters, addExclude,
    removeExclude, setBpmRange, setRatingRange, setSearch,
  } = useFilters();

  const requiredGenresParam = requiredGenres.length > 0 ? requiredGenres.join(',') : undefined;
  const genreNotParam = filters.genreNot.length > 0 ? filters.genreNot.join(',') : undefined;
  const bpmGteParam = filters.bpmGte !== undefined ? String(filters.bpmGte) : undefined;
  const bpmLteParam = filters.bpmLte !== undefined ? String(filters.bpmLte) : undefined;
  const ratingGteParam = filters.ratingGte !== undefined ? String(filters.ratingGte) : undefined;
  const ratingLteParam = filters.ratingLte !== undefined ? String(filters.ratingLte) : undefined;
  const searchParam = filters.search || undefined;

  const extraParams = {
    'favorite': 'starred',
    ...(requiredGenresParam && { 'genre.all': requiredGenresParam }),
    ...(genreNotParam && { 'genre.not': genreNotParam }),
    ...(bpmGteParam && { 'bpm.gte': bpmGteParam }),
    ...(bpmLteParam && { 'bpm.lte': bpmLteParam }),
    ...(ratingGteParam && { 'rating.gte': ratingGteParam }),
    ...(ratingLteParam && { 'rating.lte': ratingLteParam }),
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
    queryKey: ['genreStats', 'favourite', requiredGenresParam, genreNotParam, bpmGteParam, bpmLteParam, ratingGteParam, ratingLteParam, searchParam],
    queryFn: () => fetchGenreStats(extraParams),
  });

  const relatedTags: Record<string, TagInfo> = {};
  if (relatedStats) {
    const lowerRequired = new Set(requiredGenres.map((g) => g.toLowerCase()));
    for (const { genre, count } of relatedStats) {
      if (!lowerRequired.has(genre.toLowerCase())) {
        relatedTags[genre] = { count };
      }
    }
  }

  const handleAddRequired = useCallback(
    (genre: string) => {
      setSearchParams((prev) => {
        const current = splitCSV(prev.get('genre.all'));
        if (current.includes(genre)) return prev;
        return setParam(prev, 'genre.all', [...current, genre].join(','));
      });
    },
    [setSearchParams],
  );

  const handleRemoveRequired = useCallback(
    (genre: string) => {
      setSearchParams((prev) => {
        const current = splitCSV(prev.get('genre.all')).filter((g) => g !== genre);
        return setParam(prev, 'genre.all', current.length > 0 ? current.join(',') : null);
      });
    },
    [setSearchParams],
  );

  const songs = paginated?.data ?? [];
  const hasTag = (genre: string) =>
    filters.genreNot.includes(genre) || requiredGenres.includes(genre);

  const editHref = buildEditUrl(location.search, 'favourited') + '&favorite=starred';

  return (
    <div className="GenreDetail">
      <div className="PageCriteria">
        <span className="GenreTag GenreTag-heading PageCriteria-artist">
          <Heart size={28} fill="#e03131" color="#e03131" style={{ verticalAlign: -6 }} />
        </span>
        {requiredGenres.map((g) => (
          <span
            key={g}
            className="genre-pill genre-pill--and"
            onClick={() => handleRemoveRequired(g)}
            title={`Remove ${g}`}
          >
            {g}
          </span>
        ))}
      </div>

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
