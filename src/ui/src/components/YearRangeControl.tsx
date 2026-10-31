import { useState, useCallback } from 'react';
import { ActionIcon, Badge, Group, NumberInput } from '@mantine/core';
import { ChevronUp, ChevronDown, Plus, Minus, X } from 'lucide-react';

interface YearRangeControlProps {
  yearGte?: number;
  yearLte?: number;
  onChange?: (gte?: number, lte?: number) => void;
  readOnly?: boolean;
}

function centre(gte?: number, lte?: number): number | undefined {
  if (gte !== undefined && lte !== undefined) return Math.round((gte + lte) / 2);
  return gte ?? lte;
}

/** Half-width (spread) around the centre, matching the tempo control. */
function spread(gte?: number, lte?: number): number {
  if (gte !== undefined && lte !== undefined) return Math.floor((lte - gte) / 2);
  return 0;
}

export default function YearRangeControl({ yearGte, yearLte, onChange, readOnly }: YearRangeControlProps) {
  const hasFilter = yearGte !== undefined || yearLte !== undefined;
  const [active, setActive] = useState(hasFilter);
  const [inputBuf, setInputBuf] = useState<string>(hasFilter ? String(centre(yearGte, yearLte) ?? '') : '');
  const [range, setRange] = useState(spread(yearGte, yearLte));

  const commit = useCallback(
    (c: number | undefined, r: number) => {
      if (!onChange || c === undefined || isNaN(c)) return;
      onChange(Math.max(c - r, 0), c + r);
    },
    [onChange],
  );

  const applyCentre = useCallback(
    (value: string | number) => {
      const text = String(value);
      if (!active && onChange) { setActive(true); setRange(5); }
      setInputBuf(text);
      const c = text === '' ? undefined : parseInt(text, 10);
      if (c !== undefined && !isNaN(c)) commit(c, range);
    },
    [active, onChange, range, commit],
  );

  const incCentre = useCallback(() => {
    if (!active && onChange) { setActive(true); setRange(5); return; }
    const cur = inputBuf === '' ? 2000 : (parseInt(inputBuf, 10) || 2000);
    const next = Math.min(cur + 1, 2099);
    setInputBuf(String(next));
    commit(next, range);
  }, [active, onChange, inputBuf, range, commit]);

  const decCentre = useCallback(() => {
    if (!active && onChange) { setActive(true); setRange(5); return; }
    const cur = inputBuf === '' ? 2000 : (parseInt(inputBuf, 10) || 2000);
    const next = Math.max(cur - 1, 1900);
    setInputBuf(String(next));
    commit(next, range);
  }, [active, onChange, inputBuf, range, commit]);

  const incRange = useCallback(() => {
    if (!active && onChange) { setActive(true); setRange(5); return; }
    setRange((prev) => {
      const next = prev + 1;
      const c = inputBuf === '' ? undefined : parseInt(inputBuf, 10);
      if (c !== undefined && !isNaN(c)) commit(c, next);
      return next;
    });
  }, [active, onChange, inputBuf, commit]);

  const decRange = useCallback(() => {
    if (!active && onChange) { setActive(true); setRange(5); return; }
    setRange((prev) => {
      const next = Math.max(prev - 1, 0);
      const c = inputBuf === '' ? undefined : parseInt(inputBuf, 10);
      if (c !== undefined && !isNaN(c)) commit(c, next);
      return next;
    });
  }, [active, onChange, inputBuf, commit]);

  const clear = useCallback(() => {
    setActive(false);
    setInputBuf('');
    setRange(0);
    onChange?.(undefined, undefined);
  }, [onChange]);

  if (readOnly) {
    if (!hasFilter) return null;
    return <Badge variant="light">{yearGte ?? '?'}–{yearLte ?? '?'}</Badge>;
  }

  if (!active) {
    return (
      <Badge
        variant="light"
        onClick={() => { setActive(true); setRange(5); }}
        style={{ cursor: 'pointer' }}
        title="Filter by year"
      >
        year
      </Badge>
    );
  }

  const centreNum = inputBuf === '' ? undefined : parseInt(inputBuf, 10);
  const minHint = centreNum !== undefined && !isNaN(centreNum) ? centreNum - range : undefined;
  const maxHint = centreNum !== undefined && !isNaN(centreNum) ? centreNum + range : undefined;

  return (
    <Group gap={4} wrap="nowrap">
      <ActionIcon variant="subtle" size="sm" onClick={decRange} disabled={range <= 0} title="Narrow year range">
        <Minus size={14} />
      </ActionIcon>
      {minHint !== undefined && <Badge variant="light">{minHint}</Badge>}
      <ActionIcon variant="subtle" size="sm" onClick={clear} title="Clear year filter">
        <X size={14} />
      </ActionIcon>
      <NumberInput
        size="xs"
        w={60}
        value={inputBuf}
        onChange={applyCentre}
        min={1900}
        max={2099}
        hideControls
        placeholder="year"
      />
      <Group gap={0} wrap="nowrap">
        <ActionIcon variant="subtle" size="sm" onClick={incCentre} title="Increase year">
          <ChevronUp size={14} />
        </ActionIcon>
        <ActionIcon variant="subtle" size="sm" onClick={decCentre} title="Decrease year">
          <ChevronDown size={14} />
        </ActionIcon>
      </Group>
      {maxHint !== undefined && <Badge variant="light">{maxHint}</Badge>}
      <ActionIcon variant="subtle" size="sm" onClick={incRange} title="Widen year range">
        <Plus size={14} />
      </ActionIcon>
    </Group>
  );
}
