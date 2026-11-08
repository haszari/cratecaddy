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
 * right) and handbag (owned, bottom left) — each rendered as two layers: an
 * orange fill copy behind a grey outline copy, so the fill never interferes
 * with the stroke. Selected icon shows the orange fill; otherwise both are
 * plain grey outlines. Click cycles All → Owned → Cloud.
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
      <Cloud size="1.1em" strokeWidth={1.5} className="OwnershipFilter-cloud OwnershipFilter-cloud-fill" />
      <Cloud size="1.1em" strokeWidth={1.5} className="OwnershipFilter-cloud OwnershipFilter-cloud-outline" />
      <Handbag size="1.1em" strokeWidth={1.5} className="OwnershipFilter-handbag OwnershipFilter-handbag-fill" />
      <Handbag size="1.1em" strokeWidth={1.5} className="OwnershipFilter-handbag OwnershipFilter-handbag-outline" />
    </span>
  );
}
