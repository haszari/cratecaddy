import { defineConfig, type Plugin, type UserConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'node:fs'
import { execSync } from 'node:child_process'
import { VitePWA } from 'vite-plugin-pwa'

/**
 * Build targets.
 *
 * `api` is the full app served with the API; `static-site` is the read-only
 * build published to GitHub Pages that displays a Snapshot of the Library.
 *
 * The target is chosen by which config file Vite loads (vite.config.ts vs
 * vite.static.config.ts), not by --mode. Vite's mode means environment
 * (development/production); overloading it for the target made the two
 * impossible to reason about separately.
 */
export type BuildTarget = 'api' | 'static-site'

export interface BuildConfigOptions {
  target: BuildTarget
}

/** Where the static site is published from, and the asset prefix it expects. */
export const STATIC_SITE_BASE = '/cratecaddy/'
export const STATIC_SITE_OUT_DIR = 'dist-static'
export const API_OUT_DIR = 'dist'

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

export function createConfig({ target }: BuildConfigOptions): UserConfig {
  const isStaticSite = target === 'static-site'

  if (isStaticSite && !findSnapshotFile()) {
    throw new Error(
      'No Snapshot found in src/ui/public/data.\n' +
      'Run `npm run snapshot` in src/api first (it needs MongoDB running).',
    )
  }

  const snapshotFile = isStaticSite ? findSnapshotFile() : null

  return defineConfig({
    plugins: isStaticSite
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
              start_url: STATIC_SITE_BASE,
              scope: STATIC_SITE_BASE,
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
          isStaticSite ? './src/data/snapshotClient.ts' : './src/data/client.ts',
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
    // The static site is published under <custom domain>/cratecaddy/. Dev and
    // preview use the same prefix so assets resolve identically everywhere.
    base: isStaticSite ? STATIC_SITE_BASE : '/',
    build: {
      outDir: isStaticSite ? STATIC_SITE_OUT_DIR : API_OUT_DIR,
    },
    server: {
      port: parseInt(process.env.UI_PORT || '5325'),
    },
    optimizeDeps: {
      // Only the app entry. Otherwise the dev dependency scanner also picks up
      // built index.html files in dist/ and dist-static/, then fails on modules
      // the other build target deliberately omits (edit code, API client).
      entries: ['index.html'],
    },
  })
}
