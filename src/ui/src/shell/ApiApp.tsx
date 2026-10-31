import { BrowserRouter } from 'react-router-dom';
import BrowseRoutes from './BrowseRoutes';
import { EditLinksProvider } from './editLinksContext';
import VersionStatus from './VersionStatus';
import EditMetadata from '../pages/EditMetadata';
import Favourited from '../pages/Favourited';

/**
 * API-backed shell: full app, including the write surface.
 * Version identity comes from the running API via VersionStatus.
 */
export default function ApiApp() {
  return (
    <BrowserRouter>
      <EditLinksProvider value={true}>
      <div className="App">
        <BrowseRoutes
          extraRoutes={[
            { path: '/favourited', element: <Favourited /> },
            { path: '/edit-metadata', element: <EditMetadata /> },
          ]}
        />
        <VersionStatus />
      </div>
      </EditLinksProvider>
    </BrowserRouter>
  );
}
