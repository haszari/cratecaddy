import { useState, useEffect, useCallback, useRef } from 'react';
import { useDebouncedValue } from '@mantine/hooks';
import { ChevronUp, ChevronDown, Plus, Minus, X } from 'lucide-react';
import './FilterPill.scss';

interface TempoRangeControlProps {
  bpmGte?: number;
  bpmLte?: number;
  empty?: boolean;
  onChange?: (gte?: number, lte?: number, empty?: boolean) => void;
  readOnly?: boolean;
}

function computeCentre(bpmGte?: number, bpmLte?: number): number | undefined {
  if (bpmGte !== undefined && bpmLte !== undefined) {
    return Math.round((bpmGte + bpmLte) / 2);
  }
  return bpmGte ?? bpmLte;
}

function computeRange(bpmGte?: number, bpmLte?: number): number {
  if (bpmGte !== undefined && bpmLte !== undefined) {
    return Math.floor((bpmLte - bpmGte) / 2);
  }
  return 0;
}

export default function TempoRangeControl({ bpmGte, bpmLte, empty, onChange, readOnly }: TempoRangeControlProps) {
  const hasFilter = bpmGte !== undefined || bpmLte !== undefined || empty;

  const [active, setActive] = useState(hasFilter);
  const [inputBuf, setInputBuf] = useState(
    empty ? '-1' : hasFilter ? String(computeCentre(bpmGte, bpmLte) ?? '') : '',
  );
  const [range, setRange] = useState(computeRange(bpmGte, bpmLte));
  const [debouncedCentre] = useDebouncedValue(inputBuf, 300);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync with URL-driven props (e.g. cleared elsewhere or switched to empty).
  const [prevGte, setPrevGte] = useState(bpmGte);
  const [prevLte, setPrevLte] = useState(bpmLte);
  const [prevEmpty, setPrevEmpty] = useState(empty);
  if (prevGte !== bpmGte || prevLte !== bpmLte || prevEmpty !== empty) {
    setPrevGte(bpmGte);
    setPrevLte(bpmLte);
    setPrevEmpty(empty);
    if (empty) {
      setInputBuf('-1');
      setActive(true);
    } else if (!hasFilter) {
      setInputBuf('');
      setRange(0);
      setActive(false);
    } else {
      const centre = computeCentre(bpmGte, bpmLte);
      setInputBuf(centre !== undefined ? String(centre) : '');
      setRange(computeRange(bpmGte, bpmLte));
      setActive(true);
    }
  }

  useEffect(() => {
    if (active && inputRef.current) inputRef.current.focus();
  }, [active]);

  const commit = useCallback(
    (centre: number, newRange: number) => {
      if (!onChange) return;
      onChange(Math.max(centre - newRange, 0), centre + newRange);
    },
    [onChange],
  );

  useEffect(() => {
    if (!active || !onChange) return;
    if (debouncedCentre === '-1') {
      onChange(undefined, undefined, true);
      return;
    }
    const c = debouncedCentre === '' ? undefined : parseInt(debouncedCentre, 10);
    if (c !== undefined && !isNaN(c)) {
      commit(c, range);
    }
  }, [debouncedCentre, range, active, onChange, commit]);

  const activateWithDefault = useCallback(() => {
    setActive(true);
    setRange(5);
    setInputBuf('120');
  }, []);

  const incCentre = useCallback(() => {
    if (!active && onChange) { activateWithDefault(); return; }
    const cur = inputBuf === '' || inputBuf === '-1' ? 120 : (parseInt(inputBuf, 10) || 120);
    setInputBuf(String(Math.min(cur + 1, 999)));
  }, [active, onChange, inputBuf, activateWithDefault]);

  const decCentre = useCallback(() => {
    if (!active && onChange) { activateWithDefault(); return; }
    const cur = inputBuf === '' || inputBuf === '-1' ? 120 : (parseInt(inputBuf, 10) || 120);
    setInputBuf(String(Math.max(cur - 1, 0)));
  }, [active, onChange, inputBuf, activateWithDefault]);

  const incRange = useCallback(() => {
    if (!active && onChange) { activateWithDefault(); return; }
    setRange((prev) => prev + 1);
  }, [active, onChange, activateWithDefault]);

  const decRange = useCallback(() => {
    if (!active && onChange) { activateWithDefault(); return; }
    setRange((prev) => Math.max(prev - 1, 0));
  }, [active, onChange, activateWithDefault]);

  const clear = useCallback(() => {
    setActive(false);
    setInputBuf('');
    setRange(0);
    if (onChange) onChange(undefined, undefined, false);
  }, [onChange]);

  if (readOnly) {
    if (!hasFilter) return null;
    return (
      <span className="FilterPill FilterPill--inactive">
        <span className="FilterPill-placeholder">{empty ? 'empty' : `${bpmGte ?? '?'}–${bpmLte ?? '?'}`}</span>
      </span>
    );
  }

  const centreNum = inputBuf === '' || inputBuf === '-1' ? undefined : parseInt(inputBuf, 10);
  const minHint = centreNum !== undefined && !isNaN(centreNum) ? centreNum - range : undefined;
  const maxHint = centreNum !== undefined && !isNaN(centreNum) ? centreNum + range : undefined;
  const showEmpty = inputBuf === '-1';

  if (!active) {
    return (
      <span
        className="FilterPill FilterPill--inactive"
        onClick={() => { setActive(true); setRange(5); }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setActive(true);
            setRange(5);
          }
        }}
      >
        <span className="FilterPill-placeholder">tempo</span>
      </span>
    );
  }

  if (showEmpty) {
    return (
      <span className="FilterPill">
        <span className="FilterPill-placeholder">empty</span>
        <button className="FilterPill-btn FilterPill-btn--clear" onClick={clear} title="Clear tempo filter">
          <X size={14} />
        </button>
      </span>
    );
  }

  return (
    <span className="FilterPill">
      <button className="FilterPill-btn" onClick={decRange} disabled={range <= 0} title="Narrow range">
        <Minus size={14} />
      </button>

      {minHint !== undefined && !isNaN(minHint) && (
        <span className="FilterPill-hint FilterPill-hint--min">{minHint}</span>
      )}

      <button className="FilterPill-btn FilterPill-btn--clear" onClick={clear} title="Clear tempo filter">
        <X size={14} />
      </button>

      <input
        ref={inputRef}
        type="number"
        className="FilterPill-input"
        value={inputBuf}
        onChange={(e) => {
          if (!active && onChange) { setActive(true); setRange(5); }
          setInputBuf(e.target.value);
        }}
        step={1}
        placeholder="bpm"
      />

      <span className="FilterPill-stepper">
        <button className="FilterPill-stepper-btn" onClick={incCentre} title="Increase tempo">
          <ChevronUp size={14} />
        </button>
        <button className="FilterPill-stepper-btn" onClick={decCentre} title="Decrease tempo">
          <ChevronDown size={14} />
        </button>
      </span>

      {maxHint !== undefined && !isNaN(maxHint) && (
        <span className="FilterPill-hint FilterPill-hint--max">{maxHint}</span>
      )}

      <button className="FilterPill-btn" onClick={incRange} title="Widen range">
        <Plus size={14} />
      </button>
    </span>
  );
}
