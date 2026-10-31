import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { KEY } from '@cratecaddy-api/apiParams';
import { splitCSV, setParam } from '../utils/urlParams';

export interface FilterState {
  genreNot: string[];
  bpmGte?: number;
  bpmLte?: number;
  ratingGte?: number;
  ratingLte?: number;
  musicalKey?: string;
  keyTolerance?: number;
  yearGte?: number;
  yearLte?: number;
  ownership?: string;
  favoriteActive: boolean;
  search: string;
}

export function useFilters() {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters: FilterState = {
    genreNot: splitCSV(searchParams.get(KEY.genreNot)),
    bpmGte: (() => {
      const v = searchParams.get(KEY.bpmGte);
      return v ? parseFloat(v) : undefined;
    })(),
    bpmLte: (() => {
      const v = searchParams.get(KEY.bpmLte);
      return v ? parseFloat(v) : undefined;
    })(),
    ratingGte: (() => {
      const v = searchParams.get(KEY.ratingGte);
      return v ? parseFloat(v) : undefined;
    })(),
    ratingLte: (() => {
      const v = searchParams.get(KEY.ratingLte);
      return v ? parseFloat(v) : undefined;
    })(),
    musicalKey: searchParams.get(KEY.key) ?? undefined,
    keyTolerance: (() => {
      const v = searchParams.get(KEY.keyTolerance);
      return v ? parseInt(v, 10) : undefined;
    })(),
    yearGte: (() => {
      const v = searchParams.get(KEY.yearGte);
      return v ? parseInt(v, 10) : undefined;
    })(),
    yearLte: (() => {
      const v = searchParams.get(KEY.yearLte);
      return v ? parseInt(v, 10) : undefined;
    })(),
    ownership: searchParams.get(KEY.ownership) ?? undefined,
    favoriteActive: searchParams.get(KEY.favorite) === 'true',
    search: searchParams.get(KEY.search) ?? '',
  };

  const addExclude = useCallback(
    (genre: string) => {
      setSearchParams((prev) => {
        const current = splitCSV(prev.get(KEY.genreNot));
        if (current.includes(genre)) return prev;
        return setParam(prev, KEY.genreNot, [...current, genre].join(','));
      });
    },
    [setSearchParams],
  );

  const removeExclude = useCallback(
    (genre: string) => {
      setSearchParams((prev) => {
        const current = splitCSV(prev.get(KEY.genreNot)).filter((g) => g !== genre);
        return setParam(prev, KEY.genreNot, current.length > 0 ? current.join(',') : null);
      });
    },
    [setSearchParams],
  );

  const setBpmRange = useCallback(
    (gte?: number, lte?: number) => {
      setSearchParams((prev) => {
        let next = setParam(prev, KEY.bpmGte, gte !== undefined ? String(gte) : null);
        next = setParam(next, KEY.bpmLte, lte !== undefined ? String(lte) : null);
        return next;
      });
    },
    [setSearchParams],
  );

  const setRatingRange = useCallback(
    (gte?: number, lte?: number) => {
      setSearchParams((prev) => {
        let next = setParam(prev, KEY.ratingGte, gte !== undefined ? String(gte) : null);
        next = setParam(next, KEY.ratingLte, lte !== undefined ? String(lte) : null);
        return next;
      });
    },
    [setSearchParams],
  );

  const setKeyRange = useCallback(
    (key?: string, tolerance?: number) => {
      setSearchParams((prev) => {
        let next = setParam(prev, KEY.key, key || null);
        next = setParam(next, KEY.keyTolerance, tolerance !== undefined ? String(tolerance) : null);
        return next;
      });
    },
    [setSearchParams],
  );

  const setYearRange = useCallback(
    (gte?: number, lte?: number) => {
      setSearchParams((prev) => {
        let next = setParam(prev, KEY.yearGte, gte !== undefined ? String(gte) : null);
        next = setParam(next, KEY.yearLte, lte !== undefined ? String(lte) : null);
        return next;
      });
    },
    [setSearchParams],
  );

  const setOwnership = useCallback(
    (value?: string) => {
      setSearchParams((prev) => setParam(prev, KEY.ownership, value || null));
    },
    [setSearchParams],
  );

  const toggleFavorite = useCallback(() => {
    setSearchParams((prev) => {
      const current = prev.get(KEY.favorite);
      const next = new URLSearchParams(prev);
      if (current === 'true') {
        next.delete(KEY.favorite);
      } else {
        next.set(KEY.favorite, 'true');
      }
      return next;
    });
  }, [setSearchParams]);

  const setSearch = useCallback(
    (value: string) => {
      setSearchParams((prev) => setParam(prev, KEY.search, value || null));
    },
    [setSearchParams],
  );

  const clearFilters = useCallback(() => {
    setSearchParams((prev) => {
      let next = setParam(prev, KEY.genreNot, null);
      next = setParam(next, KEY.bpmGte, null);
      next = setParam(next, KEY.bpmLte, null);
      next = setParam(next, KEY.ratingGte, null);
      next = setParam(next, KEY.ratingLte, null);
      next = setParam(next, KEY.key, null);
      next = setParam(next, KEY.keyTolerance, null);
      next = setParam(next, KEY.yearGte, null);
      next = setParam(next, KEY.yearLte, null);
      next = setParam(next, KEY.ownership, null);
      next = setParam(next, KEY.favorite, null);
      next = setParam(next, KEY.search, null);
      return next;
    });
  }, [setSearchParams]);

  const hasActiveFilters =
    filters.genreNot.length > 0 ||
    filters.bpmGte !== undefined ||
    filters.bpmLte !== undefined ||
    filters.ratingGte !== undefined ||
    filters.ratingLte !== undefined ||
    filters.musicalKey !== undefined ||
    filters.yearGte !== undefined ||
    filters.yearLte !== undefined ||
    filters.ownership !== undefined ||
    filters.favoriteActive ||
    filters.search !== '';

  return {
    filters,
    addExclude,
    removeExclude,
    setBpmRange,
    setRatingRange,
    setKeyRange,
    setYearRange,
    setOwnership,
    toggleFavorite,
    setSearch,
    clearFilters,
    hasActiveFilters,
  };
}
