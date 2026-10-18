import { useVersion } from '../hooks/useVersion';

export default function DevVersion() {
  const { data: v } = useVersion();

  const isDev = import.meta.env.DEV;
  const devBranch = typeof __GIT_BRANCH__ !== 'undefined' ? (__GIT_BRANCH__ as string) : '';
  const devSha = typeof __GIT_COMMIT_SHORT__ !== 'undefined' ? (__GIT_COMMIT_SHORT__ as string) : '';
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
