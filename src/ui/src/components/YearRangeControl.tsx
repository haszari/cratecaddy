import { useCallback, useState } from 'react';
import { ActionIcon, Badge, Group, NumberInput } from '@mantine/core';
import { Minus, Plus, X } from 'lucide-react';

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
  const [centreVal, setCentreVal] = useState<string>(hasFilter ? String(centre(yearGte, yearLte) ?? '') : '');
  const [spreadVal, setSpreadVal] = useState(spread(yearGte, yearLte));

  const commit = useCallback(
    (c: number | undefined, s: number) => {
      if (!onChange || c === undefined || isNaN(c)) return;
      onChange(Math.max(c - s, 0), c + s);
    },
    [onChange],
  );

  const applyCentre = useCallback(
    (value: string | number) => {
      const text = String(value);
      setCentreVal(text);
      const c = text === '' ? undefined : parseInt(text, 10);
      if (c !== undefined && !isNaN(c)) commit(c, spreadVal);
    },
    [commit, spreadVal],
  );

  const adjustSpread = useCallback(
    (delta: number) => {
      setSpreadVal((prev) => {
        const next = Math.max(0, prev + delta);
        const c = centreVal === '' ? undefined : parseInt(centreVal, 10);
        if (c !== undefined && !isNaN(c)) commit(c, next);
        return next;
      });
    },
    [centreVal, commit],
  );

  const clear = useCallback(() => {
    setActive(false);
    setCentreVal('');
    setSpreadVal(0);
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
        onClick={() => {
          setActive(true);
          setSpreadVal(5);
        }}
        style={{ cursor: 'pointer' }}
        title="Filter by year"
      >
        year
      </Badge>
    );
  }

  const cNum = centreVal === '' ? undefined : parseInt(centreVal, 10);
  const min = cNum !== undefined && !isNaN(cNum) ? cNum - spreadVal : undefined;
  const max = cNum !== undefined && !isNaN(cNum) ? cNum + spreadVal : undefined;

  return (
    <Group gap={4} wrap="nowrap">
      <ActionIcon variant="subtle" size="sm" onClick={() => adjustSpread(-1)} title="Narrow year range" disabled={spreadVal <= 0}>
        <Minus size={14} />
      </ActionIcon>
      {min !== undefined && <Badge variant="light">{min}</Badge>}
      <NumberInput
        size="xs"
        w={64}
        value={centreVal}
        onChange={applyCentre}
        min={1900}
        max={2099}
        hideControls
        placeholder="year"
      />
      {max !== undefined && <Badge variant="light">{max}</Badge>}
      <ActionIcon variant="subtle" size="sm" onClick={() => adjustSpread(1)} title="Widen year range">
        <Plus size={14} />
      </ActionIcon>
      <ActionIcon variant="subtle" size="sm" onClick={clear} title="Clear year filter">
        <X size={14} />
      </ActionIcon>
    </Group>
  );
}
