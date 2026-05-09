import './App.scss';

import { BrowserRouter, Routes, Route } from 'react-router-dom';

import GenreDetail from './pages/GenreDetail';
import Home from './pages/Home';
import Artist from './pages/Artist';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/genre/:genrePath" element={<GenreDetail />} />
        <Route path="/artist/:artistName" element={<Artist />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App
