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
