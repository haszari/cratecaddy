import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
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
    const vUnknown = `${appVersion}+unknown`;
    return {
      appVersion,
      gitCommit: 'unknown',
      gitCommitShort: 'unknown',
      gitBranch: '',
      gitDirty: false,
      buildTime: new Date().toISOString(),
      version: vUnknown,
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

  let version = `${appVersion}+${gitCommitShort === 'unknown' ? 'unknown' : gitCommitShort}`;
  if (gitBranch && gitBranch !== 'main') {
    version = `${version} (${gitBranch})`;
  }
  if (gitDirty) {
    version = `${version}-dirty`;
  }

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

router.get('/', (req: Request, res: Response) => {
  try {
    // Try baked dist first
    const distPath = path.resolve(__dirname, '../generated/version.js');
    if (fs.existsSync(distPath)) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const baked = require(distPath) as Partial<VersionInfo> & Record<string, unknown>;
      const info: VersionInfo = {
        appVersion: String(baked.APP_VERSION ?? baked.appVersion ?? '0.1.0'),
        gitCommit: String(baked.GIT_COMMIT ?? baked.gitCommit ?? 'unknown'),
        gitCommitShort: String(baked.GIT_COMMIT_SHORT ?? baked.gitCommitShort ?? 'unknown'),
        gitBranch: String(baked.GIT_BRANCH ?? baked.gitBranch ?? ''),
        gitDirty: Boolean(baked.GIT_DIRTY ?? baked.gitDirty ?? false),
        buildTime: String(baked.BUILD_TIME ?? baked.buildTime ?? new Date().toISOString()),
        version: String(baked.VERSION ?? baked.version ?? ''),
      };
      // Reconstruct version if missing
      if (!info.version) {
        let v = `${info.appVersion}+${info.gitCommitShort === 'unknown' ? 'unknown' : info.gitCommitShort}`;
        if (info.gitBranch && info.gitBranch !== 'main' && info.gitBranch !== 'master') {
          v = `${v} (${info.gitBranch})`;
        }
        if (info.gitDirty) v = `${v}-dirty`;
        info.version = v;
      }
      return res.json(info);
    }
  } catch {
    // fall through to live compute
  }

  const info = computeVersion();
  return res.json(info);
});

export default router;
