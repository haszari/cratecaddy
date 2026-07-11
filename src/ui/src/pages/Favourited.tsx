import { useLocation, useSearchParams } from 'react-router-dom';
import { useSongPage } from '../hooks/useSongPage';
import { useFilters } from '../hooks/useFilters';
import FilterBar from '../components/FilterBar';
import { GenreTagCloud } from '../components/GenreTagCloud';
import './GenreDetail.scss';
import SongTable from '../components/SongTable';
import { buildEditUrl } from '../utils/urlBuilder';
import { splitCSV } from '../utils/urlParams';
import { Heart } from 'lucide-react';
import { KEY } from '@cratecaddy-api/apiParams';

export default function Favourited() {
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const requiredGenres = splitCSV(searchParams.get(KEY.genreAll));
  const { filters } = useFilters();

  const editHref = buildEditUrl(location.search, 'favourited') + '&favorite=starred';

  const {
    setPage, addExclude,
    sortField, sortDirection,
    handleSort,
    songs, paginated, isLoading, error,
    relatedTags, hasTag, filterBarProps,
    handleAddRequired, handleRemoveRequired,
  } = useSongPage({
    extraFilterParams: { [KEY.favorite]: 'starred' },
    genreMode: 'search-param',
    genreParamKey: KEY.genreAll,
    genreStatsKey: ['genreStats', 'favourite', requiredGenres.join(',') || undefined, filters],
    excludedGenres: requiredGenres,
    filterBarExtras: { favouriteMode: 'indicator' },
    editHref,
  });

  return (
    <div className="GenreDetail">
      <div className="PageCriteria">
        <span className="GenreTag GenreTag-heading PageCriteria-artist">
          <Heart size={28} fill="#e03131" color="#e03131" style={{ verticalAlign: -6 }} />
        </span>
        {requiredGenres.map((g) => (
          <span
            key={g}
            className="genre-pill genre-pill--and"
            onClick={() => handleRemoveRequired(g)}
            title={`Remove ${g}`}
          >
            {g}
          </span>
        ))}
      </div>

      <FilterBar {...filterBarProps} />

      {isLoading && <p>Loading songs...</p>}
      {error && <p style={{ color: 'red' }}>Failed to load songs</p>}
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
