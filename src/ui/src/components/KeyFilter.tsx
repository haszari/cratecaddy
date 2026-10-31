import { useCallback, useMemo, useState } from 'react';
import { ActionIcon, Badge, Group, Select } from '@mantine/core';
import { Minus, Plus, X } from 'lucide-react';
import { camelotLabel, indexToNote } from '@cratecaddy-api/musicalKey';

interface KeyFilterProps {
  musicalKey?: string;
  keyTolerance?: number;
  onChange?: (key?: string, tolerance?: number) => void;
  readOnly?: boolean;
}

const KEY_OPTIONS = Array.from({ length: 24 }, (_, index) => ({
  value: camelotLabel(index),
  label: `${camelotLabel(index)} — ${indexToNote(index)}`,
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
    return idx >= 0 ? indexToNote(idx) : '';
  }, [target]);

  if (readOnly) {
    if (!hasFilter) return null;
    return <Badge variant="light">{target} ±{tolerance}</Badge>;
  }

  if (!active) {
    return (
      <Badge
        variant="light"
        onClick={() => {
          setActive(true);
          commit(target, tolerance);
        }}
        style={{ cursor: 'pointer' }}
        title="Filter by key"
      >
        key
      </Badge>
    );
  }

  return (
    <Group gap={4} wrap="nowrap">
      <ActionIcon variant="subtle" size="sm" onClick={() => adjustTolerance(-1)} title="Narrow key range" disabled={tolerance <= 0}>
        <Minus size={14} />
      </ActionIcon>
      <Select
        size="xs"
        w={130}
        value={target}
        onChange={(v) => {
          if (v) {
            setTarget(v);
            commit(v, tolerance);
          }
        }}
        data={KEY_OPTIONS}
        searchable
      />
      <Badge variant="light">±{tolerance}</Badge>
      <ActionIcon variant="subtle" size="sm" onClick={() => adjustTolerance(1)} title="Widen key range">
        <Plus size={14} />
      </ActionIcon>
      <ActionIcon variant="subtle" size="sm" onClick={clear} title="Clear key filter">
        <X size={14} />
      </ActionIcon>
      {note && <Badge variant="default" color="gray">{note}</Badge>}
    </Group>
  );
}
