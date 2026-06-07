import { useState } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import { useSongs } from '../hooks/useSongs';
import { useSortShuffle } from '../hooks/useSortShuffle';
import { buildViewUrl } from '../utils/urlBuilder';
import FilterBar from '../components/FilterBar';
import EditLayout from '../components/EditLayout';

export default function EditMetadata() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { sortField, sortDirection } = useSortShuffle({
    defaultSortField: 'artist',
    defaultSortDirection: 'asc',
  });

  const genreAll = searchParams.get('genre.all');
  const genreAny = searchParams.get('genre.any');
  const artistAny = searchParams.get('artist.any');
  const genreNot = searchParams.get('genre.not');
  const bpmGte = searchParams.get('bpm.gte');
  const bpmLte = searchParams.get('bpm.lte');

  const params = {
    ...(genreAll && { 'genre.all': genreAll }),
    ...(genreAny && { 'genre.any': genreAny }),
    ...(artistAny && { 'artist.any': artistAny }),
    ...(genreNot && { 'genre.not': genreNot }),
    ...(bpmGte && { 'bpm.gte': bpmGte }),
    ...(bpmLte && { 'bpm.lte': bpmLte }),
    sort: sortField ?? 'artist',
    sortDirection: sortDirection ?? 'asc',
    limit: 500,
    page: 1,
  };

  const { data: paginated, isLoading, isError } = useSongs(params);
  const songs = paginated?.data ?? [];

  const bpmGteNum = bpmGte ? Number(bpmGte) : undefined;
  const bpmLteNum = bpmLte ? Number(bpmLte) : undefined;
  const sanitisedBpmGte = bpmGteNum !== undefined && !isNaN(bpmGteNum) ? bpmGteNum : undefined;
  const sanitisedBpmLte = bpmLteNum !== undefined && !isNaN(bpmLteNum) ? bpmLteNum : undefined;
  const genreNotList = genreNot?.split(',').filter(Boolean) ?? [];

  const doneHref = buildViewUrl(location.search);

  return (
    <div className="EditMetadata">
      <FilterBar
        genreNot={genreNotList}
        bpmGte={sanitisedBpmGte}
        bpmLte={sanitisedBpmLte}
        readOnly
        doneHref={doneHref}
        songCount={songs.length}
      />
      {isError && <p style={{ color: 'red' }}>Failed to load songs</p>}
      {isLoading && <p>Loading songs...</p>}
      {!isLoading && !isError && (
        <EditLayout
          songs={songs}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
      )}
    </div>
  );
}
