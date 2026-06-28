import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

export interface FilterState {
  genreNot: string[];
  bpmGte?: number;
  bpmLte?: number;
  favoriteActive: boolean;
  search: string;
}

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

export function useFilters() {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters: FilterState = {
    genreNot: splitCSV(searchParams.get('genre.not')),
    bpmGte: (() => {
      const v = searchParams.get('bpm.gte');
      return v ? parseFloat(v) : undefined;
    })(),
    bpmLte: (() => {
      const v = searchParams.get('bpm.lte');
      return v ? parseFloat(v) : undefined;
    })(),
    favoriteActive: searchParams.get('favorite') === 'true',
    search: searchParams.get('search') ?? '',
  };

  const addExclude = useCallback(
    (genre: string) => {
      setSearchParams((prev) => {
        const current = splitCSV(prev.get('genre.not'));
        if (current.includes(genre)) return prev;
        return setParam(prev, 'genre.not', [...current, genre].join(','));
      }, { replace: true });
    },
    [setSearchParams],
  );

  const removeExclude = useCallback(
    (genre: string) => {
      setSearchParams((prev) => {
        const current = splitCSV(prev.get('genre.not')).filter((g) => g !== genre);
        return setParam(prev, 'genre.not', current.length > 0 ? current.join(',') : null);
      }, { replace: true });
    },
    [setSearchParams],
  );

  const setBpmRange = useCallback(
    (gte?: number, lte?: number) => {
      setSearchParams((prev) => {
        let next = setParam(prev, 'bpm.gte', gte !== undefined ? String(gte) : null);
        next = setParam(next, 'bpm.lte', lte !== undefined ? String(lte) : null);
        return next;
      }, { replace: true });
    },
    [setSearchParams],
  );

  const toggleFavorite = useCallback(() => {
    setSearchParams((prev) => {
      const current = prev.get('favorite');
      const next = new URLSearchParams(prev);
      if (current === 'true') {
        next.delete('favorite');
      } else {
        next.set('favorite', 'true');
      }
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const setSearch = useCallback(
    (value: string) => {
      setSearchParams((prev) =>
        setParam(prev, 'search', value || null),
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const clearFilters = useCallback(() => {
    setSearchParams((prev) => {
      let next = setParam(prev, 'genre.not', null);
      next = setParam(next, 'bpm.gte', null);
      next = setParam(next, 'bpm.lte', null);
      next = setParam(next, 'favorite', null);
      next = setParam(next, 'search', null);
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const hasActiveFilters =
    filters.genreNot.length > 0 ||
    filters.bpmGte !== undefined ||
    filters.bpmLte !== undefined ||
    filters.favoriteActive ||
    filters.search !== '';

  return {
    filters,
    addExclude,
    removeExclude,
    setBpmRange,
    toggleFavorite,
    setSearch,
    clearFilters,
    hasActiveFilters,
  };
}
