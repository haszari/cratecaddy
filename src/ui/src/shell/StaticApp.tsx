import { HashRouter, Navigate } from 'react-router-dom';
import BrowseRoutes from './BrowseRoutes';

/**
 * Published Snapshot shell: browse only, no write surface.
 *
 * HashRouter because GitHub Pages has no server-side routing fallback. The
 * static data source is selected by the @data alias at build time, so this
 * shell contains no API client.
 */
export default function StaticApp() {
  return (
    <HashRouter>
      <div className="App">
        <BrowseRoutes
          extraRoutes={[{ path: '*', element: <Navigate to="/" replace /> }]}
        />
      </div>
    </HashRouter>
  );
}
