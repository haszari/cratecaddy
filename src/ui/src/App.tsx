import './App.scss';
import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import GenreTagWithCount from './components/GenreTag';
import GenreDetail from './pages/GenreDetail';

interface Song {
  _id?: string;
  title: string;
  artist: string;
  genres: string[];
  bpm?: number;
  rating?: number;
}

interface TagInfo {
  count: number;
}

// Iterate through all songs,
// extract genres from array field,
// and index them in a map with tag count.
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

function HomePage() {
  const [songs, setSongs] = useState<Song[]>([]);
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
        setSongs(data);
        setTags(indexTags(data));
        setError(null);
      } catch (err) {
        console.error('Error fetching songs:', err);
        setError('Failed to load songs from server');
      } finally {
        setLoading(false);
      }
    };

    fetchSongs();
  }, []);

  // Split into major / common tags and lesser used tags.
  const main: Record<string, TagInfo> = {};
  const fringe: Record<string, TagInfo> = {};
  for (const [tagName, tagInfo] of Object.entries(tags)) {
    if (tags[tagName].count > 1) {
      main[tagName] = tagInfo;
    } else {
      fringe[tagName] = tagInfo;
    }
  }

  return (
    <div className="HomePage">
      <h1>Crate Caddy</h1>
      {loading && <p>Loading songs...</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {!loading && !error && <p>{songs.length} songs loaded</p>}
      <GenreTagCloud tags={main} />
      <GenreTagCloud tags={fringe} />
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/genre/:genreName" element={<GenreDetail />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App
