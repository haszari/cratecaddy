import '@mantine/core/styles.css';
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import Providers from './shell/Providers'
import SnapshotApp from './shell/SnapshotApp'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Providers>
      <SnapshotApp />
    </Providers>
  </StrictMode>,
)
