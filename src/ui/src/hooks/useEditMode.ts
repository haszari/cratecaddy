import { useState, useCallback, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';

export interface EditModeState {
  active: boolean;
  selectedIndex: number;
}

export function useEditMode() {
  const [searchParams, setSearchParams] = useSearchParams();
  const active = searchParams.get('edit') === 'true';

  const [selectedIndex, setSelectedIndex] = useState(0);

  const prevActive = useRef(active);
  useEffect(() => {
    if (active && !prevActive.current) {
      setSelectedIndex(0);
    }
    prevActive.current = active;
  }, [active]);

  const toggle = useCallback(() => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (next.get('edit') === 'true') {
        next.delete('edit');
      } else {
        next.set('edit', 'true');
      }
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const selectNext = useCallback((max: number) => {
    setSelectedIndex((prev) => Math.min(prev + 1, max - 1));
  }, []);

  const selectPrev = useCallback(() => {
    setSelectedIndex((prev) => Math.max(prev - 1, 0));
  }, []);

  const selectIndex = useCallback((index: number) => {
    setSelectedIndex(index);
  }, []);

  const exit = useCallback(() => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('edit');
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  return { active, selectedIndex, toggle, selectNext, selectPrev, selectIndex, exit };
}
