import { Request, Response } from 'express';
import { songService, normalizeGenres } from '../services/songService.js';
import {
  ApiFilterParams,
  ApiPaginationParams,
  FILTER_PARAM_KEYS,
  PAGINATION_PARAM_KEYS,
} from '../helpers/apiParams.js';
import { IHistorySnapshot } from '../models/History.js';

function extractFilterParams(query: Record<string, unknown>): ApiFilterParams {
  const filters: ApiFilterParams = {};
  for (const key of FILTER_PARAM_KEYS) {
    const val = query[key];
    if (typeof val === 'string') {
      filters[key] = val;
    }
  }
  return filters;
}

function extractPaginationParams(query: Record<string, unknown>): ApiPaginationParams {
  const pagination: ApiPaginationParams = {};
  for (const key of PAGINATION_PARAM_KEYS) {
    const val = query[key];
    if (typeof val === 'string') {
      pagination[key] = val;
    }
  }
  return pagination;
}

export class SongController {
  async getAllSongs(req: Request, res: Response) {
    try {
      const filters = extractFilterParams(req.query as Record<string, unknown>);
      const pagination = extractPaginationParams(req.query as Record<string, unknown>);
      const result = await songService.querySongs({ filters, pagination });
      const data = result.data.map((song: any) => ({
        ...(song.toObject ? song.toObject() : song),
        genres: normalizeGenres(song.genres || []),
      }));
      res.json({ ...result, data });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch songs' });
    }
  }

  async getSongById(req: Request, res: Response) {
    try {
      const song = await songService.getSongById(req.params.id);
      if (!song) {
        res.status(404).json({ error: 'Song not found' });
        return;
      }
      const normalizedSong = {
        ...song.toObject(),
        genres: normalizeGenres(song.genres),
      };
      res.json(normalizedSong);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch song' });
    }
  }

  async createSong(req: Request, res: Response) {
    try {
      const { name, artist, genres } = req.body;
      if (!name || !artist) {
        res.status(400).json({ error: 'Missing required fields' });
        return;
      }
      const song = await songService.createSong({ title: name, artist, genres: genres || [] });
      res.status(201).json(song);
    } catch (error) {
      res.status(500).json({ error: 'Failed to create song' });
    }
  }

  async updateSong(req: Request, res: Response) {
    try {
      const song = await songService.updateSong(req.params.id, req.body);
      if (!song) {
        res.status(404).json({ error: 'Song not found' });
        return;
      }
      res.json(song);
    } catch (error) {
      res.status(500).json({ error: 'Failed to update song' });
    }
  }

  async deleteSong(req: Request, res: Response) {
    try {
      const song = await songService.deleteSong(req.params.id);
      if (!song) {
        res.status(404).json({ error: 'Song not found' });
        return;
      }
      res.json({ message: 'Song deleted' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete song' });
    }
  }

  async updateMetadata(req: Request, res: Response) {
    try {
      const song = await songService.updateSongMetadata(req.params.id, req.body);
      if (!song) {
        res.status(404).json({ error: 'Song not found' });
        return;
      }
      res.json(song);
    } catch (error) {
      res.status(500).json({ error: 'Failed to update metadata' });
    }
  }

  private readonly ALLOWED_BATCH_FIELDS = new Set([
    'artist', 'genres', 'grouping', 'bpm', 'key', 'year', 'rating',
  ]);

  private sanitiseBatchData(data: Record<string, unknown>): Record<string, unknown> {
    const clean: Record<string, unknown> = {};
    for (const key of Object.keys(data)) {
      if (this.ALLOWED_BATCH_FIELDS.has(key)) {
        clean[key] = data[key];
      }
    }
    return clean;
  }

  async updateMetadataBatch(req: Request, res: Response) {
    try {
      const { updates } = req.body as { updates: { id: string; data: Record<string, unknown> }[] };
      if (!Array.isArray(updates) || updates.length === 0) {
        res.status(400).json({ error: 'Missing or empty updates array' });
        return;
      }

      const updated: Record<string, unknown>[] = [];
      const errors: { id: string; error: string }[] = [];

      for (const { id, data } of updates) {
        try {
          const sanitised = this.sanitiseBatchData(data);
          if (Object.keys(sanitised).length === 0) continue;
          const song = await songService.updateSongMetadata(id, sanitised);
          if (song) {
            updated.push(song.toObject ? song.toObject() : song);
          } else {
            errors.push({ id, error: 'Song not found' });
          }
        } catch (err) {
          errors.push({ id, error: err instanceof Error ? err.message : 'Unknown error' });
        }
      }

      res.json({ success: true, updated, errors });
    } catch (error) {
      res.status(500).json({ error: 'Failed to update batch metadata' });
    }
  }

  async writeToAppleMusic(req: Request, res: Response) {
    try {
      const result = await songService.writeToAppleMusic(req.params.id);
      if (result.success) {
        res.json(result);
      } else {
        // Partial success (wrote to some targets but not all) is still a success
        // from the user's perspective — the metadata was written. Log the failure
        // but return 200 so the UI shows the message rather than a generic error.
        console.error(`[writeToAppleMusic] partial failure for ${req.params.id}: ${result.message}`);
        res.json(result);
      }
    } catch (error) {
      console.error(`[writeToAppleMusic] 500 for ${req.params.id}:`, error);
      res.status(500).json({ error: 'Failed to write to Apple Music' });
    }
  }

  async writeToAppleMusicBatch(req: Request, res: Response) {
    try {
      const { ids } = req.body as { ids: string[] };
      if (!Array.isArray(ids) || ids.length === 0) {
        res.status(400).json({ error: 'ids array is required' });
        return;
      }
      const result = await songService.writeToAppleMusicBatch(ids);
      const failures = result.results.filter(r => !r.success);
      if (failures.length > 0) {
        console.error(`[writeToAppleMusicBatch] ${failures.length}/${ids.length} failed:`, failures.map(f => `${f.id}: ${f.message}`).join('; '));
      }
      res.json(result);
    } catch (error) {
      console.error(`[writeToAppleMusicBatch] 500:`, error);
      res.status(500).json({ error: 'Failed to write to Apple Music' });
    }
  }

  async getHistory(req: Request, res: Response) {
    try {
      const history = await songService.getHistory(req.params.id);

      const diffFields: (keyof IHistorySnapshot)[] = [
        'title', 'artist', 'genres', 'grouping',
        'bpm', 'key', 'rating', 'year', 'favorite',
      ];

      type SnapshotDiff = { field: string; value: string | string[] };

      const withDiffs = history.map((entry, i) => {
        const obj = entry.toObject();
        let diffs: SnapshotDiff[] = [];
        if (i > 0) {
          const prev = history[i - 1].snapshot;
          for (const field of diffFields) {
            const curr = obj.snapshot[field];
            const prevVal = prev[field];
            if (JSON.stringify(curr) !== JSON.stringify(prevVal)) {
              if (Array.isArray(curr)) {
                diffs.push({ field, value: curr.slice() });
              } else if (curr !== undefined && curr !== null && curr !== '') {
                diffs.push({ field, value: String(curr) });
              }
            }
          }
        }
        return { ...obj, diff: diffs };
      });

      res.json(withDiffs);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch history' });
    }
  }

  async getGenreStats(req: Request, res: Response) {
    try {
      const filters = extractFilterParams(req.query as Record<string, unknown>);
      const stats = await songService.getFilteredGenreStats(filters);
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch genre stats' });
    }
  }
}

export const songController = new SongController();
