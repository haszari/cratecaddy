import { Cloud, Handbag } from 'lucide-react';
import './OwnershipFilter.scss';

interface OwnershipFilterProps {
  value?: string;
  onChange?: (value?: string) => void;
}

const NEXT: Record<string, 'owned' | 'streaming' | undefined> = {
  all: 'owned',
  owned: 'streaming',
  streaming: undefined,
};

/**
 * Owned / streaming / all selector. Two flat icons — cloud (streaming, top
 * left) and handbag (owned, bottom right) — fixed in place. The selected
 * filter is orange, the other is grey; both grey = all. Click cycles
 * All → Owned → Cloud.
 */
export default function OwnershipFilter({ value, onChange }: OwnershipFilterProps) {
  const state = value === 'owned' || value === 'streaming' ? value : 'all';

  return (
    <span
      className={`OwnershipFilter OwnershipFilter--${state}`}
      onClick={() => onChange?.(NEXT[state])}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onChange?.(NEXT[state]);
        }
      }}
      title={
        state === 'all'
          ? 'All songs'
          : state === 'owned'
            ? 'Owned only'
            : 'Cloud only'
      }
    >
      <Cloud size={16} fill="currentColor" stroke="none" className="OwnershipFilter-cloud" />
      <Handbag size={16} fill="currentColor" stroke="none" className="OwnershipFilter-handbag" />
    </span>
  );
}
