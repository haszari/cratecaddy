import { useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSongPage } from '../hooks/useSongPage';
import { useFilters } from '../hooks/useFilters';
import FilterBar from '../components/FilterBar';
import { GenreTagCloud } from '../components/GenreTagCloud';
import './GenreDetail.scss';
import SongTable from '../components/SongTable';
import { buildEditUrl } from '../utils/urlBuilder';
import { splitCSV } from '../utils/urlParams';
import { Heart, Loader2, RefreshCw } from 'lucide-react';
import { KEY } from '@cratecaddy-api/apiParams';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { syncFavouritesFromAppleMusic } from '../api/client';

export default function Favourited() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [syncMsg, setSyncMsg] = useState('');
  const [syncIsError, setSyncIsError] = useState(false);

  const requiredGenres = splitCSV(searchParams.get(KEY.genreAll));
  const { filters } = useFilters();

  useDocumentTitle('Favourited');

  const editHref = buildEditUrl(location.search, 'favourited', { favorite: 'starred' });

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

  const syncMutation = useMutation({
    mutationFn: syncFavouritesFromAppleMusic,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['songs'] });
      queryClient.invalidateQueries({ queryKey: ['genreStats'] });
      setSyncIsError(false);
      setSyncMsg(
        `Synced with Apple Music: ${result.starred} starred, ${result.unstarred} un-starred, ${result.added} added`,
      );
    },
    onError: (err) => {
      setSyncIsError(true);
      setSyncMsg(err instanceof Error ? err.message : 'Sync with Apple Music failed');
    },
  });

  const syncBusy = syncMutation.isPending;

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
        <span
          className={`FavouritedSync-pill${syncBusy ? ' FavouritedSync-pill--disabled' : ''}`}
          onClick={syncBusy ? undefined : () => syncMutation.mutate()}
          title="Pull loved tracks from Apple Music and reconcile favourites"
        >
          {syncBusy ? <Loader2 className="FavouritedSync-spinner" size={14} /> : <RefreshCw size={14} />}
          {syncBusy ? 'Syncing…' : 'Sync with Apple Music'}
        </span>
        {syncMsg && (
          <span className={`FavouritedSync-status${syncIsError ? ' FavouritedSync-status--error' : ''}`}>
            {syncMsg}
          </span>
        )}
      </div>

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
