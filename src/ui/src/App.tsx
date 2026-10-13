import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './App.scss'
import GenrePage from './pages/GenreDetail'
import ArtistPage from './pages/Artist'
import NoResultsPage from './pages/Favourited'
import HomePage from './pages/Home'
import { FilterContextProvider } from './hooks/useFilters'
import { DataContextProvider } from './hooks/useData'

function App() {
  const [v, setV] = useState<{
    appVersion: string
    version: string
    gitCommitShort: string
    gitCommit: string
    gitBranch: string
    gitDirty: boolean
  } | null>(null)

  useEffect(() => {
    fetch('/api/version')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setV(data)
      })
      .catch(() => {})
  }, [])

  const isDev = import.meta.env.DEV
  // @ts-expect-error injected by Vite define
  const devBranch = typeof __GIT_BRANCH__ !== 'undefined' ? (__GIT_BRANCH__ as string) : ''
  // @ts-expect-error injected by Vite define
  const devSha = typeof __GIT_COMMIT_SHORT__ !== 'undefined' ? (__GIT_COMMIT_SHORT__ as string) : ''
  // @ts-expect-error injected by Vite define
  const devDirty = typeof __GIT_DIRTY__ !== 'undefined' ? (__GIT_DIRTY__ as boolean) : false

  const branchLabel = v?.gitBranch || devBranch || ''
  const shaLabel = v?.gitCommitShort || devSha || ''
  const dirtyLabel = v?.gitDirty ?? devDirty

  return (
    <BrowserRouter>
      <DataContextProvider>
        <FilterContextProvider>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/genre/:genres" element={<GenrePage />} />
            <Route path="/artist/:artist" element={<ArtistPage />} />
            <Route path="/no-results" element={<NoResultsPage />} />
          </Routes>
        </FilterContextProvider>
      </DataContextProvider>
      {isDev && (
        <div
          style={{
            position: 'fixed',
            bottom: '8px',
            right: '8px',
            fontSize: '10px',
            opacity: 0.5,
            pointerEvents: 'none',
            userSelect: 'none',
          }}
        >
          {`dev • ${branchLabel || '—'} • ${shaLabel || '—'}${dirtyLabel ? ' (dirty)' : ''}`}
        </div>
      )}
      <div
        id="cratecaddy-version"
        style={{ display: 'none' }}
        data-app={v?.appVersion || ''}
        data-version={v?.version || ''}
        data-commit-short={shaLabel}
        data-commit-full={v?.gitCommit || ''}
        data-branch={branchLabel}
        data-dirty={String(dirtyLabel)}
      />
    </BrowserRouter>
  )
}

export default App
