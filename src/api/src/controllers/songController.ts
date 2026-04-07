import { Request, Response } from 'express';
import { songService } from '../services/songService.js';
import mongoose from 'mongoose';
import { normalizeTokens } from '../services/songService.js';

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
      const { id } = req.params;

      // Validate MongoDB ObjectId
      if (!mongoose.Types.ObjectId.isValid(id)) {
        res.status(400).json({ error: 'Invalid song ID' });
        return;
      }

      const song = await songService.getSongById(id);
      if (!song) {
        res.status(404).json({ error: 'Song not found' });
        return;
      }
      res.json(song);
    } catch (error) {
      console.error('Error fetching song by ID:', error);
      res.status(500).json({ error: 'Failed to fetch song' });
    }
  }

  async createSong(req: Request, res: Response) {
    try {
      const { title, artist, genres } = req.body;
      if (!title || !artist) {
        res.status(400).json({ error: 'Missing required fields' });
        return;
      }
      const song = await songService.createSong({ title, artist, genres: genres || [] });
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

  async computeTokens(req: Request, res: Response) {
    try {
      console.log('computeTokens called with ID:', req.params.id);

      const song = await songService.getSongById(req.params.id);
      if (!song) {
        console.warn('Song not found for ID:', req.params.id);
        res.status(404).json({ error: 'Song not found' });
        return;
      }

      console.log('Song found:', song);

      const { artist, title } = song;
      console.log('Normalizing tokens for artist:', artist, 'and title:', title);

      const { artist: normalizedArtist, title: normalizedTitle, variations } = normalizeTokens(artist, title);

      console.log('Normalized tokens:', { normalizedArtist, normalizedTitle, variations });

      song.tokens = { artist: normalizedArtist, title: normalizedTitle, variations };
      await song.save();

      console.log('Tokens saved successfully for song ID:', req.params.id);
      res.json(song);
    } catch (error) {
      console.error('Error in computeTokens:', error);
      res.status(500).json({ error: 'Failed to compute tokens' });
    }
  }
}

export const songController = new SongController();
