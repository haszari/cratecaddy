import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useDebouncedValue } from '@mantine/hooks';
import { TextInput } from '@mantine/core';
import './FilterBar.scss';
import { X, House, Pencil, ArrowLeft, Heart, Search } from 'lucide-react';
import ShuffleControl from './ShuffleControl';
import TempoControl from './TempoControl';

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
  const [searchInput, setSearchInput] = useState(search ?? '');
  const [debouncedSearch] = useDebouncedValue(searchInput, 300);

  useEffect(() => {
    if (onSearchChange) onSearchChange(debouncedSearch);
  }, [debouncedSearch, onSearchChange]);

  const hasBpm = bpmGte !== undefined || bpmLte !== undefined;
  const showSearch = search !== undefined || onSearchChange;
  const showTempo = onBpmChange !== undefined || (readOnly && hasBpm);

  return (
    <div className="FilterBar">
      <div className="FilterBar-navGroup">
        <Link to="/" className="iconButton" title="Home">
          <House size={20} />
        </Link>
        {editHref && (
          <Link to={editHref} className="iconButton" title="Edit metadata">
            <Pencil size={20} />
          </Link>
        )}
        {doneHref && (
          <Link to={doneHref} className="iconButton" title="Done editing">
            <ArrowLeft size={20} />
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
                <X size={14} />
              </span>
            )}
          </span>
        ))}
      </div>

      <div className="FilterBar-filterGroup">
        {(!readOnly || favoriteActive) && (
          <button
            className={`iconButton ${favoriteActive ? 'iconButton--favorite' : ''}`}
            onClick={readOnly ? undefined : onFavoriteToggle}
            title={favoriteActive ? 'Show all songs' : 'Show favorites only'}
          >
            <Heart size={20} fill={favoriteActive ? 'currentColor' : 'none'} />
          </button>
        )}

        {showTempo && (
          <TempoControl
            key={`bpm-${bpmGte ?? ''}-${bpmLte ?? ''}`}
            bpmGte={bpmGte}
            bpmLte={bpmLte}
            onChange={readOnly ? undefined : onBpmChange}
            readOnly={readOnly}
          />
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
              rightSection={searchInput === '' ? <Search size={18} /> : undefined}
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
