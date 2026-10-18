import { useEffect, useState } from 'react';
import { HashRouter, Navigate } from 'react-router-dom';
import BrowseRoutes from './BrowseRoutes';
import SiteStatus from './SiteStatus';
// The site shell owns its data source; shared pages/hooks go through @data.
import { loadSnapshot } from '../data/snapshotClient';

type Status =
  | { state: 'loading' }
  | { state: 'ready' }
  | { state: 'error'; message: string };

/**
 * Published site shell: read-only, no write surface.
 *
 * HashRouter because GitHub Pages has no server-side routing fallback. The
 * Snapshot data source is selected by the @data alias at build time, so this
 * shell contains no API client or edit code.
 */
export default function SiteApp() {
  const [status, setStatus] = useState<Status>({ state: 'loading' });

  useEffect(() => {
    let cancelled = false;
    loadSnapshot()
      .then(() => {
        if (!cancelled) setStatus({ state: 'ready' });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : 'Unknown error';
        setStatus({ state: 'error', message });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (status.state === 'loading') {
    return <p className="SiteApp-status">Loading library…</p>;
  }

  if (status.state === 'error') {
    return (
      <div className="SiteApp-status">
        <p>Couldn't load the library.</p>
        <p className="error-message">{status.message}</p>
        <p>You may be offline before the library has been cached for the first time.</p>
        <button onClick={() => window.location.reload()}>Try again</button>
      </div>
    );
  }

  return (
    <HashRouter>
      <div className="App">
        <BrowseRoutes
          extraRoutes={[{ path: '*', element: <Navigate to="/" replace /> }]}
        />
        <SiteStatus />
      </div>
    </HashRouter>
  );
}
