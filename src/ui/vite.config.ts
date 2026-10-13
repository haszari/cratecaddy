import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { execSync } from 'node:child_process'

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

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@cratecaddy-api': path.resolve(__dirname, '../api/src/helpers'),
    },
  },
  define: {
    __GIT_BRANCH__: JSON.stringify(gitBranch || ''),
    __GIT_COMMIT_SHORT__: JSON.stringify(gitCommitShort || ''),
    __GIT_DIRTY__: JSON.stringify(gitDirty),
  },
  server: {
    port: parseInt(process.env.UI_PORT || '5325'),
  },
})
