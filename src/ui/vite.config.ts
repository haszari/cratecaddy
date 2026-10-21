import { createConfig } from './vite.shared'

// API build target: the full app, served with the API (dev and appliance).
export default createConfig({ target: 'api' })
