import { useState, useCallback, Fragment } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useSongs } from '../hooks/useSongs';
import { fetchGenreStats } from '../api/client';
import { useFilters } from '../hooks/useFilters';
import FilterBar from '../components/FilterBar';
import ShuffleControl from '../components/ShuffleControl';
import { GenreTagCloud } from '../components/GenreTagCloud';
import './GenreDetail.scss';
import SongTable from '../components/SongTable';
import type { TagInfo } from '../types';
import { withSearch } from '../utils/url';

export default function GenreDetail() {
  const { genrePath } = useParams<{ genrePath: string }>();
  const navigate = useNavigate();

  const separator = genrePath && genrePath.includes(',') ? ',' : '+';
  const isOrMode = separator === ',';

  const decodedGenres = genrePath
    ? genrePath.split(separator).map(decodeURIComponent).filter(Boolean)
    : [];

  const [page, setPage] = useState(1);
  const [shuffleMode, setShuffleMode] = useState(true);
  const [shuffleSeed, setShuffleSeed] = useState(() => Math.random().toString(36).slice(2, 10));
  const reshuffle = useCallback(() => setShuffleSeed(Math.random().toString(36).slice(2, 10)), []);

  const {
    filters, addExclude,
    removeExclude, setBpmRange,
  } = useFilters();

  const genreParam = decodedGenres.length > 0 ? decodedGenres.join(',') : undefined;
  const genreNotParam = filters.genreNot.length > 0 ? filters.genreNot.join(',') : undefined;
  const bpmGteParam = filters.bpmGte !== undefined ? String(filters.bpmGte) : undefined;
  const bpmLteParam = filters.bpmLte !== undefined ? String(filters.bpmLte) : undefined;
  const shuffleParam = shuffleMode ? shuffleSeed : undefined;

  const extraParams = {
    ...(genreParam && (isOrMode ? { 'genre.any': genreParam } : { 'genre.all': genreParam })),
    ...(genreNotParam && { 'genre.not': genreNotParam }),
    ...(bpmGteParam && { 'bpm.gte': bpmGteParam }),
    ...(bpmLteParam && { 'bpm.lte': bpmLteParam }),
  };

  const { data: paginated, isLoading, error } = useSongs({
    ...extraParams,
    shuffle: shuffleParam,
    page,
    limit: 50,
  });

  const { data: relatedStats } = useQuery({
    queryKey: ['genreStats', genreParam, isOrMode ? 'any' : 'all', genreNotParam, bpmGteParam, bpmLteParam],
    queryFn: () => fetchGenreStats(extraParams),
    enabled: decodedGenres.length > 0,
  });

  const relatedTags: Record<string, TagInfo> = {};
  if (relatedStats) {
    const lowerAndGenres = new Set(decodedGenres.map((g) => g.toLowerCase()));
    for (const { genre, count } of relatedStats) {
      if (!lowerAndGenres.has(genre.toLowerCase())) {
        relatedTags[genre] = { count };
      }
    }
  }

  const handleAddInclude = useCallback(
    (genre: string) => {
      const lower = decodedGenres.map((g) => g.toLowerCase());
      if (lower.includes(genre.toLowerCase())) return;
      const sep = isOrMode ? ',' : '+';
      const newPath = `/genre/${decodedGenres.map((g) => encodeURIComponent(g)).join(sep)}${sep}${encodeURIComponent(genre)}`;
      navigate(withSearch(newPath), { replace: false });
    },
    [decodedGenres, isOrMode, navigate],
  );

  const handleRemoveInclude = useCallback(
    (genre: string) => {
      const remaining = decodedGenres.filter((g) => g.toLowerCase() !== genre.toLowerCase());
      if (remaining.length === 0) {
        navigate(withSearch('/'), { replace: false });
      } else {
        const sep = isOrMode ? ',' : '+';
        const newPath = `/genre/${remaining.map((g) => encodeURIComponent(g)).join(sep)}`;
        navigate(withSearch(newPath), { replace: false });
      }
    },
    [decodedGenres, isOrMode, navigate],
  );

  const songs = paginated?.data ?? [];

  return (
    <div className="GenreDetail">
      <div className="PageCriteria">
        {decodedGenres.map((genre, i) => (
          <Fragment key={genre}>
            {i > 0 && isOrMode && <span className="or-separator">or</span>}
            <span
              className={`genre-pill${isOrMode ? ' genre-pill--or' : ' genre-pill--and'}`}
            onClick={() => handleRemoveInclude(genre)}
            title={`Remove ${genre}`}
          >
            {genre}
          </span>
          </Fragment>
        ))}
      </div>

      <FilterBar
        genreNot={filters.genreNot}
        bpmGte={filters.bpmGte}
        bpmLte={filters.bpmLte}
        onRemoveExclude={removeExclude}
        onBpmChange={setBpmRange}
      />

      {isLoading && <p>Loading songs...</p>}
      {error && <p style={{ color: 'red' }}>Failed to load songs</p>}
      {!isLoading && !error && paginated && (
        <>
          {Object.keys(relatedTags).length > 0 && (
            <GenreTagCloud
              tags={relatedTags}
              onInclude={handleAddInclude}
              onExclude={addExclude}
            />
          )}

          {songs.length > 0 && (
            <>
              <div className="song-table-header">
                <ShuffleControl
                  active={shuffleMode}
                  onToggle={setShuffleMode}
                  onReseed={reshuffle}
                />
              </div>
              <SongTable
                songs={songs}
                page={paginated.page}
                totalPages={paginated.totalPages}
                totalCount={paginated.total}
                onPageChange={setPage}
              />
            </>
          )}
        </>
      )}
    </div>
  );
}
