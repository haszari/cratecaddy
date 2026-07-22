import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchSongById, fetchGenreStats } from '../api/client';
import FilterBar from '../components/FilterBar';
import { GenreTagCloud } from '../components/GenreTagCloud';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

export default function Song() {
  const { id } = useParams<{ id: string }>();
  const { data: song, isLoading, error } = useQuery({
    queryKey: ['song', id],
    queryFn: () => fetchSongById(id!),
    enabled: !!id,
  });

  const { data: genreStats } = useQuery({
    queryKey: ['genreStats'],
    queryFn: () => fetchGenreStats(),
    enabled: !!song,
  });

  useDocumentTitle(song ? `${song.artist} — ${song.title}` : undefined);

  const tags = song && genreStats
    ? Object.fromEntries(
        genreStats
          .filter((s) => song.genres.includes(s.genre))
          .map((s) => [s.genre, { count: s.count }]),
      )
    : {};

  if (isLoading) {
    return (
      <div className="App">
        <FilterBar genreNot={[]} onRemoveExclude={() => {}} />
        <p>Loading...</p>
      </div>
    );
  }

  if (error || !song) {
    return (
      <div className="App">
        <FilterBar genreNot={[]} onRemoveExclude={() => {}} />
        <p>Song not found</p>
      </div>
    );
  }

  return (
    <div className="App">
      <FilterBar genreNot={[]} onRemoveExclude={() => {}} />
      <div className="SongInfo">
        <Link to={`/artist/${encodeURIComponent(song.artist)}`} className="PageCriteria-artist">{song.artist}</Link>
        <span className="SongInfo-title">{song.title}</span>
        <span className="SongInfo-meta">
          {song.bpm != null ? Math.round(song.bpm) : ''}<span className="SongInfo-meta-bpm">bpm</span> {song.key}
        </span>
      </div>
      {song.genres.length > 0 && <GenreTagCloud tags={tags} />}
    </div>
  );
}
