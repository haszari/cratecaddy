import { SegmentedControl } from '@mantine/core';

interface OwnershipFilterProps {
  value?: string;
  onChange?: (value?: string) => void;
}

/**
 * Owned / streaming / all selector. `all` is the implicit default and is not
 * written to the URL (no `ownership` param). Hidden in the static build.
 */
export default function OwnershipFilter({ value, onChange }: OwnershipFilterProps) {
  return (
    <SegmentedControl
      size="xs"
      value={value ?? 'all'}
      onChange={(v) => onChange?.(v === 'all' ? undefined : v)}
      data={[
        { label: 'All', value: 'all' },
        { label: 'Owned', value: 'owned' },
        { label: 'Cloud', value: 'streaming' },
      ]}
      aria-label="Ownership"
    />
  );
}
