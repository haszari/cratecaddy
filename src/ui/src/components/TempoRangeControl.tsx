import { useState, useEffect, useCallback } from 'react';
import { useDebouncedValue } from '@mantine/hooks';
import { ChevronUp, ChevronDown, Plus, Minus, X } from 'lucide-react';
import './TempoRangeControl.scss';

interface TempoRangeControlProps {
  bpmGte?: number;
  bpmLte?: number;
  onChange?: (gte?: number, lte?: number) => void;
  readOnly?: boolean;
}

export default function TempoRangeControl({ bpmGte, bpmLte, onChange, readOnly }: TempoRangeControlProps) {
  const hasFilter = bpmGte !== undefined || bpmLte !== undefined;

  const computeCentre = (): number | undefined => {
    if (bpmGte !== undefined && bpmLte !== undefined) {
      return Math.round((bpmGte + bpmLte) / 2);
    }
    return bpmGte ?? bpmLte;
  };

  const computeRange = (): number => {
    if (bpmGte !== undefined && bpmLte !== undefined) {
      return Math.floor((bpmLte - bpmGte) / 2);
    }
    return 0;
  };

  const [active, setActive] = useState(hasFilter);
  const [inputBuf, setInputBuf] = useState(
    hasFilter ? String(computeCentre() ?? '') : '',
  );
  const [range, setRange] = useState(computeRange());
  const [debouncedCentre] = useDebouncedValue(inputBuf, 300);

  const commit = useCallback(
    (centre: number, newRange: number) => {
      if (!onChange) return;
      onChange(Math.max(centre - newRange, 0), centre + newRange);
    },
    [onChange],
  );

  useEffect(() => {
    if (!active || !onChange) return;
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
    const cur = inputBuf === '' ? 120 : (parseInt(inputBuf, 10) || 120);
    setInputBuf(String(Math.min(cur + 1, 999)));
  }, [active, onChange, inputBuf, activateWithDefault]);

  const decCentre = useCallback(() => {
    if (!active && onChange) { activateWithDefault(); return; }
    const cur = inputBuf === '' ? 120 : (parseInt(inputBuf, 10) || 120);
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
    if (onChange) onChange(undefined, undefined);
  }, [onChange]);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!active && onChange) {
        setActive(true);
        setRange(5);
      }
      setInputBuf(e.target.value);
    },
    [active, onChange],
  );

  const handleFocus = useCallback(() => {
    if (!active) {
      setActive(true);
      setRange(5);
    }
  }, [active]);

  const centreNum = inputBuf === '' ? undefined : parseInt(inputBuf, 10);
  const minHint = centreNum !== undefined && !isNaN(centreNum) ? centreNum - range : undefined;
  const maxHint = centreNum !== undefined && !isNaN(centreNum) ? centreNum + range : undefined;

  if (readOnly) {
    if (!hasFilter) return null;
    return (
      <span className="TempoRangeControl TempoRangeControl-readOnly">
        <span className="TempoRangeControl-hint">{bpmGte ?? '?'}</span>
        <span className="TempoRangeControl-centre">{computeCentre() ?? '?'}</span>
        <span className="TempoRangeControl-stepper">
          <span className="TempoRangeControl-stepper-btn TempoRangeControl-stepper-btn--spacer" />
          <span className="TempoRangeControl-stepper-btn TempoRangeControl-stepper-btn--spacer" />
        </span>
        <span className="TempoRangeControl-hint">{bpmLte ?? '?'}</span>
      </span>
    );
  }

  if (!active) {
    return (
      <span
        className="TempoRangeControl TempoRangeControl-inactive"
        onClick={() => { setActive(true); setRange(5); }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && setActive(true)}
      >
        <span className="TempoRangeControl-placeholder">tempo</span>
      </span>
    );
  }

  return (
    <span className="TempoRangeControl">
      <button
        className="TempoRangeControl-btn"
        onClick={decRange}
        disabled={range <= 0}
        title="Narrow range"
      >
        <Minus size={14} />
      </button>

      {minHint !== undefined && !isNaN(minHint) && (
        <span className="TempoRangeControl-hint">{minHint}</span>
      )}

      <span className="TempoRangeControl-stepper">
        <button
          className="TempoRangeControl-stepper-btn"
          onClick={incCentre}
          title="Increase tempo"
        >
          <ChevronUp size={14} />
        </button>
        <button
          className="TempoRangeControl-stepper-btn"
          onClick={decCentre}
          title="Decrease tempo"
        >
          <ChevronDown size={14} />
        </button>
      </span>

      <input
        type="number"
        className="TempoRangeControl-input"
        value={inputBuf}
        onChange={handleInputChange}
        onFocus={handleFocus}
        min={0}
        max={999}
        step={1}
        placeholder="bpm"
      />

      <button
        className="TempoRangeControl-btn TempoRangeControl-btn--clear"
        onClick={clear}
        title="Clear BPM filter"
      >
        <X size={14} />
      </button>

      {maxHint !== undefined && !isNaN(maxHint) && (
        <span className="TempoRangeControl-hint">{maxHint}</span>
      )}

      <button
        className="TempoRangeControl-btn"
        onClick={incRange}
        title="Widen range"
      >
        <Plus size={14} />
      </button>
    </span>
  );
}
