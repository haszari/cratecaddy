import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useDebouncedValue } from '@mantine/hooks';
import { TextInput } from '@mantine/core';
import './FilterBar.scss';
import { X, House, Pencil, ArrowLeft, Heart, Search } from 'lucide-react';
import ShuffleControl from './ShuffleControl';
import TempoRangeControl from './TempoRangeControl';
import StarRatingFilter from './StarRatingFilter';
import { useFilters } from '../hooks/useFilters';

interface FilterBarProps {
  genreNot: string[];
  bpmGte?: number;
  bpmLte?: number;
  ratingGte?: number;
  ratingLte?: number;
  onRemoveExclude?: (genre: string) => void;
  onBpmChange?: (gte?: number, lte?: number) => void;
  onRatingChange?: (gte?: number, lte?: number) => void;
  shuffleActive?: boolean;
  onShuffleToggle?: (active: boolean) => void;
  onShuffleReseed?: () => void;
  editHref?: string;
  doneHref?: string;
  readOnly?: boolean;
  favouriteMode?: 'filter' | 'nav' | 'indicator';
  search?: string;
  onSearchChange?: (val: string) => void;
}

export default function FilterBar({
  genreNot, bpmGte, bpmLte, ratingGte, ratingLte,
  onRemoveExclude, onBpmChange, onRatingChange,
  shuffleActive, onShuffleToggle, onShuffleReseed,
  editHref, doneHref, readOnly,
  favouriteMode = 'filter',
  search, onSearchChange,
}: FilterBarProps) {
  const { filters, toggleFavorite } = useFilters();
  const [searchInput, setSearchInput] = useState(search ?? '');
  const [debouncedSearch] = useDebouncedValue(searchInput, 300);

  useEffect(() => {
    if (onSearchChange) onSearchChange(debouncedSearch);
  }, [debouncedSearch, onSearchChange]);

  const hasBpm = bpmGte !== undefined || bpmLte !== undefined;
  const hasRating = ratingGte !== undefined || ratingLte !== undefined;
  const showSearch = search !== undefined || onSearchChange;
  const showTempo = onBpmChange !== undefined || (readOnly && hasBpm);
  const showRating = onRatingChange !== undefined || (readOnly && hasRating);

  const renderHeart = () => {
    if (favouriteMode === 'nav') {
      return (
        <Link to="/favourited" className="iconButton" title="View favourited songs">
          <Heart size={20} fill="none" />
        </Link>
      );
    }
    if (favouriteMode === 'indicator') {
      return (
        <span className="iconButton iconButton--favourite" title="Showing favourited songs">
          <Heart size={20} fill="currentColor" />
        </span>
      );
    }
    const active = filters.favoriteActive;
    return (
      <button
        className={`iconButton ${active ? 'iconButton--favourite' : ''}`}
        onClick={readOnly ? undefined : toggleFavorite}
        title={active ? 'Show all songs' : 'Show favourites only'}
      >
        <Heart size={20} fill={active ? 'currentColor' : 'none'} />
      </button>
    );
  };

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
        {(!readOnly || favouriteMode === 'indicator') && renderHeart()}

        {showRating && (
          <StarRatingFilter
            key={`rating-${ratingGte ?? ''}-${ratingLte ?? ''}`}
            ratingGte={ratingGte}
            ratingLte={ratingLte}
            onChange={readOnly ? undefined : onRatingChange}
            readOnly={readOnly}
          />
        )}

        {showTempo && (
          <TempoRangeControl
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
