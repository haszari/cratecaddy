import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { SortField, SortDirection } from '../components/SongTable';

function generateSeed(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function useSortShuffle() {
  const [searchParams, setSearchParams] = useSearchParams();

  const rawSortField = searchParams.get('sort') as SortField | null;
  const rawSortDirection = searchParams.get('sortDirection') as SortDirection | null;
  const rawShuffle = searchParams.get('shuffle');

  const shuffleSeed: string | undefined =
    rawShuffle && rawShuffle !== 'false' ? rawShuffle : undefined;
  const shuffleMode = shuffleSeed !== undefined;

  const hasSortConflict = shuffleSeed && rawSortField;
  const resolvedSortField: SortField | undefined =
    hasSortConflict ? undefined : (rawSortField ?? undefined);
  const resolvedSortDirection: SortDirection | undefined =
    hasSortConflict ? undefined : (rawSortDirection ?? undefined);

  const sortField: SortField | undefined =
    resolvedSortField ?? (shuffleMode ? undefined : 'rating');
  const sortDirection: SortDirection | undefined =
    resolvedSortDirection ?? (shuffleMode ? undefined : 'desc');

  const setSort = useCallback((field: SortField, direction: SortDirection) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('sort', field);
      next.set('sortDirection', direction);
      next.set('shuffle', 'false');
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const toggleShuffle = useCallback((on: boolean) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (on) {
        const seed = generateSeed();
        next.set('shuffle', seed);
        next.delete('sort');
        next.delete('sortDirection');
      } else {
        next.set('shuffle', 'false');
        next.set('sort', 'rating');
        next.set('sortDirection', 'desc');
      }
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const reshuffle = useCallback(() => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('shuffle', generateSeed());
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const clearSort = useCallback(() => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.delete('sort');
      next.delete('sortDirection');
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  return {
    sortField, sortDirection, shuffleSeed, shuffleMode,
    setSort, toggleShuffle, reshuffle, clearSort,
  };
}
