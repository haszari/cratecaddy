import { useState, useEffect, useCallback, useRef } from 'react';
import { useDebouncedValue } from '@mantine/hooks';
import { ActionIcon, Badge, Group, NumberInput } from '@mantine/core';
import { ChevronUp, ChevronDown, Plus, Minus, X } from 'lucide-react';
import './TempoRangeControl.scss';

interface TempoRangeControlProps {
  bpmGte?: number;
  bpmLte?: number;
  onChange?: (gte?: number, lte?: number) => void;
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

export default function TempoRangeControl({ bpmGte, bpmLte, onChange, readOnly }: TempoRangeControlProps) {
  const hasFilter = bpmGte !== undefined || bpmLte !== undefined;

  const [active, setActive] = useState(hasFilter);
  const [inputBuf, setInputBuf] = useState(
    hasFilter ? String(computeCentre(bpmGte, bpmLte) ?? '') : '',
  );
  const [range, setRange] = useState(computeRange(bpmGte, bpmLte));
  const [debouncedCentre] = useDebouncedValue(inputBuf, 300);
  const inputRef = useRef<HTMLInputElement>(null);
  const [prevBpmGte, setPrevBpmGte] = useState(bpmGte);
  const [prevBpmLte, setPrevBpmLte] = useState(bpmLte);

  if (prevBpmGte !== bpmGte || prevBpmLte !== bpmLte) {
    setPrevBpmGte(bpmGte);
    setPrevBpmLte(bpmLte);
    if (!hasFilter) {
      setInputBuf('');
      setRange(0);
      setActive(false);
    } else {
      const centre = computeCentre(bpmGte, bpmLte);
      setInputBuf(centre !== undefined ? String(centre) : '');
      setRange(computeRange(bpmGte, bpmLte));
    }
  }

  useEffect(() => {
    if (active && inputRef.current) {
      inputRef.current.focus();
    }
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
    (value: string | number) => {
      const text = String(value);
      if (!active && onChange) {
        setActive(true);
        setRange(5);
      }
      setInputBuf(text);
    },
    [active, onChange],
  );

  const centreNum = inputBuf === '' ? undefined : parseInt(inputBuf, 10);
  const minHint = centreNum !== undefined && !isNaN(centreNum) ? centreNum - range : undefined;
  const maxHint = centreNum !== undefined && !isNaN(centreNum) ? centreNum + range : undefined;

  if (readOnly) {
    if (!hasFilter) return null;
    return <Badge variant="light">{bpmGte ?? '?'}–{bpmLte ?? '?'}</Badge>;
  }

  if (!active) {
    return (
      <Badge
        variant="light"
        onClick={() => { setActive(true); setRange(5); }}
        style={{ cursor: 'pointer' }}
        title="Filter by tempo"
      >
        tempo
      </Badge>
    );
  }

  return (
    <Group gap={4} wrap="nowrap">
      <ActionIcon variant="subtle" size="sm" onClick={decRange} disabled={range <= 0} title="Narrow range">
        <Minus size={14} />
      </ActionIcon>
      {minHint !== undefined && <Badge variant="light">{minHint}</Badge>}
      <ActionIcon variant="subtle" size="sm" onClick={clear} title="Clear tempo filter">
        <X size={14} />
      </ActionIcon>
      <NumberInput
        ref={inputRef}
        size="xs"
        w={56}
        value={inputBuf}
        onChange={handleInputChange}
        min={0}
        max={999}
        hideControls
        placeholder="bpm"
      />
      <Group gap={0} wrap="nowrap">
        <ActionIcon variant="subtle" size="sm" onClick={incCentre} title="Increase tempo">
          <ChevronUp size={14} />
        </ActionIcon>
        <ActionIcon variant="subtle" size="sm" onClick={decCentre} title="Decrease tempo">
          <ChevronDown size={14} />
        </ActionIcon>
      </Group>
      {maxHint !== undefined && <Badge variant="light">{maxHint}</Badge>}
      <ActionIcon variant="subtle" size="sm" onClick={incRange} title="Widen range">
        <Plus size={14} />
      </ActionIcon>
    </Group>
  );
}
