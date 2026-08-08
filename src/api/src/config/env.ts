import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Repo root, resolved from this module's location (never process.cwd()), so
// config loading works regardless of which directory launches the process.
// This module lives at <root>/src/api/src/config/env.ts, so four levels up.
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../');

// Load the repo-root .env for dev (npm run dev / npm run import:*). The prod
// CLI exports its own config before spawning this process and sets
// NODE_ENV=production, so the dev .env is never read into the prod API. dotenv
// never overrides vars already in the environment, so CLI exports always win.
if (process.env.NODE_ENV !== 'production') {
  dotenv.config({ path: path.join(repoRoot, '.env') });
}

export const config = {
  repoRoot,
  mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/cratecaddy',
  apiPort: Number(process.env.API_PORT) || 7625,
};
