import { useState } from 'react';
import { Link } from 'react-router-dom';
import './FilterBar.scss';
import { X, House, Pencil, ArrowLeft } from 'lucide-react';
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
  editHref?: string;
  doneHref?: string;
  readOnly?: boolean;
  songCount?: number;
  className?: string;
}

export default function FilterBar({
  genreNot, bpmGte, bpmLte,
  onRemoveExclude, onBpmChange,
  shuffleActive, onShuffleToggle, onShuffleReseed,
  editHref, doneHref, readOnly,
  songCount,
}: FilterBarProps) {
  const [bpmMinStr, setBpmMinStr] = useState('');
  const [bpmMaxStr, setBpmMaxStr] = useState('');

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
        <Link to="/" className="FilterBar-home iconButton" title="Home">
          <House size={16} />
        </Link>
        {editHref && (
          <Link to={editHref} className="FilterBar-edit iconButton" title="Edit metadata">
            <Pencil size={16} />
          </Link>
        )}
        {doneHref && (
          <Link to={doneHref} className="FilterBar-done iconButton" title="Done editing">
            <ArrowLeft size={16} />
          </Link>
        )}
        {!readOnly && onShuffleToggle && (
          <ShuffleControl
            active={!!shuffleActive}
            onToggle={onShuffleToggle}
            onReseed={onShuffleReseed || (() => {})}
          />
        )}
        {songCount !== undefined && (
          <span className="FilterBar-count">{songCount} songs</span>
        )}
      </div>

      <div className="FilterBar-section FilterBar-section-center">
        {(onBpmChange || (readOnly && hasBpm)) && (
          <span className="FilterBar-bpm">
            {readOnly ? (
              <span className="FilterBar-bpm-display">
                {bpmGte ?? '?'}–{bpmLte ?? '?'} bpm
              </span>
            ) : (
              <>
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
              </>
            )}
          </span>
        )}
      </div>

      <div className="FilterBar-section FilterBar-section-right">
        {genreNot.map((genre) => (
          <span
            key={`ex:${genre}`}
            className="FilterBar-chip FilterBar-chip-exclude"
            onClick={readOnly ? undefined : () => onRemoveExclude(genre)}
            title={readOnly ? undefined : `Remove ${genre}`}
          >
            {genre}
            {!readOnly && (
              <span className="FilterBar-chip-x">
                <X size={12} />
              </span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}
