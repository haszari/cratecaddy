import { Shuffle, Dice5 } from 'lucide-react';

interface ShuffleControlProps {
  active: boolean;
  onToggle: (active: boolean) => void;
  onReseed: () => void;
}

export default function ShuffleControl({ active, onToggle, onReseed }: ShuffleControlProps) {
  return (
    <span className="ShuffleControl">
      <button
        className={`iconButton ShuffleControl-toggle ${active ? 'iconButton--active' : ''}`}
        onClick={() => onToggle(!active)}
        title={active ? 'Shuffle on — click to disable' : 'Shuffle off — click to enable'}
      >
        <Shuffle size={14} />
      </button>
      {active && (
        <button
          className="iconButton ShuffleControl-reseed"
          onClick={onReseed}
          title="New shuffle order"
        >
          <Dice5 size={18} />
        </button>
      )}
    </span>
  );
}
