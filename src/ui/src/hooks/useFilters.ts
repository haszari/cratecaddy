import { useCallback, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

export interface FilterState {
  genreNot: string[];
  bpmGte?: number;
  bpmLte?: number;
  shuffleSeed?: string;
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

function generateSeed(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function useFilters() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialized = useRef(false);

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
    shuffleSeed: (() => {
      const v = searchParams.get('shuffle');
      if (v === 'false') return undefined;
      return v || undefined;
    })(),
  };

  useEffect(() => {
    if (!initialized.current && !searchParams.has('shuffle')) {
      const seed = generateSeed();
      setSearchParams(
        (prev) => setParam(prev, 'shuffle', seed),
        { replace: true },
      );
      initialized.current = true;
    }
    initialized.current = true;
  }, [searchParams, setSearchParams]);

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

  const toggleShuffle = useCallback(
    (on: boolean) => {
      setSearchParams((prev) => {
        const current = prev.get('shuffle');
        if (on && (!current || current === 'false')) {
          return setParam(prev, 'shuffle', current === 'false' ? generateSeed() : current || generateSeed());
        }
        if (!on) {
          return setParam(prev, 'shuffle', 'false');
        }
        return prev;
      }, { replace: true });
    },
    [setSearchParams],
  );

  const reshuffle = useCallback(() => {
    setSearchParams((prev) =>
      setParam(prev, 'shuffle', generateSeed()),
      { replace: true },
    );
  }, [setSearchParams]);

  const clearFilters = useCallback(() => {
    setSearchParams((prev) => {
      let next = setParam(prev, 'genre.not', null);
      next = setParam(next, 'bpm.gte', null);
      next = setParam(next, 'bpm.lte', null);
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const hasActiveFilters =
    filters.genreNot.length > 0 ||
    filters.bpmGte !== undefined ||
    filters.bpmLte !== undefined;

  const shuffleMode = filters.shuffleSeed !== undefined;

  return {
    filters,
    shuffleMode,
    addExclude,
    removeExclude,
    setBpmRange,
    toggleShuffle,
    reshuffle,
    clearFilters,
    hasActiveFilters,
  };
}
