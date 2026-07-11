import { useParams, useLocation, useSearchParams } from 'react-router-dom';
import { useSongPage } from '../hooks/useSongPage';
import { useFilters } from '../hooks/useFilters';
import FilterBar from '../components/FilterBar';
import { GenreTagCloud } from '../components/GenreTagCloud';
import BasePageCriteria from '../components/BasePageCriteria';
import './GenreDetail.scss';
import SongTable from '../components/SongTable';
import { buildEditUrl } from '../utils/urlBuilder';
import { splitCSV } from '../utils/urlParams';
import { KEY } from '@cratecaddy-api/apiParams';

export default function Artist() {
  const { artistName } = useParams<{ artistName: string }>();
  const decodedArtist = artistName ? decodeURIComponent(artistName) : '';
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const requiredGenres = splitCSV(searchParams.get(KEY.genreAll));
  const { filters } = useFilters();

  const editHref = buildEditUrl(
    location.search,
    'artist',
    { artistAny: decodedArtist },
  );

  const {
    setPage, addExclude,
    sortField, sortDirection,
    handleSort,
    songs, paginated, isLoading, error,
    relatedTags, hasTag, filterBarProps,
    handleAddRequired, handleRemoveRequired,
  } = useSongPage({
    extraFilterParams: { [KEY.artistAny]: decodedArtist || undefined },
    genreMode: 'search-param',
    genreParamKey: KEY.genreAll,
    genreStatsKey: ['genreStats', decodedArtist, requiredGenres.join(',') || undefined, filters],
    genreStatsEnabled: !!decodedArtist,
    excludedGenres: requiredGenres,
    editHref,
  });

  return (
    <div className="GenreDetail">
      <BasePageCriteria
        artists={[decodedArtist]}
        genres={requiredGenres.map((g) => ({ name: g, mode: 'and' }))}
        onRemoveGenre={handleRemoveRequired}
      />

      <FilterBar {...filterBarProps} />

      {isLoading && <p>Loading songs...</p>}
      {error && <p className="error-message">Failed to load songs</p>}
      {!isLoading && !error && paginated && (
        <>
          {songs.length > 0 && (
            <SongTable
              songs={songs}
              page={paginated.page}
              totalPages={paginated.totalPages}
              totalCount={paginated.total}
              onPageChange={setPage}
              sortField={sortField}
              sortDirection={sortDirection}
              onSortChange={handleSort}
            />
          )}

          {Object.keys(relatedTags).length > 0 && (
            <GenreTagCloud
              tags={Object.fromEntries(
                Object.entries(relatedTags).filter(([g]) => !hasTag(g))
              )}
              onInclude={handleAddRequired}
              onExclude={addExclude}
            />
          )}
        </>
      )}
    </div>
  );
}
