import { useParams, Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import GenreTagWithCount from '../components/GenreTag';
import { SourcesIcons } from '../components/SourcesIcons';
import '../pages/GenreDetail.scss';

interface Song {
  _id?: string;
  title: string;
  artist: string;
  genres: string[];
  bpm?: number;
  rating?: number;
  key?: string;
  sources: ISource[];
}

interface ISource {
  sourceType: 'applemusic' | 'rekordbox' | 'djaypro' | 'local';
  filePath?: string;
  fileSize?: number;
  bitRate?: number;
  fileType?: string;
  sourceMetadata?: {
    isAppleMusic?: boolean;
    [key: string]: unknown;
  };
  lastImportDate: Date;
}

interface TagInfo {
  count: number;
}

function indexTags(songs: Song[]): Record<string, TagInfo> {
  const tagsMap: Record<string, TagInfo> = {};
  songs.forEach((song) => {
    song.genres.forEach((genre) => {
      const trimmedGenre = genre.trim();
      if (trimmedGenre === '') return;
      if (trimmedGenre in tagsMap) {
        tagsMap[trimmedGenre].count += 1;
      } else {
        tagsMap[trimmedGenre] = { count: 1 };
      }
    });
  });
  return tagsMap;
}

function GenreTagCloud({ tags }: { tags: Record<string, TagInfo> }) {
  const sortedTagKeys = Object.keys(tags).sort((a, b) => {
    return a.localeCompare(b);
  });

  return (
    <div className="TagCloud">
      {sortedTagKeys.map((tag) => (
        <GenreTagWithCount
          key={tag}
          tagText={tag}
          tagCount={tags[tag].count}
        />
      ))}
    </div>
  );
}

function SongTable({ songs }: { songs: Song[] }) {
  const sortedSongs = [...songs].sort((a, b) => (b.rating || 0) - (a.rating || 0));

  const formatRating = (rating: number | undefined) => {
    if (rating === undefined) return '—';
    return rating === Math.round(rating) ? Math.round(rating).toString() : rating.toFixed(1);
  };

  return (
    <table>
      <thead>
        <tr>
          <th>Artist</th>
          <th>Title</th>
          <th>BPM</th>
          <th>Key</th>
          <th>Rating</th>
          <th>Sources</th>
          <th>Genres</th>
        </tr>
      </thead>
      <tbody>
        {sortedSongs.map((song) => (
          <tr key={song._id}>
            <td>{song.artist}</td>
            <td>{song.title}</td>
            <td>{song.bpm || '—'}</td>
            <td>{song.key || '—'}</td>
            <td>{formatRating(song.rating)}</td>
            <td>
              <SourcesIcons sources={song.sources} />
            </td>
            <td>
              <div className="genres-cell">
                {song.genres.map((genre) => (
                  <GenreTagWithCount
                    key={genre}
                    tagText={genre}
                    tagCount={0}
                  />
                ))}
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function GenreDetail() {
  const { genreName } = useParams<{ genreName: string }>();
  const decodedGenre = genreName ? decodeURIComponent(genreName) : '';

  const [allSongs, setAllSongs] = useState<Song[]>([]);
  const [filteredSongs, setFilteredSongs] = useState<Song[]>([]);
  const [tags, setTags] = useState<Record<string, TagInfo>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSongs = async () => {
      try {
        setLoading(true);
        const response = await fetch('http://localhost:3000/api/songs');
        if (!response.ok) {
          throw new Error('Failed to fetch songs');
        }
        const data: Song[] = await response.json();
        setAllSongs(data);

        // Filter songs by genre
        const filtered = data.filter((song) =>
          song.genres.some(
            (g) => g.trim().toLowerCase() === decodedGenre.toLowerCase()
          )
        );
        setFilteredSongs(filtered);
        const allTags = indexTags(filtered);
        // Remove the current genre from the tags
        delete allTags[decodedGenre];
        setTags(allTags);
        setError(null);
      } catch (err) {
        console.error('Error fetching songs:', err);
        setError('Failed to load songs from server');
      } finally {
        setLoading(false);
      }
    };

    fetchSongs();
  }, [decodedGenre]);

  return (
    <div className="GenreDetail">
      <Link to="/" className="back-link">
        ← Back to all genres
      </Link>

      <div className="genre-heading-container">
        <GenreTagWithCount tagText={decodedGenre} tagCount={0} isHeading={true} />
      </div>

      {loading && <p>Loading songs...</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {!loading && !error && (
        <>
          <p className="song-count">{filteredSongs.length} songs with this tag</p>

          {Object.keys(tags).length > 0 && (
            <>
              <h3>Related Tags</h3>
              <GenreTagCloud tags={tags} />
            </>
          )}

          {filteredSongs.length > 0 && <SongTable songs={filteredSongs} />}
        </>
      )}
    </div>
  );
}
