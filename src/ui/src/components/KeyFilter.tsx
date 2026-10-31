import { useCallback, useMemo, useState } from 'react';
import { Minus, Plus, X } from 'lucide-react';
import { camelotLabel, camelotToMusicalKey } from '@cratecaddy-api/musicalKey';
import './FilterPill.scss';

interface KeyFilterProps {
  musicalKey?: string;
  keyTolerance?: number;
  onChange?: (key?: string, tolerance?: number) => void;
  readOnly?: boolean;
}

const KEY_OPTIONS = Array.from({ length: 24 }, (_, index) => ({
  value: camelotLabel(index),
  label: `${camelotToMusicalKey(index)} (${camelotLabel(index)})`,
}));

export default function KeyFilter({ musicalKey, keyTolerance, onChange, readOnly }: KeyFilterProps) {
  const hasFilter = musicalKey !== undefined;
  const [active, setActive] = useState(hasFilter);
  const [target, setTarget] = useState(musicalKey ?? '8A');
  const [tolerance, setTolerance] = useState(keyTolerance ?? 1);

  const commit = useCallback(
    (t: string, tol: number) => {
      onChange?.(t, tol);
    },
    [onChange],
  );

  const adjustTolerance = useCallback(
    (delta: number) => {
      setTolerance((prev) => {
        const next = Math.max(0, Math.min(6, prev + delta));
        commit(target, next);
        return next;
      });
    },
    [target, commit],
  );

  const clear = useCallback(() => {
    setActive(false);
    onChange?.(undefined, undefined);
  }, [onChange]);

  const note = useMemo(() => {
    const idx = KEY_OPTIONS.findIndex((o) => o.value === target);
    return idx >= 0 ? camelotToMusicalKey(idx) : '';
  }, [target]);

  if (readOnly) {
    if (!hasFilter) return null;
    return (
      <span className="FilterPill FilterPill--inactive">
        <span className="FilterPill-placeholder">{note} ({target}) ±{tolerance}</span>
      </span>
    );
  }

  if (!active) {
    return (
      <span
        className="FilterPill FilterPill--inactive"
        onClick={() => {
          setActive(true);
          commit(target, tolerance);
        }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setActive(true);
            commit(target, tolerance);
          }
        }}
      >
        <span className="FilterPill-placeholder">key</span>
      </span>
    );
  }

  return (
    <span className="FilterPill">
      <button className="FilterPill-btn" onClick={() => adjustTolerance(-1)} disabled={tolerance <= 0} title="Narrow key range">
        <Minus size={14} />
      </button>

      <select
        className="FilterPill-select"
        value={target}
        onChange={(e) => {
          const v = e.target.value;
          setTarget(v);
          commit(v, tolerance);
        }}
      >
        {KEY_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>

      <button className="FilterPill-btn" onClick={() => adjustTolerance(1)} title="Widen key range">
        <Plus size={14} />
      </button>

      <button className="FilterPill-btn FilterPill-btn--clear" onClick={clear} title="Clear key filter">
        <X size={14} />
      </button>
    </span>
  );
}
