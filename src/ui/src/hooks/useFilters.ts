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
      setSearchParams((prev) =>
        setParam(prev, KEY.search, value || null),

      );
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
    filters.favoriteActive ||
    filters.search !== '';

  return {
    filters,
    addExclude,
    removeExclude,
    setBpmRange,
    setRatingRange,
    toggleFavorite,
    setSearch,
    clearFilters,
    hasActiveFilters,
  };
}
