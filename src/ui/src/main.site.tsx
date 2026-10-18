// Published site entrypoint: read-only, data precached for offline use.
// Swapped in for main.tsx by the Vite plugin when building --mode site.
import '@mantine/core/styles.css';
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import Providers from './shell/Providers'
import SiteApp from './shell/SiteApp'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Providers>
      <SiteApp />
    </Providers>
  </StrictMode>,
)
