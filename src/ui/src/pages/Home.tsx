import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { fetchGenreStats } from '../api/client';
import { GenreTagCloud } from '../components/GenreTagCloud';
import { useFilters } from '../hooks/useFilters';
import { useSortShuffle } from '../hooks/useSortShuffle';
import FilterBar from '../components/FilterBar';
import type { TagInfo } from '../types';
import { withSearch } from '../utils/url';
import { buildApiParams } from '@cratecaddy-api/apiParams';

export default function Home() {
  const navigate = useNavigate();
  const { shuffleMode, toggleShuffle, reshuffle } = useSortShuffle();
  const {
    filters,
    addExclude,
    removeExclude,
    setBpmRange, setRatingRange, setSearch,
  } = useFilters();

  const extraParams = buildApiParams(filters);

  const { data: stats, isLoading, error } = useQuery({
    queryKey: ['genreStats', filters],
    queryFn: () => fetchGenreStats(extraParams),
  });

  const handleAddInclude = useCallback(
    (genre: string) => {
      navigate(withSearch(`/genre/${encodeURIComponent(genre)}`), { replace: false });
    },
    [navigate],
  );

  const { tags, main, fringe, totalSongs } = useMemo(() => {
    const tags: Record<string, TagInfo> = {};
    const main: Record<string, TagInfo> = {};
    const fringe: Record<string, TagInfo> = {};
    if (stats) {
      for (const { genre, count } of stats) {
        tags[genre] = { count };
        if (count > 1) {
          main[genre] = { count };
        } else {
          fringe[genre] = { count };
        }
      }
    }
    const totalSongs = stats ? stats.reduce((sum, s) => sum + s.count, 0) : 0;
    return { tags, main, fringe, totalSongs };
  }, [stats]);

  const hasTag = useCallback(
    (genre: string) => filters.genreNot.includes(genre),
    [filters.genreNot],
  );

  return (
    <div className="HomePage">
      <FilterBar
        genreNot={filters.genreNot}
        bpmGte={filters.bpmGte}
        bpmLte={filters.bpmLte}
        ratingGte={filters.ratingGte}
        ratingLte={filters.ratingLte}
        onRemoveExclude={removeExclude}
        onBpmChange={setBpmRange}
        onRatingChange={setRatingRange}
        shuffleActive={shuffleMode}
        onShuffleToggle={toggleShuffle}
        onShuffleReseed={reshuffle}
        favouriteMode="nav"
        search={filters.search}
        onSearchChange={setSearch}
      />
      <p className="home-help">
        Combine genres with <code>+</code> (AND) or <code>,</code> (OR) — e.g.{' '}
        <a href="/genre/BAM,Deep"><code>/genre/BAM,Deep</code></a> or <a href="/genre/BAM+Deep"><code>/genre/BAM+Deep</code></a>
      </p>
      {stats && (
        <p className="song-count">{totalSongs} song{totalSongs !== 1 ? 's' : ''} across {Object.keys(tags).length} style{Object.keys(tags).length !== 1 ? 's' : ''}</p>
      )}
      {isLoading && <p>Loading genres...</p>}
      {error && <p className="error-message">Failed to load genres</p>}
      {!isLoading && stats && (
        <>
          <GenreTagCloud
            tags={Object.fromEntries(
              Object.entries(main).filter(([g]) => !hasTag(g))
            )}
            onInclude={handleAddInclude}
            onExclude={addExclude}
          />
          {Object.keys(fringe).length > 0 && (
            <GenreTagCloud
              tags={Object.fromEntries(
                Object.entries(fringe).filter(([g]) => !hasTag(g))
              )}
              onInclude={handleAddInclude}
              onExclude={addExclude}
            />
          )}
        </>
      )}
    </div>
  );
}
