import type { ReactElement } from 'react';
import { Route, Routes } from 'react-router-dom';
import Home from '../pages/Home';
import GenreDetail from '../pages/GenreDetail';
import Artist from '../pages/Artist';
import Favourited from '../pages/Favourited';
import Song from '../pages/Song';

export interface AppRoute {
  path: string;
  element: ReactElement;
}

/**
 * Routes that exist in every build target. Write-only routes (edit metadata)
 * belong in the API shell, never here, so the Snapshot bundle cannot contain them.
 */
export const browseRoutes: AppRoute[] = [
  { path: '/', element: <Home /> },
  { path: '/genre/:genrePath', element: <GenreDetail /> },
  { path: '/artist/:artistName', element: <Artist /> },
  { path: '/favourited', element: <Favourited /> },
  { path: '/song/:id', element: <Song /> },
];

export default function BrowseRoutes({ extraRoutes = [] }: { extraRoutes?: AppRoute[] }) {
  return (
    <Routes>
      {[...browseRoutes, ...extraRoutes].map(({ path, element }) => (
        <Route key={path} path={path} element={element} />
      ))}
    </Routes>
  );
}
