import express, { Express } from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { connectDB } from './config/database.js';
import { config } from './config/env.js';
import songRoutes from './routes/songs.js';
import { Song } from './models/Song.js';
import versionRoutes from './routes/version.js';

// The API package is ESM ("type": "module"), so `__dirname` is not defined at
// runtime. Derive it from import.meta.url (same pattern as
// src/api/scripts/import-apple-music.ts).
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app: Express = express();
const PORT = config.apiPort;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Connect to MongoDB
connectDB();

// Routes
app.use('/api/songs', songRoutes);
app.use('/api/version', versionRoutes);

const HEALTH_DB_TIMEOUT_MS = 2000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

/**
 * Health is end-to-end, not just liveness: the API can be up while MongoDB is
 * gone or the Library is empty, and both look "running" to a process check.
 * Report the database state and real Library signals (song count, last change)
 * so `cratecaddy status` can tell the truth.
 */
app.get('/health', async (_req, res) => {
  if (mongoose.connection.readyState !== 1) {
    res.status(503).json({ status: 'degraded', database: { connected: false } });
    return;
  }

  try {
    const [songs, newest] = await withTimeout(
      Promise.all([
        Song.countDocuments(),
        Song.findOne().sort({ updatedAt: -1 }).select({ updatedAt: 1 }).lean<{ updatedAt?: Date }>(),
      ]),
      HEALTH_DB_TIMEOUT_MS,
      'Library check',
    );

    res.json({
      status: songs > 0 ? 'ok' : 'empty',
      database: {
        connected: true,
        songs,
        newestUpdate: newest?.updatedAt ?? null,
      },
    });
  } catch (error) {
    res.status(503).json({
      status: 'degraded',
      database: { connected: true },
      error: error instanceof Error ? error.message : 'Library check failed',
    });
  }
});

// Static UI (prod build). Served after API routes, before app.listen.
const staticPath = path.join(__dirname, 'static');
if (fs.existsSync(staticPath)) {
  app.use(express.static(staticPath));
  // SPA fallback — must come after express.static and API routes
  app.get('*', (req, res) => {
    res.sendFile(path.join(staticPath, 'index.html'));
  });
}

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
