import { useState, useCallback } from 'react';

export interface EditModeState {
  active: boolean;
  selectedIndex: number;
}

export function useEditMode() {
  const [state, setState] = useState<EditModeState>({ active: false, selectedIndex: 0 });
  const toggle = useCallback(() => {
    setState((prev) => ({ active: !prev.active, selectedIndex: 0 }));
  }, []);

  const selectNext = useCallback((max: number) => {
    setState((prev) => prev.active ? { ...prev, selectedIndex: Math.min(prev.selectedIndex + 1, max - 1) } : prev);
  }, []);

  const selectPrev = useCallback(() => {
    setState((prev) => prev.active ? { ...prev, selectedIndex: Math.max(prev.selectedIndex - 1, 0) } : prev);
  }, []);

  const selectIndex = useCallback((index: number) => {
    setState((prev) => prev.active ? { ...prev, selectedIndex: index } : prev);
  }, []);

  const exit = useCallback(() => {
    setState({ active: false, selectedIndex: 0 });
  }, []);

  return { ...state, toggle, selectNext, selectPrev, selectIndex, exit };
}
