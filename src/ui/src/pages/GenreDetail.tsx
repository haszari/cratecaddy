import { useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useSongPage } from '../hooks/useSongPage';
import FilterBar from '../components/FilterBar';
import { GenreTagCloud } from '../components/GenreTagCloud';
import BasePageCriteria from '../components/BasePageCriteria';
import './GenreDetail.scss';
import SongTable from '../components/SongTable';
import { buildEditUrl } from '../utils/urlBuilder';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

export default function GenreDetail() {
  const { genrePath } = useParams<{ genrePath: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const separator = genrePath && genrePath.includes(',') ? ',' : '+';
  const isOrMode = separator === ',';

  const decodedGenres = useMemo(
    () => genrePath
      ? genrePath.split(separator).map(decodeURIComponent).filter(Boolean)
      : [],
    [genrePath, separator],
  );

  const genreParam = useMemo(
    () => decodedGenres.length > 0 ? decodedGenres.join(',') : undefined,
    [decodedGenres],
  );

  useDocumentTitle(decodedGenres.length > 0 ? decodedGenres.join(separator) : undefined);

  const editHref = buildEditUrl(
    location.search,
    'genre',
    isOrMode ? { genreAny: decodedGenres.join(',') } : { genreAll: decodedGenres.join(',') },
  );

  const {
    setPage, addExclude,
    sortField, sortDirection,
    handleSort,
    songs, paginated, isLoading, error,
    relatedTags, filterBarProps,
    handleAddInclude, handleRemoveInclude,
  } = useSongPage({
    genreMode: 'url-path',
    decodedGenres,
    isOrMode,
    navigate,
    genreStatsKey: ['genreStats', genreParam, isOrMode ? 'any' : 'all'],
    genreStatsEnabled: decodedGenres.length > 0,
    excludedGenres: decodedGenres,
    editHref,
  });

  return (
    <div className="GenreDetail">
      <BasePageCriteria
        genres={decodedGenres.map((g) => ({ name: g, mode: isOrMode ? 'or' : 'and' }))}
        onRemoveGenre={handleRemoveInclude}
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
              tags={relatedTags}
              onInclude={handleAddInclude}
              onExclude={addExclude}
            />
          )}
        </>
      )}
    </div>
  );
}
