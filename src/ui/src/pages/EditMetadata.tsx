import { useState, useCallback, useMemo } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import { useSongs } from '../hooks/useSongs';
import { useSortShuffle } from '../hooks/useSortShuffle';
import { buildViewUrl } from '../utils/urlBuilder';
import FilterBar from '../components/FilterBar';
import BasePageCriteria from '../components/BasePageCriteria';
import EditLayout from '../components/EditLayout';
import { KEY, readApiParams } from '@cratecaddy-api/apiParams';

export default function EditMetadata() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const { sortField, sortDirection } = useSortShuffle();

  const filterParams = readApiParams(searchParams);

  const params = {
    ...filterParams,
    sort: sortField,
    sortDirection,
    limit: 500,
    page: 1,
  };

  const { data: paginated, isLoading, isError } = useSongs(params);
  const songs = useMemo(() => paginated?.data ?? [], [paginated]);

  const handleSelect = useCallback((id: string, mode?: 'toggle' | 'range') => {
    setSelectedIds(prev => {
      if (mode === 'toggle') {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        return next;
      }
      if (mode === 'range') {
        const clickedIdx = songs.findIndex(s => s._id === id);
        if (clickedIdx === -1) return new Set([id]);
        if (prev.size === 0) return new Set([id]);
        const indices = Array.from(prev)
          .map(sid => songs.findIndex(s => s._id === sid))
          .filter(i => i !== -1);
        if (indices.length === 0) return new Set([id]);
        const minSelected = Math.min(...indices);
        const maxSelected = Math.max(...indices);
        let rangeMin: number;
        let rangeMax: number;
        if (clickedIdx < minSelected) {
          rangeMin = clickedIdx;
          rangeMax = maxSelected;
        } else if (clickedIdx > maxSelected) {
          rangeMin = minSelected;
          rangeMax = clickedIdx;
        } else {
          rangeMin = minSelected;
          rangeMax = maxSelected;
        }
        return new Set(
          songs.slice(rangeMin, rangeMax + 1)
            .map(s => s._id)
            .filter((sId): sId is string => sId != null),
        );
      }
      return new Set([id]);
    });
  }, [songs]);

  const bpmGte = filterParams[KEY.bpmGte];
  const bpmLte = filterParams[KEY.bpmLte];
  const ratingGte = filterParams[KEY.ratingGte];
  const ratingLte = filterParams[KEY.ratingLte];
  const genreNot = filterParams[KEY.genreNot];
  const search = filterParams[KEY.search];

  const bpmGteNum = bpmGte ? Number(bpmGte) : undefined;
  const bpmLteNum = bpmLte ? Number(bpmLte) : undefined;
  const sanitisedBpmGte = bpmGteNum !== undefined && !isNaN(bpmGteNum) ? bpmGteNum : undefined;
  const sanitisedBpmLte = bpmLteNum !== undefined && !isNaN(bpmLteNum) ? bpmLteNum : undefined;
  const ratingGteNum = ratingGte ? Number(ratingGte) : undefined;
  const ratingLteNum = ratingLte ? Number(ratingLte) : undefined;
  const sanitisedRatingGte = ratingGteNum !== undefined && !isNaN(ratingGteNum) ? ratingGteNum : undefined;
  const sanitisedRatingLte = ratingLteNum !== undefined && !isNaN(ratingLteNum) ? ratingLteNum : undefined;
  const genreNotList = genreNot?.split(',').filter(Boolean) ?? [];

  const doneHref = buildViewUrl(location.search);

  const genres = [
    ...(filterParams[KEY.genreAll] ? filterParams[KEY.genreAll]!.split(',').map((g) => ({ name: g, mode: 'and' as const })) : []),
    ...(filterParams[KEY.genreAny] ? filterParams[KEY.genreAny]!.split(',').map((g) => ({ name: g, mode: 'or' as const })) : []),
  ];
  const artists = filterParams[KEY.artistAny] ? [filterParams[KEY.artistAny]!] : undefined;

  return (
    <div className="EditMetadata">
      <FilterBar
        genreNot={genreNotList}
        bpmGte={sanitisedBpmGte}
        bpmLte={sanitisedBpmLte}
        ratingGte={sanitisedRatingGte}
        ratingLte={sanitisedRatingLte}
        readOnly
        doneHref={doneHref}
        search={search ?? ''}
      />
      <BasePageCriteria
        artists={artists}
        genres={genres.length > 0 ? genres : undefined}
      />
      {isError && <p className="error-message">Failed to load songs</p>}
      {isLoading && <p>Loading songs...</p>}
      {!isLoading && !isError && (
        <EditLayout
          songs={songs}
          selectedIds={selectedIds}
          onSelect={handleSelect}
        />
      )}
      {!isLoading && !isError && (
        <div className="EditMetadata-count">{songs.length} songs</div>
      )}
    </div>
  );
}
