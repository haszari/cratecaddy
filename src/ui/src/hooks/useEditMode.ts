import { useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

export interface EditModeState {
  active: boolean;
  selectedId: string | null;
}

export function useEditMode() {
  const [searchParams, setSearchParams] = useSearchParams();
  const active = searchParams.get('edit') === 'true';

  const [selectedId, setSelectedId] = useState<string | null>(null);

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

  const selectId = useCallback((id: string) => {
    setSelectedId(id);
  }, []);

  const exit = useCallback(() => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('edit');
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  return { active, selectedId, toggle, selectId, exit };
}
