import { useState, useEffect, useCallback } from 'react';
import { useDebouncedValue } from '@mantine/hooks';
import { ChevronUp, ChevronDown, Plus, Minus, X } from 'lucide-react';
import './TempoControl.scss';

interface TempoControlProps {
  bpmGte?: number;
  bpmLte?: number;
  onChange?: (gte?: number, lte?: number) => void;
  readOnly?: boolean;
}

export default function TempoControl({ bpmGte, bpmLte, onChange, readOnly }: TempoControlProps) {
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
      <span className="TempoControl TempoControl-readOnly">
        <span className="TempoControl-hint">{bpmGte ?? '?'}</span>
        <span className="TempoControl-centre">{computeCentre() ?? '?'}</span>
        <span className="TempoControl-stepper">
          <span className="TempoControl-stepper-btn TempoControl-stepper-btn--spacer" />
          <span className="TempoControl-stepper-btn TempoControl-stepper-btn--spacer" />
        </span>
        <span className="TempoControl-hint">{bpmLte ?? '?'}</span>
      </span>
    );
  }

  if (!active) {
    return (
      <span
        className="TempoControl TempoControl-inactive"
        onClick={() => { setActive(true); setRange(5); }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && setActive(true)}
      >
        <span className="TempoControl-placeholder">tempo</span>
      </span>
    );
  }

  return (
    <span className="TempoControl">
      <button
        className="TempoControl-btn"
        onClick={decRange}
        disabled={range <= 0}
        title="Narrow range"
      >
        <Minus size={14} />
      </button>

      {minHint !== undefined && !isNaN(minHint) && (
        <span className="TempoControl-hint">{minHint}</span>
      )}

      <button
        className="TempoControl-btn TempoControl-btn--clear"
        onClick={clear}
        title="Clear BPM filter"
      >
        <X size={14} />
      </button>

      <input
        type="number"
        className="TempoControl-input"
        value={inputBuf}
        onChange={handleInputChange}
        onFocus={handleFocus}
        min={0}
        max={999}
        step={1}
        placeholder="bpm"
      />

      <span className="TempoControl-stepper">
        <button
          className="TempoControl-stepper-btn"
          onClick={incCentre}
          title="Increase tempo"
        >
          <ChevronUp size={14} />
        </button>
        <button
          className="TempoControl-stepper-btn"
          onClick={decCentre}
          title="Decrease tempo"
        >
          <ChevronDown size={14} />
        </button>
      </span>

      {maxHint !== undefined && !isNaN(maxHint) && (
        <span className="TempoControl-hint">{maxHint}</span>
      )}

      <button
        className="TempoControl-btn"
        onClick={incRange}
        title="Widen range"
      >
        <Plus size={14} />
      </button>
    </span>
  );
}
