import { useCallback, useMemo, useState } from 'react';
import { Minus, Plus, X } from 'lucide-react';
import { camelotLabel, camelotToMusicalKey, parseKey, keysWithin } from '@cratecaddy-api/musicalKey';
import './FilterPill.scss';

interface KeyFilterProps {
  musicalKey?: string;
  keyTolerance?: number;
  empty?: boolean;
  onChange?: (musicalKey?: string, tolerance?: number, empty?: boolean) => void;
  readOnly?: boolean;
}

const EMPTY_VALUE = 'empty';

const KEY_OPTIONS = [
  ...Array.from({ length: 24 }, (_, index) => ({
    value: camelotLabel(index),
    label: `${camelotToMusicalKey(index)} (${camelotLabel(index)})`,
  })),
  { value: EMPTY_VALUE, label: 'Empty (no key)' },
];

export default function KeyFilter({ musicalKey, keyTolerance, empty, onChange, readOnly }: KeyFilterProps) {
  const [active, setActive] = useState(musicalKey !== undefined || empty === true);
  const [target, setTarget] = useState(empty ? EMPTY_VALUE : (musicalKey ?? '8A'));
  const [tolerance, setTolerance] = useState(keyTolerance ?? 1);

  // Sync with URL-driven props.
  const [prevKey, setPrevKey] = useState(musicalKey);
  const [prevEmpty, setPrevEmpty] = useState(empty);
  if (prevKey !== musicalKey || prevEmpty !== empty) {
    setPrevKey(musicalKey);
    setPrevEmpty(empty);
    if (empty) {
      setTarget(EMPTY_VALUE);
      setActive(true);
    } else if (musicalKey === undefined) {
      setActive(false);
    } else {
      setTarget(musicalKey);
      setActive(true);
    }
  }

  const commit = useCallback(
    (t: string, tol: number) => {
      if (t === EMPTY_VALUE) {
        onChange?.(undefined, undefined, true);
        return;
      }
      onChange?.(t, tol);
    },
    [onChange],
  );

  const adjustTolerance = useCallback(
    (delta: number) => {
      setTolerance((prev) => {
        const next = Math.max(0, Math.min(6, prev + delta));
        if (target !== EMPTY_VALUE) commit(target, next);
        return next;
      });
    },
    [target, commit],
  );

  const clear = useCallback(() => {
    setActive(false);
    onChange?.(undefined, undefined, false);
  }, [onChange]);

  const note = useMemo(() => {
    const idx = KEY_OPTIONS.findIndex((o) => o.value === target);
    return idx >= 0 && idx < 24 ? camelotToMusicalKey(idx) : '';
  }, [target]);

  const rangeLabels = useMemo(() => {
    if (target === EMPTY_VALUE) return null;
    const idx = parseKey(target);
    if (idx === null) return null;
    const allowed = keysWithin(idx, tolerance);
    return {
      min: camelotLabel(allowed[0]),
      max: camelotLabel(allowed[allowed.length - 1]),
    };
  }, [target, tolerance]);

  if (readOnly) {
    if (musicalKey === undefined && !empty) return null;
    return (
      <span className="FilterPill FilterPill--inactive">
        <span className="FilterPill-placeholder">{empty ? 'empty' : `${note} (${target})`}</span>
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

  const isEmpty = target === EMPTY_VALUE;

  return (
    <span className="FilterPill">
      {!isEmpty && (
        <button className="FilterPill-btn" onClick={() => adjustTolerance(-1)} disabled={tolerance <= 0} title="Narrow key range">
          <Minus size={14} />
        </button>
      )}

      {!isEmpty && rangeLabels && <span className="FilterPill-hint FilterPill-hint--min">{rangeLabels.min}</span>}

      <button className="FilterPill-btn FilterPill-btn--clear" onClick={clear} title="Clear key filter">
        <X size={14} />
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

      {!isEmpty && rangeLabels && <span className="FilterPill-hint FilterPill-hint--max">{rangeLabels.max}</span>}

      {!isEmpty && (
        <button className="FilterPill-btn" onClick={() => adjustTolerance(1)} title="Widen key range">
          <Plus size={14} />
        </button>
      )}
    </span>
  );
}
