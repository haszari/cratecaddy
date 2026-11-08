import { useState, useCallback } from 'react';
import { ChevronUp, ChevronDown, Plus, Minus, X } from 'lucide-react';
import './FilterPill.scss';

interface YearRangeControlProps {
  yearGte?: number;
  yearLte?: number;
  empty?: boolean;
  onChange?: (gte?: number, lte?: number, empty?: boolean) => void;
  readOnly?: boolean;
}

function centre(gte?: number, lte?: number): number | undefined {
  if (gte !== undefined && lte !== undefined) return Math.round((gte + lte) / 2);
  return gte ?? lte;
}

function spread(gte?: number, lte?: number): number {
  if (gte !== undefined && lte !== undefined) return Math.floor((lte - gte) / 2);
  return 0;
}

export default function YearRangeControl({ yearGte, yearLte, empty, onChange, readOnly }: YearRangeControlProps) {
  const hasFilter = yearGte !== undefined || yearLte !== undefined || empty;
  const [active, setActive] = useState(hasFilter);
  const [inputBuf, setInputBuf] = useState<string>(empty ? '-1' : hasFilter ? String(centre(yearGte, yearLte) ?? '') : '');
  const [range, setRange] = useState(spread(yearGte, yearLte));

  // Sync with URL-driven props.
  const [prevGte, setPrevGte] = useState(yearGte);
  const [prevLte, setPrevLte] = useState(yearLte);
  const [prevEmpty, setPrevEmpty] = useState(empty);
  if (prevGte !== yearGte || prevLte !== yearLte || prevEmpty !== empty) {
    setPrevGte(yearGte);
    setPrevLte(yearLte);
    setPrevEmpty(empty);
    if (empty) {
      setInputBuf('-1');
      setActive(true);
    } else if (!hasFilter) {
      setInputBuf('');
      setRange(0);
      setActive(false);
    } else {
      setInputBuf(String(centre(yearGte, yearLte) ?? ''));
      setRange(spread(yearGte, yearLte));
      setActive(true);
    }
  }

  const commit = useCallback(
    (c: number | undefined, r: number) => {
      if (!onChange || c === undefined || isNaN(c)) return;
      onChange(Math.max(c - r, 0), c + r);
    },
    [onChange],
  );

  const activateWithDefault = useCallback(() => {
    setActive(true);
    setRange(5);
    setInputBuf('2000');
  }, []);

  const applyCentre = useCallback(
    (text: string) => {
      if (!active && onChange) activateWithDefault();
      setInputBuf(text);
      if (text === '-1') {
        onChange?.(undefined, undefined, true);
        return;
      }
      const c = text === '' ? undefined : parseInt(text, 10);
      if (c !== undefined && !isNaN(c)) commit(c, range);
    },
    [active, onChange, range, commit, activateWithDefault],
  );

  const incCentre = useCallback(() => {
    if (!active && onChange) { activateWithDefault(); return; }
    const cur = inputBuf === '' || inputBuf === '-1' ? 2000 : (parseInt(inputBuf, 10) || 2000);
    const next = Math.min(cur + 1, 2099);
    setInputBuf(String(next));
    commit(next, range);
  }, [active, onChange, inputBuf, range, commit, activateWithDefault]);

  const decCentre = useCallback(() => {
    if (!active && onChange) { activateWithDefault(); return; }
    const cur = inputBuf === '' || inputBuf === '-1' ? 2000 : (parseInt(inputBuf, 10) || 2000);
    const next = Math.max(cur - 1, 1900);
    setInputBuf(String(next));
    commit(next, range);
  }, [active, onChange, inputBuf, range, commit, activateWithDefault]);

  const incRange = useCallback(() => {
    if (!active && onChange) { activateWithDefault(); return; }
    setRange((prev) => {
      const next = prev + 1;
      const c = inputBuf === '' || inputBuf === '-1' ? undefined : parseInt(inputBuf, 10);
      if (c !== undefined && !isNaN(c)) commit(c, next);
      return next;
    });
  }, [active, onChange, inputBuf, commit, activateWithDefault]);

  const decRange = useCallback(() => {
    if (!active && onChange) { activateWithDefault(); return; }
    setRange((prev) => {
      const next = Math.max(prev - 1, 0);
      const c = inputBuf === '' || inputBuf === '-1' ? undefined : parseInt(inputBuf, 10);
      if (c !== undefined && !isNaN(c)) commit(c, next);
      return next;
    });
  }, [active, onChange, inputBuf, commit, activateWithDefault]);

  const clear = useCallback(() => {
    setActive(false);
    setInputBuf('');
    setRange(0);
    onChange?.(undefined, undefined, false);
  }, [onChange]);

  if (readOnly) {
    if (!hasFilter) return null;
    return (
      <span className="FilterPill FilterPill--inactive">
        <span className="FilterPill-placeholder">{empty ? 'empty' : `${yearGte ?? '?'}–${yearLte ?? '?'}`}</span>
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
        onClick={activateWithDefault}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            activateWithDefault();
          }
        }}
      >
        <span className="FilterPill-placeholder">year</span>
      </span>
    );
  }

  return (
    <span className="FilterPill">
      {!showEmpty && (
        <button className="FilterPill-btn" onClick={decRange} disabled={range <= 0} title="Narrow year range">
          <Minus size={14} />
        </button>
      )}

      {!showEmpty && minHint !== undefined && !isNaN(minHint) && (
        <span className="FilterPill-hint FilterPill-hint--min">{minHint}</span>
      )}

      <button className="FilterPill-btn FilterPill-btn--clear" onClick={clear} title="Clear year filter">
        <X size={14} />
      </button>

      <input
        type="number"
        className={showEmpty ? 'FilterPill-input FilterPill-input--empty' : 'FilterPill-input'}
        value={inputBuf}
        onChange={(e) => applyCentre(e.target.value)}
        step={1}
        placeholder="year"
      />

      {!showEmpty && (
        <span className="FilterPill-stepper">
          <button className="FilterPill-stepper-btn" onClick={incCentre} title="Increase year">
            <ChevronUp size={14} />
          </button>
          <button className="FilterPill-stepper-btn" onClick={decCentre} title="Decrease year">
            <ChevronDown size={14} />
          </button>
        </span>
      )}

      {!showEmpty && maxHint !== undefined && !isNaN(maxHint) && (
        <span className="FilterPill-hint FilterPill-hint--max">{maxHint}</span>
      )}

      {!showEmpty && (
        <button className="FilterPill-btn" onClick={incRange} title="Widen year range">
          <Plus size={14} />
        </button>
      )}
    </span>
  );
}
