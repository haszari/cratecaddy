import { Route, Routes } from 'react-router-dom';
import { browseRoutes } from './browseRouteList';
import type { AppRoute } from './browseRouteList';

export default function BrowseRoutes({ extraRoutes = [] }: { extraRoutes?: AppRoute[] }) {
  return (
    <Routes>
      {[...browseRoutes, ...extraRoutes].map(({ path, element }) => (
        <Route key={path} path={path} element={element} />
      ))}
    </Routes>
  );
}
