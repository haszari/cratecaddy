import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'node:fs'
import { execSync } from 'node:child_process'
import { VitePWA } from 'vite-plugin-pwa'

function safeExec(cmd: string) {
  try {
    return execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'], encoding: 'utf8' }).trim()
  } catch {
    return ''
  }
}

let gitBranch = ''
let gitCommitShort = ''
let gitDirty = false

try {
  const br = safeExec('git branch --show-current')
  gitBranch = br || 'detached'
  const full = safeExec('git rev-parse HEAD')
  if (full) gitCommitShort = full.slice(0, 7)
  try {
    execSync('git diff --quiet --ignore-submodules HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
    gitDirty = false
  } catch {
    gitDirty = true
  }
} catch {
  // ignore
}

/** Newest Snapshot written by `npm run snapshot` in src/api. */
function findSnapshotFile(): string | null {
  const snapshotDir = path.resolve(__dirname, 'public/data')
  if (!fs.existsSync(snapshotDir)) return null
  const files = fs
    .readdirSync(snapshotDir)
    .filter((file) => /^snapshot-[0-9a-f]+\.json$/.test(file))
  if (files.length === 0) return null
  files.sort(
    (a, b) =>
      fs.statSync(path.join(snapshotDir, b)).mtimeMs - fs.statSync(path.join(snapshotDir, a)).mtimeMs,
  )
  return `data/${files[0]}`
}

/**
 * The static site uses the same index.html with a different entry point,
 * so the write-capable API shell is never in the site bundle.
 */
function staticEntryPlugin(): Plugin {
  return {
    name: 'cratecaddy-static-entry',
    transformIndexHtml: {
      // Must run before Vite resolves the entry script from index.html.
      order: 'pre',
      handler(html) {
        return html.replace('/src/main.tsx', '/src/main.static.tsx')
      },
    },
  }
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const isStatic = mode === 'static'

  if (isStatic) {
    if (!findSnapshotFile()) {
      throw new Error(
        'No Snapshot found in src/ui/public/data.\n' +
        'Run `npm run snapshot` in src/api first (it needs MongoDB running).',
      )
    }
  }

  const snapshotFile = isStatic ? findSnapshotFile() : null

  return {
    plugins: isStatic
      ? [
          react(),
          staticEntryPlugin(),
          VitePWA({
            // Registration and the update UX live in shell/StaticStatus.
            registerType: 'prompt',
            injectRegister: false,
            includeAssets: ['icon.svg', 'vite.svg'],
            manifest: {
              name: 'CrateCaddy',
              short_name: 'CrateCaddy',
              description: 'Browse a DJ library by genre, tempo and key. Works offline.',
              theme_color: '#141414',
              background_color: '#141414',
              display: 'standalone',
              start_url: '/cratecaddy/',
              scope: '/cratecaddy/',
              icons: [
                { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
              ],
            },
            workbox: {
              // The Snapshot is precached with a content revision, so a new
              // build replaces it atomically and no stale data can be served.
              globPatterns: ['**/*.{js,css,html,svg,png,ico,json,woff2}'],
              // Snapshot is ~4 MB raw (~600 KB gzipped); Workbox defaults to 2 MB.
              maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
              cleanupOutdatedCaches: true,
              navigateFallback: 'index.html',
            },
          }),
        ]
      : [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@cratecaddy-api': path.resolve(__dirname, '../api/src/helpers'),
        // Build-time swap between the API client and the Snapshot client.
        '@data': path.resolve(
          __dirname,
          isStatic ? './src/data/snapshotClient.ts' : './src/data/client.ts',
        ),
      },
    },
    define: {
      __GIT_BRANCH__: JSON.stringify(gitBranch || ''),
      __GIT_COMMIT_SHORT__: JSON.stringify(gitCommitShort || ''),
      __GIT_DIRTY__: JSON.stringify(gitDirty),
      __SNAPSHOT_FILE__: JSON.stringify(snapshotFile ?? ''),
      __APP_VERSION__: JSON.stringify(
        JSON.parse(fs.readFileSync(path.resolve(__dirname, '../api/package.json'), 'utf8')).version ?? '0.1.0',
      ),
    },
    // Published under <custom domain>/cratecaddy/. Dev site mode uses the same
    // prefix so preview and the published build resolve assets identically.
    base: isStatic ? '/cratecaddy/' : '/',
    build: {
      outDir: isStatic ? 'dist-static' : 'dist',
    },
    server: {
      port: parseInt(process.env.UI_PORT || '5325'),
    },
  }
})
