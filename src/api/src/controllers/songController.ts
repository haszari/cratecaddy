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

  async writeToAppleMusic(req: Request, res: Response) {
    try {
      const result = await songService.writeToAppleMusic(req.params.id);
      if (result.success) {
        res.json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
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
