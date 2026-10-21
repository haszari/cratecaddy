import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router = Router();

interface VersionInfo {
  appVersion: string;
  gitCommit: string;
  gitCommitShort: string;
  gitBranch: string;
  gitDirty: boolean;
  buildTime: string;
  version: string;
}

function safeExec(cmd: string): string {
  try {
    return execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'], encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

function isGitRepo(): boolean {
  try {
    const out = execSync('git rev-parse --git-dir', { stdio: ['ignore', 'pipe', 'ignore'], encoding: 'utf8' });
    return !!out.trim();
  } catch {
    return false;
  }
}

/**
 * A version is `appVersion+commitShort`. When the commit is not known (an
 * installed copy has no git repo), say just the app version: `0.1.0`, never
 * `0.1.0+unknown`.
 */
function buildVersionString(
  appVersion: string,
  gitCommitShort: string,
  gitBranch: string,
  gitDirty: boolean,
): string {
  const hasCommit = Boolean(gitCommitShort) && gitCommitShort !== 'unknown';
  let version = hasCommit ? `${appVersion}+${gitCommitShort}` : appVersion;
  if (hasCommit && gitBranch && gitBranch !== 'main' && gitBranch !== 'master') {
    version = `${version} (${gitBranch})`;
  }
  if (gitDirty) version = `${version}-dirty`;
  return version;
}

function computeVersion(): VersionInfo {
  // Read app version from package.json
  let appVersion = '0.1.0';
  try {
    const pkgPath = path.resolve(__dirname, '../../package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    if (pkg && pkg.version) appVersion = String(pkg.version);
  } catch {
    // ignore
  }

  const hasGit = isGitRepo();
  if (!hasGit) {
    return {
      appVersion,
      gitCommit: 'unknown',
      gitCommitShort: 'unknown',
      gitBranch: '',
      gitDirty: false,
      buildTime: new Date().toISOString(),
      version: buildVersionString(appVersion, '', '', false),
    };
  }

  const branchRaw = safeExec('git branch --show-current');
  let gitBranch = branchRaw || '';
  const isDetached = !gitBranch;
  if (isDetached) {
    gitBranch = 'detached';
  }

  const gitCommit = safeExec('git rev-parse HEAD') || 'unknown';
  const gitCommitShort = gitCommit === 'unknown' ? 'unknown' : gitCommit.slice(0, 7);
  const gitDirty = (() => {
    try {
      execSync('git diff --quiet --ignore-submodules HEAD', { stdio: ['ignore', 'pipe', 'ignore'] });
      return false;
    } catch {
      return true;
    }
  })();

  const version = buildVersionString(appVersion, gitCommitShort, gitBranch, gitDirty);

  return {
    appVersion,
    gitCommit,
    gitCommitShort,
    gitBranch: isDetached ? 'detached' : gitBranch || '',
    gitDirty,
    buildTime: new Date().toISOString(),
    version,
  };
}

interface BakedVersionModule {
  APP_VERSION?: unknown;
  GIT_COMMIT?: unknown;
  GIT_COMMIT_SHORT?: unknown;
  GIT_BRANCH?: unknown;
  GIT_DIRTY?: unknown;
  BUILD_TIME?: unknown;
  VERSION?: unknown;
}

let bakedVersion: Promise<VersionInfo | null> | null = null;

/**
 * The production build writes src/api/src/generated/version.ts, compiled into
 * dist/generated/version.js. The API is ESM, so it must be imported, not
 * required: a synchronous require() silently failed in the installed copy and
 * fell back to live git detection, which reports "unknown" when there is no
 * repository. Load it once and cache the result.
 */
function loadBakedVersion(): Promise<VersionInfo | null> {
  if (bakedVersion) return bakedVersion;

  bakedVersion = (async () => {
    const distPath = path.resolve(__dirname, '../generated/version.js');
    if (!fs.existsSync(distPath)) return null;
    try {
      const baked = (await import(pathToFileURL(distPath).href)) as BakedVersionModule;
      const appVersion = String(baked.APP_VERSION ?? '0.1.0');
      const gitCommit = String(baked.GIT_COMMIT ?? 'unknown');
      const gitCommitShort = String(baked.GIT_COMMIT_SHORT ?? 'unknown');
      const gitBranch = String(baked.GIT_BRANCH ?? '');
      const gitDirty = Boolean(baked.GIT_DIRTY ?? false);
      return {
        appVersion,
        gitCommit,
        gitCommitShort,
        gitBranch,
        gitDirty,
        buildTime: String(baked.BUILD_TIME ?? new Date().toISOString()),
        version: String(
          baked.VERSION || buildVersionString(appVersion, gitCommitShort, gitBranch, gitDirty),
        ),
      };
    } catch (error) {
      console.error('Failed to load the baked version:', error);
      return null;
    }
  })();

  return bakedVersion;
}

router.get('/', async (_req: Request, res: Response) => {
  const baked = await loadBakedVersion();
  if (baked) {
    res.json(baked);
    return;
  }
  res.json(computeVersion());
});

export default router;
