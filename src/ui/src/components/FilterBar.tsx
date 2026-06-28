import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useDebouncedValue } from '@mantine/hooks';
import { ActionIcon, TextInput } from '@mantine/core';
import './FilterBar.scss';
import { X, House, Pencil, ArrowLeft, Heart, Search } from 'lucide-react';
import ShuffleControl from './ShuffleControl';

interface FilterBarProps {
  genreNot: string[];
  bpmGte?: number;
  bpmLte?: number;
  onRemoveExclude?: (genre: string) => void;
  onBpmChange?: (gte?: number, lte?: number) => void;
  shuffleActive?: boolean;
  onShuffleToggle?: (active: boolean) => void;
  onShuffleReseed?: () => void;
  editHref?: string;
  doneHref?: string;
  readOnly?: boolean;
  favoriteActive?: boolean;
  onFavoriteToggle?: () => void;
  search?: string;
  onSearchChange?: (val: string) => void;
}

export default function FilterBar({
  genreNot, bpmGte, bpmLte,
  onRemoveExclude, onBpmChange,
  shuffleActive, onShuffleToggle, onShuffleReseed,
  editHref, doneHref, readOnly,
  favoriteActive, onFavoriteToggle,
  search, onSearchChange,
}: FilterBarProps) {
  const [bpmMinStr, setBpmMinStr] = useState(bpmGte !== undefined ? String(bpmGte) : '');
  const [bpmMaxStr, setBpmMaxStr] = useState(bpmLte !== undefined ? String(bpmLte) : '');
  const [searchInput, setSearchInput] = useState(search ?? '');
  const [debouncedSearch] = useDebouncedValue(searchInput, 300);

  useEffect(() => {
    if (onSearchChange) onSearchChange(debouncedSearch);
  }, [debouncedSearch, onSearchChange]);

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

  const showHeart = favoriteActive !== undefined || onFavoriteToggle;
  const showSearch = search !== undefined || onSearchChange;

  return (
    <div className="FilterBar">
      <div className="FilterBar-navGroup">
        <Link to="/" className="iconButton" title="Home">
          <House size={16} />
        </Link>
        {editHref && (
          <Link to={editHref} className="iconButton" title="Edit metadata">
            <Pencil size={16} />
          </Link>
        )}
        {doneHref && (
          <Link to={doneHref} className="iconButton" title="Done editing">
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
      </div>

      <div className="FilterBar-excludeGroup">
        {genreNot.map((genre) => (
          <span
            key={`ex:${genre}`}
            className="FilterBar-chip FilterBar-chip-exclude"
            onClick={readOnly ? undefined : () => onRemoveExclude?.(genre)}
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

      <div className="FilterBar-filterGroup">
        {showHeart && (
          <span className="FilterBar-heart">
            {readOnly ? (
              <ActionIcon variant={favoriteActive ? 'filled' : 'subtle'} color="red" disabled>
                <Heart size={16} fill={favoriteActive ? 'currentColor' : 'none'} />
              </ActionIcon>
            ) : (
              <ActionIcon
                variant={favoriteActive ? 'filled' : 'subtle'}
                color="red"
                onClick={onFavoriteToggle}
                title={favoriteActive ? 'Show all songs' : 'Show favorites only'}
              >
                <Heart size={16} fill={favoriteActive ? 'currentColor' : 'none'} />
              </ActionIcon>
            )}
          </span>
        )}

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

        {showSearch && (
          readOnly ? (
            search ? (
              <span className="FilterBar-search-static">{search}</span>
            ) : null
          ) : (
            <TextInput
              className="FilterBar-search"
              placeholder=""
              leftSection={<Search size={14} />}
              value={searchInput}
              onChange={(e) => setSearchInput(e.currentTarget.value)}
              size="sm"
            />
          )
        )}
      </div>
    </div>
  );
}
