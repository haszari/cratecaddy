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
 * Owned / streaming / all selector. Two filled icons (cloud = streaming,
 * handbag = owned) overlapped diagonally. Click cycles All → Owned → Cloud.
 * `all` is the implicit default and is not written to the URL.
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
      <Cloud size={18} fill="currentColor" className="OwnershipFilter-cloud" />
      <Handbag size={18} fill="currentColor" className="OwnershipFilter-handbag" />
    </span>
  );
}
