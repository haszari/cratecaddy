import '@mantine/core/styles.css';
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import Providers from './shell/Providers'
import StaticApp from './shell/StaticApp'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Providers>
      <StaticApp />
    </Providers>
  </StrictMode>,
)
