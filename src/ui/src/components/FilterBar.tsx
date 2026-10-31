import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useDebouncedValue } from '@mantine/hooks';
import { TextInput } from '@mantine/core';
import './FilterBar.scss';
import { X, House, Pencil, ArrowLeft, Heart, Search, ChevronDown, ChevronUp } from 'lucide-react';
import ShuffleControl from './ShuffleControl';
import TempoRangeControl from './TempoRangeControl';
import StarRatingFilter from './StarRatingFilter';
import KeyFilter from './KeyFilter';
import YearRangeControl from './YearRangeControl';
import OwnershipFilter from './OwnershipFilter';
import { useFilters } from '../hooks/useFilters';
import { useEditLinks } from '../shell/useEditLinks';

export interface FilterBarProps {
  genreNot: string[];
  bpmGte?: number;
  bpmLte?: number;
  bpmEmpty?: boolean;
  ratingGte?: number;
  ratingLte?: number;
  musicalKey?: string;
  keyTolerance?: number;
  keyEmpty?: boolean;
  yearGte?: number;
  yearLte?: number;
  yearEmpty?: boolean;
  ownership?: string;
  onRemoveExclude?: (genre: string) => void;
  onBpmChange?: (gte?: number, lte?: number) => void;
  onRatingChange?: (gte?: number, lte?: number) => void;
  onMusicalKeyChange?: (musicalKey?: string, tolerance?: number) => void;
  onYearChange?: (gte?: number, lte?: number) => void;
  onOwnershipChange?: (value?: string) => void;
  shuffleActive?: boolean;
  onShuffleToggle?: (active: boolean) => void;
  onShuffleReseed?: () => void;
  editHref?: string;
  doneHref?: string;
  readOnly?: boolean;
  favouriteMode?: 'filter' | 'nav' | 'indicator';
  /** Where the filled heart leads to switch favourites off (indicator mode). */
  favouriteHref?: string;
  search?: string;
  onSearchChange?: (val: string) => void;
}

export default function FilterBar({
  genreNot, bpmGte, bpmLte, bpmEmpty, ratingGte, ratingLte,
  musicalKey, keyTolerance, keyEmpty, yearGte, yearLte, yearEmpty, ownership,
  onRemoveExclude, onBpmChange, onRatingChange,
  onMusicalKeyChange, onYearChange, onOwnershipChange,
  shuffleActive, onShuffleToggle, onShuffleReseed,
  editHref, doneHref, readOnly,
  favouriteMode = 'filter', favouriteHref,
  search, onSearchChange,
}: FilterBarProps) {
  const { filters, toggleFavorite } = useFilters();
  const isApiBuild = useEditLinks();
  const [collapsed, setCollapsed] = useState(true);
  const [searchInput, setSearchInput] = useState(search ?? '');
  const [debouncedSearch] = useDebouncedValue(searchInput, 300);
  const [prevSearch, setPrevSearch] = useState(search);

  if (prevSearch !== search) {
    setPrevSearch(search);
    setSearchInput(search ?? '');
  }

  useEffect(() => {
    if (onSearchChange) onSearchChange(debouncedSearch);
  }, [debouncedSearch, onSearchChange]);

  const hasBpm = bpmGte !== undefined || bpmLte !== undefined;
  const hasRating = ratingGte !== undefined || ratingLte !== undefined;
  const showSearch = search !== undefined || onSearchChange;
  const showTempo = onBpmChange !== undefined || (readOnly && hasBpm);
  const showRating = onRatingChange !== undefined || (readOnly && hasRating);
  const showKey = onMusicalKeyChange !== undefined || (readOnly && musicalKey !== undefined);
  const showYear = onYearChange !== undefined || (readOnly && (yearGte !== undefined || yearLte !== undefined));

  const renderHeart = () => {
    if (favouriteMode === 'nav') {
      return (
        <Link to="/favourited" className="iconButton" title="View favourited songs">
          <Heart size={20} fill="none" />
        </Link>
      );
    }
    if (favouriteMode === 'indicator') {
      if (!favouriteHref || readOnly) {
        return (
          <span className="iconButton iconButton--favourite" title="Showing favourited songs">
            <Heart size={20} fill="currentColor" />
          </span>
        );
      }
      return (
        <Link
          to={favouriteHref}
          className="iconButton iconButton--favourite"
          title="Show all songs"
        >
          <Heart size={20} fill="currentColor" />
        </Link>
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
    <div className={`FilterBar${collapsed ? ' FilterBar--collapsed' : ''}`}>
      <button
        className="FilterBar-collapse"
        onClick={() => setCollapsed((c) => !c)}
        title={collapsed ? 'Expand bar' : 'Collapse bar'}
      >
        {collapsed ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
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

      {genreNot.length > 0 && (
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
      )}

      <div className="FilterBar-filterGroup">
        {isApiBuild && (!readOnly || favouriteMode === 'indicator') && renderHeart()}

        {showRating && (
          <StarRatingFilter
            ratingGte={ratingGte}
            ratingLte={ratingLte}
            onChange={readOnly ? undefined : onRatingChange}
            readOnly={readOnly}
          />
        )}

        {showTempo && (
          <TempoRangeControl
            bpmGte={bpmGte}
            bpmLte={bpmLte}
            empty={bpmEmpty}
            onChange={readOnly ? undefined : onBpmChange}
            readOnly={readOnly}
          />
        )}

        {showKey && (
          <KeyFilter
            musicalKey={musicalKey}
            keyTolerance={keyTolerance}
            empty={keyEmpty}
            onChange={readOnly ? undefined : onMusicalKeyChange}
            readOnly={readOnly}
          />
        )}

        {showYear && (
          <YearRangeControl
            yearGte={yearGte}
            yearLte={yearLte}
            empty={yearEmpty}
            onChange={readOnly ? undefined : onYearChange}
            readOnly={readOnly}
          />
        )}

        {isApiBuild && onOwnershipChange && (
          <OwnershipFilter value={ownership} onChange={onOwnershipChange} />
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
