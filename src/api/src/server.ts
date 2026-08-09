import express, { Express } from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { connectDB } from './config/database.js';
import { config } from './config/env.js';
import songRoutes from './routes/songs.js';

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

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
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
