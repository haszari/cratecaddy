import { useState, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { NavigateFunction } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useSongs } from './useSongs';
import { fetchGenreStats } from '../api/client';
import { useFilters } from './useFilters';
import { useSortShuffle } from './useSortShuffle';
import { withSearch } from '../utils/url';
import { splitCSV, setParam } from '../utils/urlParams';
import type { TagInfo } from '../types';
import type { SortField, SortDirection } from '../components/SongTable';
import type { FilterBarProps } from '../components/FilterBar';
import { buildApiParams, KEY } from '@cratecaddy-api/apiParams';

interface UseSongPageOptions {
  /** Page-specific filter params (artistAny, favorite, genreAny/genreAll from URL path) */
  extraFilterParams?: Record<string, string | undefined>;
  /** How genres are managed: 'search-param' (Artist/Favourited) or 'url-path' (GenreDetail) */
  genreMode: 'search-param' | 'url-path';
  /** Search param key for required genres (search-param mode only) */
  genreParamKey?: string;
  /** Decoded genres from URL path (url-path mode only) */
  decodedGenres?: string[];
  /** OR mode flag (url-path mode only) */
  isOrMode?: boolean;
  /** Navigate function (url-path mode only) */
  navigate?: NavigateFunction;
  /** React Query key for genre stats */
  genreStatsKey: unknown[];
  /** Whether to enable the genre stats query (default true) */
  genreStatsEnabled?: boolean;
  /** Genres to exclude from relatedTags */
  excludedGenres?: string[];
  /** Extra FilterBar props (favouriteMode, doneHref, etc.) */
  filterBarExtras?: Partial<FilterBarProps>;
  /** Pre-computed editHref (page provides this) */
  editHref: string;
}

export function useSongPage({
  extraFilterParams,
  genreMode,
  genreParamKey,
  decodedGenres = [],
  isOrMode = false,
  navigate,
  genreStatsKey,
  genreStatsEnabled = true,
  excludedGenres = [],
  filterBarExtras,
  editHref,
}: UseSongPageOptions) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [page, setPage] = useState(1);

  const {
    sortField, sortDirection, shuffleSeed, shuffleMode,
    setSort, toggleShuffle, reshuffle,
  } = useSortShuffle();

  const {
    filters, addExclude,
    removeExclude, setBpmRange, setRatingRange, setSearch,
  } = useFilters();

  const handleSort = useCallback((field: SortField, direction: SortDirection) => {
    setSort(field, direction);
    setPage(1);
  }, [setSort, setPage]);

  const handleShuffleToggle = useCallback((on: boolean) => {
    toggleShuffle(on);
    setPage(1);
  }, [toggleShuffle, setPage]);

  // Genre management — search-param mode
  const genres = useMemo(() => {
    if (genreMode === 'search-param' && genreParamKey) {
      return splitCSV(searchParams.get(genreParamKey));
    }
    return decodedGenres;
  }, [genreMode, genreParamKey, searchParams, decodedGenres]);

  const genreParam = genres.length > 0 ? genres.join(',') : undefined;

  const handleAddRequired = useCallback(
    (genre: string) => {
      if (genreMode !== 'search-param' || !genreParamKey) return;
      setSearchParams((prev) => {
        const current = splitCSV(prev.get(genreParamKey));
        if (current.includes(genre)) return prev;
        return setParam(prev, genreParamKey, [...current, genre].join(','));
      });
    },
    [genreMode, genreParamKey, setSearchParams],
  );

  const handleRemoveRequired = useCallback(
    (genre: string) => {
      if (genreMode !== 'search-param' || !genreParamKey) return;
      setSearchParams((prev) => {
        const current = splitCSV(prev.get(genreParamKey)).filter((g) => g !== genre);
        return setParam(prev, genreParamKey, current.length > 0 ? current.join(',') : null);
      });
    },
    [genreMode, genreParamKey, setSearchParams],
  );

  // Genre management — url-path mode
  const handleAddInclude = useCallback(
    (genre: string) => {
      if (genreMode !== 'url-path' || !navigate) return;
      const lower = decodedGenres.map((g) => g.toLowerCase());
      if (lower.includes(genre.toLowerCase())) return;
      const sep = isOrMode ? ',' : '+';
      const newPath = `/genre/${decodedGenres.map((g) => encodeURIComponent(g)).join(sep)}${sep}${encodeURIComponent(genre)}`;
      navigate(withSearch(newPath), { replace: false });
    },
    [genreMode, decodedGenres, isOrMode, navigate],
  );

  const handleRemoveInclude = useCallback(
    (genre: string) => {
      if (genreMode !== 'url-path' || !navigate) return;
      const remaining = decodedGenres.filter((g) => g.toLowerCase() !== genre.toLowerCase());
      if (remaining.length === 0) {
        navigate(withSearch('/'), { replace: false });
      } else {
        const sep = isOrMode ? ',' : '+';
        const newPath = `/genre/${remaining.map((g) => encodeURIComponent(g)).join(sep)}`;
        navigate(withSearch(newPath), { replace: false });
      }
    },
    [genreMode, decodedGenres, isOrMode, navigate],
  );

  // Genre filter params for the API query
  const genreApiParams = useMemo(() => {
    if (genreMode === 'search-param' && genreParam && genreParamKey) {
      return { [genreParamKey]: genreParam };
    }
    if (genreMode === 'url-path' && decodedGenres.length > 0) {
      const key = isOrMode ? KEY.genreAny : KEY.genreAll;
      return { [key]: decodedGenres.join(',') };
    }
    return {};
  }, [genreMode, genreParam, genreParamKey, decodedGenres, isOrMode]);

  // Query params
  const extraParams = useMemo(() => ({
    ...extraFilterParams,
    ...genreApiParams,
    ...buildApiParams(filters),
    ...(sortField && { sort: sortField }),
    ...(sortDirection && { sortDirection }),
  }), [extraFilterParams, genreApiParams, filters, sortField, sortDirection]);

  const statsParams = useMemo(() => ({
    ...extraFilterParams,
    ...genreApiParams,
    ...buildApiParams(filters),
  }), [extraFilterParams, genreApiParams, filters]);

  // Songs query
  const { data: paginated, isLoading, error } = useSongs({
    ...extraParams,
    shuffle: shuffleSeed,
    page,
    limit: 50,
  });

  // Genre stats query
  const { data: relatedStats } = useQuery({
    queryKey: genreStatsKey,
    queryFn: () => fetchGenreStats(statsParams),
    enabled: genreStatsEnabled,
  });

  // Related tags
  const relatedTags: Record<string, TagInfo> = useMemo(() => {
    if (!relatedStats) return {};
    const lowerExcluded = new Set(excludedGenres.map((g) => g.toLowerCase()));
    const result: Record<string, TagInfo> = {};
    for (const { genre, count } of relatedStats) {
      if (!lowerExcluded.has(genre.toLowerCase())) {
        result[genre] = { count };
      }
    }
    return result;
  }, [relatedStats, excludedGenres]);

  const hasTag = useCallback(
    (genre: string) => filters.genreNot.includes(genre),
    [filters.genreNot],
  );

  const songs = paginated?.data ?? [];

  // FilterBar props
  const filterBarProps: FilterBarProps = {
    genreNot: filters.genreNot,
    bpmGte: filters.bpmGte,
    bpmLte: filters.bpmLte,
    ratingGte: filters.ratingGte,
    ratingLte: filters.ratingLte,
    onRemoveExclude: removeExclude,
    onBpmChange: setBpmRange,
    onRatingChange: setRatingRange,
    shuffleActive: shuffleMode,
    onShuffleToggle: handleShuffleToggle,
    onShuffleReseed: reshuffle,
    editHref,
    search: filters.search,
    onSearchChange: setSearch,
    ...filterBarExtras,
  };

  return {
    page,
    setPage,
    filters,
    addExclude,
    removeExclude,
    setBpmRange,
    setRatingRange,
    setSearch,
    sortField,
    sortDirection,
    shuffleSeed,
    shuffleMode,
    handleSort,
    handleShuffleToggle,
    reshuffle,
    songs,
    paginated,
    isLoading,
    error,
    relatedTags,
    hasTag,
    genres,
    filterBarProps,
    editHref,
    handleAddRequired,
    handleRemoveRequired,
    handleAddInclude,
    handleRemoveInclude,
  };
}
