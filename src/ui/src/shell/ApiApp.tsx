import { BrowserRouter } from 'react-router-dom';
import BrowseRoutes from './BrowseRoutes';
import { EditLinksProvider } from './EditLinksContext';
import DevVersion from '../components/DevVersion';
import EditMetadata from '../pages/EditMetadata';

/**
 * API-backed shell: full app, including the write surface.
 * Version comes from the running API via DevVersion.
 */
export default function ApiApp() {
  return (
    <BrowserRouter>
      <EditLinksProvider value={true}>
      <div className="App">
        <BrowseRoutes extraRoutes={[{ path: '/edit-metadata', element: <EditMetadata /> }]} />
        <DevVersion />
      </div>
      </EditLinksProvider>
    </BrowserRouter>
  );
}
