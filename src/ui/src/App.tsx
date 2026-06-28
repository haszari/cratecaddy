import { MantineProvider } from '@mantine/core';
import { ThemeProvider } from '@mui/material/styles';
import theme from './styles/theme';
import { mantineTheme } from './styles/mantineTheme';
import './App.scss';

import { BrowserRouter, Routes, Route } from 'react-router-dom';

import GenreDetail from './pages/GenreDetail';
import Home from './pages/Home';
import Artist from './pages/Artist';
import Song from './pages/Song';
import EditMetadata from './pages/EditMetadata';

function App() {
  return (
    <MantineProvider theme={mantineTheme} forceColorScheme="dark">
      <ThemeProvider theme={theme}>
        <BrowserRouter>
          <div className="App">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/edit-metadata" element={<EditMetadata />} />
              <Route path="/genre/:genrePath" element={<GenreDetail />} />
              <Route path="/artist/:artistName" element={<Artist />} />
              <Route path="/song/:id" element={<Song />} />
            </Routes>
          </div>
        </BrowserRouter>
      </ThemeProvider>
    </MantineProvider>
  );
}

export default App
