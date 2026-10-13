import { useEffect, useState } from 'react';

export interface VersionInfo {
  appVersion: string;
  version: string;
  gitCommitShort: string;
  gitCommit: string;
  gitBranch: string;
  gitDirty: boolean;
}

export default function DevVersion() {
  const [v, setV] = useState<VersionInfo | null>(null);

  useEffect(() => {
    fetch('/api/version')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setV(data);
      })
      .catch(() => {});
  }, []);

  const isDev = import.meta.env.DEV;
  // @ts-expect-error injected by Vite define
  const devBranch = typeof __GIT_BRANCH__ !== 'undefined' ? (__GIT_BRANCH__ as string) : '';
  // @ts-expect-error injected by Vite define
  const devSha = typeof __GIT_COMMIT_SHORT__ !== 'undefined' ? (__GIT_COMMIT_SHORT__ as string) : '';
  // @ts-expect-error injected by Vite define
  const devDirty = typeof __GIT_DIRTY__ !== 'undefined' ? (__GIT_DIRTY__ as boolean) : false;

  const branchLabel = v?.gitBranch || devBranch || '';
  const shaLabel = v?.gitCommitShort || devSha || '';
  const dirtyLabel = v?.gitDirty ?? devDirty;

  return (
    <>
      <div
        style={{
          marginTop: 'auto',
          padding: '8px',
          fontSize: '10px',
          opacity: 0.5,
          userSelect: 'none',
        }}
      >
        {isDev && (
          <span>{`dev • ${branchLabel || '—'} • ${shaLabel || '—'}${dirtyLabel ? ' (dirty)' : ''}`}</span>
        )}
      </div>
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
    </>
  );
}
