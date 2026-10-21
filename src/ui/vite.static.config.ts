import { createConfig } from './vite.shared'

// Static site build target: read-only, published to GitHub Pages, displays a Snapshot.
export default createConfig({ target: 'static-site' })
