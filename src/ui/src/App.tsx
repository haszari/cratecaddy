import './App.scss';
import { useMemo } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useSongs } from './hooks/useSongs';
import { indexTags } from './utils/tagUtils';
import { GenreTagCloud } from './components/GenreTagCloud';
import GenreDetail from './pages/GenreDetail';
import type { TagInfo } from './types';

function HomePage() {
  const { data: songs, isLoading, error } = useSongs();

  const tags = useMemo(() => {
    if (!songs) return {};
    return indexTags(songs);
  }, [songs]);

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
      {isLoading && <p>Loading songs...</p>}
      {error && <p style={{ color: 'red' }}>Failed to load songs</p>}
      {!isLoading && !error && songs && <p>{songs.length} songs loaded</p>}
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
