import { useEffect, useRef, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { getSnapshotMeta } from '../data/snapshotClient';

const UPDATE_CHECK_INTERVAL_MS = 15 * 60 * 1000;

function formatTakenAt(takenAt: string | undefined): string {
  if (!takenAt) return '';
  const date = new Date(takenAt);
  if (Number.isNaN(date.getTime())) return takenAt;
  return date.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Published-site provenance and freshness: version, Snapshot timestamp, offline
 * state, and the update flow.
 *
 * Updates are never left to chance: a new build is precached, the app shows
 * "Getting fresh tune data…", then activates the new service worker and
 * reloads. No tab can keep serving an old Snapshot once a new one is ready.
 */
export default function SiteStatus() {
  const [online, setOnline] = useState(() => navigator.onLine);
  const [updating, setUpdating] = useState(false);
  const updateStarted = useRef(false);
  const snapshot = getSnapshotMeta();

  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      const checkForUpdate = () => {
        if (navigator.onLine) {
          registration.update().catch(() => {
            // Offline or transient network failure: retry on the next trigger.
          });
        }
      };
      checkForUpdate();
      window.setInterval(checkForUpdate, UPDATE_CHECK_INTERVAL_MS);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') checkForUpdate();
      });
    },
  });

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (!needRefresh || updateStarted.current) return;
    updateStarted.current = true;
    setUpdating(true);
    // Give the message a frame to paint before activating and reloading.
    window.setTimeout(() => {
      updateServiceWorker(true).catch(() => {
        updateStarted.current = false;
        setUpdating(false);
      });
    }, 600);
  }, [needRefresh, updateServiceWorker]);

  const version = `${__APP_VERSION__}+${__GIT_COMMIT_SHORT__ || 'unknown'}${__GIT_DIRTY__ ? '-dirty' : ''}`;

  return (
    <>
      {!online && (
        <div className="SiteStatus-offline" role="status">
          Offline · snapshot from {formatTakenAt(snapshot?.takenAt) || 'unknown'}
        </div>
      )}
      {updating && (
        <div className="SiteStatus-update" role="status">
          Getting fresh tune data…
          <div className="SiteStatus-progress" aria-hidden="true" />
        </div>
      )}
      <div className="SiteStatus-footer">
        {snapshot
          ? `${version} · snapshot ${formatTakenAt(snapshot.takenAt)}`
          : version}
      </div>
      <div
        id="cratecaddy-version"
        style={{ display: 'none' }}
        data-app={__APP_VERSION__}
        data-version={version}
        data-commit-short={__GIT_COMMIT_SHORT__ || ''}
        data-branch={__GIT_BRANCH__ || ''}
        data-dirty={String(Boolean(__GIT_DIRTY__))}
        data-snapshot-version={snapshot?.version ?? ''}
        data-snapshot-taken-at={snapshot?.takenAt ?? ''}
      />
    </>
  );
}
