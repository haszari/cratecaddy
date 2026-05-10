import './App.scss';

import { BrowserRouter, Routes, Route } from 'react-router-dom';

import GenreDetail from './pages/GenreDetail';
import Home from './pages/Home';
import Artist from './pages/Artist';
import SongDetail from './pages/SongDetail';

function App() {
  return (
    <BrowserRouter>
      <div className="App">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/genre/:genrePath" element={<GenreDetail />} />
          <Route path="/artist/:artistName" element={<Artist />} />
          <Route path="/song/:id" element={<SongDetail />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App
