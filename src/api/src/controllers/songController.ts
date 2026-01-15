import { Request, Response } from 'express';
import { songService } from '../services/songService.js';

export class SongController {
  async getAllSongs(req: Request, res: Response) {
    try {
      const songs = await songService.getAllSongs();
      res.json(songs);
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
      res.json(song);
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
      const song = await songService.createSong({ name, artist, genres: genres || [] });
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

  async getGenreStats(req: Request, res: Response) {
    try {
      const stats = await songService.getGenreStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch genre stats' });
    }
  }
}

export const songController = new SongController();
