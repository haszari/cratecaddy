// API shell entrypoint: full app, including editing and write-back.
// The Snapshot build swaps this file for main.snapshot.tsx in index.html.
import '@mantine/core/styles.css';
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import Providers from './shell/Providers'
import ApiApp from './shell/ApiApp'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Providers>
      <ApiApp />
    </Providers>
  </StrictMode>,
)
