import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './FilterBar.scss';
import { X, House } from 'lucide-react';
import ShuffleControl from './ShuffleControl';

interface FilterBarProps {
  genreNot: string[];
  bpmGte?: number;
  bpmLte?: number;
  onRemoveExclude: (genre: string) => void;
  onBpmChange?: (gte?: number, lte?: number) => void;
  shuffleActive?: boolean;
  onShuffleToggle?: (active: boolean) => void;
  onShuffleReseed?: () => void;
}

export default function FilterBar({
  genreNot, bpmGte, bpmLte,
  onRemoveExclude, onBpmChange,
  shuffleActive, onShuffleToggle, onShuffleReseed,
}: FilterBarProps) {
  const navigate = useNavigate();
  const [bpmMinStr, setBpmMinStr] = useState('');
  const [bpmMaxStr, setBpmMaxStr] = useState('');

  useEffect(() => {
    setBpmMinStr(bpmGte !== undefined ? String(bpmGte) : '');
    setBpmMaxStr(bpmLte !== undefined ? String(bpmLte) : '');
  }, [bpmGte, bpmLte]);

  const applyBpm = () => {
    if (!onBpmChange) return;
    const gte = bpmMinStr ? parseFloat(bpmMinStr) : undefined;
    const lte = bpmMaxStr ? parseFloat(bpmMaxStr) : undefined;
    onBpmChange(
      gte !== undefined && !isNaN(gte) ? gte : undefined,
      lte !== undefined && !isNaN(lte) ? lte : undefined,
    );
  };

  const clearBpm = () => {
    setBpmMinStr('');
    setBpmMaxStr('');
    if (onBpmChange) onBpmChange(undefined, undefined);
  };

  const hasBpm = bpmGte !== undefined || bpmLte !== undefined;

  return (
    <div className="FilterBar">
      <div className="FilterBar-section FilterBar-section-left">
        <button className="FilterBar-home iconButton" onClick={() => navigate('/')} title="Home">
          <House size={16} />
        </button>
        {onShuffleToggle && (
          <ShuffleControl
            active={!!shuffleActive}
            onToggle={onShuffleToggle}
            onReseed={onShuffleReseed || (() => {})}
          />
        )}
      </div>

      <div className="FilterBar-section FilterBar-section-center">
        {onBpmChange && (
          <span className="FilterBar-bpm">
            <input
              type="number"
              placeholder="min"
              value={bpmMinStr}
              onChange={(e) => setBpmMinStr(e.target.value)}
              onBlur={applyBpm}
              onKeyDown={(e) => e.key === 'Enter' && applyBpm()}
              min={0} max={999}
              className="FilterBar-bpm-input"
            />
            <span className="FilterBar-bpm-sep">–</span>
            <input
              type="number"
              placeholder="max"
              value={bpmMaxStr}
              onChange={(e) => setBpmMaxStr(e.target.value)}
              onBlur={applyBpm}
              onKeyDown={(e) => e.key === 'Enter' && applyBpm()}
              min={0} max={999}
              className="FilterBar-bpm-input"
            />
            <span className="FilterBar-bpm-label">bpm</span>
            {hasBpm && (
              <button className="FilterBar-bpm-clear" onClick={clearBpm} title="Clear BPM">
                <X size={12} />
              </button>
            )}
          </span>
        )}
      </div>

      <div className="FilterBar-section FilterBar-section-right">
        {genreNot.map((genre) => (
          <span
            key={`ex:${genre}`}
            className="FilterBar-chip FilterBar-chip-exclude"
            onClick={() => onRemoveExclude(genre)}
            title={`Remove ${genre}`}
          >
            {genre}
            <span className="FilterBar-chip-x">
              <X size={12} />
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
