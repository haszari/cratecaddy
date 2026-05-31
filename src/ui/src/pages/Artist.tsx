import { useState, useCallback, useEffect, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSongs } from '../hooks/useSongs';
import { fetchGenreStats } from '../api/client';
import { useFilters } from '../hooks/useFilters';
import { useEditMode } from '../hooks/useEditMode';
import FilterBar from '../components/FilterBar';
import { GenreTagCloud } from '../components/GenreTagCloud';
import BasePageCriteria from '../components/BasePageCriteria';
import './GenreDetail.scss';
import SongTable from '../components/SongTable';
import EditLayout from '../components/EditLayout';
import type { TagInfo } from '../types';

function splitCSV(val: string | null): string[] {
  if (!val) return [];
  return val.split(',').map((s) => s.trim()).filter(Boolean);
}

function setParam(
  params: URLSearchParams,
  key: string,
  value: string | null,
): URLSearchParams {
  const next = new URLSearchParams(params);
  if (value === null || value === '') {
    next.delete(key);
  } else {
    next.set(key, value);
  }
  return next;
}

export default function Artist() {
  const { artistName } = useParams<{ artistName: string }>();
  const decodedArtist = artistName ? decodeURIComponent(artistName) : '';
  const [searchParams, setSearchParams] = useSearchParams();
  const [page, setPage] = useState(1);

  const editMode = useEditMode();
  const editToggleRef = useRef(editMode.toggle);
  useEffect(() => { editToggleRef.current = editMode.toggle; });
  const queryClient = useQueryClient();
  const prevEditActive = useRef(editMode.active);
  useEffect(() => {
    if (prevEditActive.current && !editMode.active) {
      queryClient.invalidateQueries({ queryKey: ['songs'] });
    }
    prevEditActive.current = editMode.active;
  }, [editMode.active, queryClient]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'e' && !e.ctrlKey && !e.metaKey && !isInputFocused()) {
        e.preventDefault();
        editToggleRef.current();
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  const requiredGenres = splitCSV(searchParams.get('genre.all'));

  const {
    filters, addExclude,
    removeExclude, setBpmRange,
    shuffleMode, toggleShuffle, reshuffle,
  } = useFilters();

  const requiredGenresParam = requiredGenres.length > 0 ? requiredGenres.join(',') : undefined;
  const genreNotParam = filters.genreNot.length > 0 ? filters.genreNot.join(',') : undefined;
  const bpmGteParam = filters.bpmGte !== undefined ? String(filters.bpmGte) : undefined;
  const bpmLteParam = filters.bpmLte !== undefined ? String(filters.bpmLte) : undefined;
  const shuffleParam = filters.shuffleSeed;

  const extraParams = {
    'artist.any': decodedArtist || undefined,
    ...(requiredGenresParam && { 'genre.all': requiredGenresParam }),
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

  const { data: relateStats } = useQuery({
    queryKey: ['genreStats', decodedArtist, requiredGenresParam, genreNotParam, bpmGteParam, bpmLteParam],
    queryFn: () => fetchGenreStats(extraParams),
    enabled: !!decodedArtist,
  });

  const relatedTags: Record<string, TagInfo> = {};
  if (relateStats) {
    const lowerRequired = new Set(requiredGenres.map((g) => g.toLowerCase()));
    for (const { genre, count } of relateStats) {
      if (!lowerRequired.has(genre.toLowerCase())) {
        relatedTags[genre] = { count };
      }
    }
  }

  const handleAddRequired = useCallback(
    (genre: string) => {
      setSearchParams((prev) => {
        const current = splitCSV(prev.get('genre.all'));
        if (current.includes(genre)) return prev;
        return setParam(prev, 'genre.all', [...current, genre].join(','));
      }, { replace: true });
    },
    [setSearchParams],
  );

  const handleRemoveRequired = useCallback(
    (genre: string) => {
      setSearchParams((prev) => {
        const current = splitCSV(prev.get('genre.all')).filter((g) => g !== genre);
        return setParam(prev, 'genre.all', current.length > 0 ? current.join(',') : null);
      }, { replace: true });
    },
    [setSearchParams],
  );

  const songs = paginated?.data ?? [];
  const hasTag = (genre: string) => filters.genreNot.includes(genre);

  if (editMode.active && paginated) {
    return (
      <div className="GenreDetail">
        <BasePageCriteria
          artists={[decodedArtist]}
          genres={requiredGenres.map((g) => ({ name: g, mode: 'and' }))}
          onRemoveGenre={handleRemoveRequired}
        />

        <FilterBar
          genreNot={filters.genreNot}
          bpmGte={filters.bpmGte}
          bpmLte={filters.bpmLte}
          onRemoveExclude={removeExclude}
          onBpmChange={setBpmRange}
          shuffleActive={shuffleMode}
          onShuffleToggle={toggleShuffle}
          onShuffleReseed={reshuffle}
          editMode={editMode.active}
          onEditToggle={editMode.toggle}
        />

        <EditLayout
          songs={songs}
          selectedIndex={editMode.selectedIndex}
          onSelect={editMode.selectIndex}
          onSelectNext={() => editMode.selectNext(songs.length)}
          onSelectPrev={editMode.selectPrev}
        />
      </div>
    );
  }

  return (
    <div className="GenreDetail">
      <BasePageCriteria
        artists={[decodedArtist]}
        genres={requiredGenres.map((g) => ({ name: g, mode: 'and' }))}
        onRemoveGenre={handleRemoveRequired}
      />

      <FilterBar
        genreNot={filters.genreNot}
        bpmGte={filters.bpmGte}
        bpmLte={filters.bpmLte}
        onRemoveExclude={removeExclude}
        onBpmChange={setBpmRange}
        shuffleActive={shuffleMode}
        onShuffleToggle={toggleShuffle}
        onShuffleReseed={reshuffle}
        editMode={editMode.active}
        onEditToggle={editMode.toggle}
      />

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

function isInputFocused(): boolean {
  const tag = document.activeElement?.tagName;
  return tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA';
}
