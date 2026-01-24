import { Song, ISong, ISource } from '../models/Song.js';

/**
 * Normalize text for fuzzy matching
 * - Trim whitespace
 * - Convert to lowercase
 * - Remove/replace punctuation
 * - Normalize unicode characters
 */
export function normalizeText(text: string): string {
  if (!text) return '';
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

export class SongService {
  async getAllSongs(): Promise<ISong[]> {
    return await Song.find().sort({ createdAt: -1 });
  }

  async getSongById(id: string): Promise<ISong | null> {
    return await Song.findById(id);
  }

  /**
   * Find matching song using fuzzy matching on artist, title, and duration
   * @param artist - Artist name
   * @param title - Song title
   * @param duration - Duration in milliseconds (optional)
   * @returns Matching song or null if not found
   */
  async findMatchingSong(
    artist: string,
    title: string,
    duration?: number
  ): Promise<ISong | null> {
    const normalizedArtist = normalizeText(artist);
    const normalizedTitle = normalizeText(title);

    if (!normalizedArtist || !normalizedTitle) {
      return null;
    }

    // Fetch candidates - use case-insensitive regex for initial filtering
    // Then filter in memory for exact normalized match
    const query: any = {
      artist: { $regex: normalizedArtist.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' },
      title: { $regex: normalizedTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' },
    };

    // Add duration matching if provided (within ±2000ms tolerance)
    if (duration && duration > 0) {
      query.duration = {
        $gte: duration - 2000,
        $lte: duration + 2000,
      };
    }

    const candidates = await Song.find(query);

    if (candidates.length === 0) {
      return null;
    }

    // Filter to exact normalized matches
    const matches = candidates.filter((song) => {
      const songArtist = normalizeText(song.artist || '');
      const songTitle = normalizeText(song.title || '');
      return songArtist === normalizedArtist && songTitle === normalizedTitle;
    });

    if (matches.length === 0) {
      return null;
    }

    // If duration provided, prefer exact match, otherwise return first match
    if (duration && duration > 0) {
      const exactMatch = matches.find(
        (song) => song.duration && Math.abs(song.duration - duration) < 1000
      );
      if (exactMatch) return exactMatch;
    }

    return matches[0];
  }

  /**
   * Merge song data from incoming source with existing song
   * @param existing - Existing song document
   * @param incoming - Incoming song data
   * @param newSource - New source to add/update
   * @returns Merged song data
   */
  mergeSongData(
    existing: ISong,
    incoming: Partial<ISong>,
    newSource: ISource
  ): Partial<ISong> {
    const merged: Partial<ISong> = {
      ...existing.toObject(),
    };

    // Merge arrays (union - add new unique elements)
    if (incoming.genres) {
      const existingGenres = new Set(existing.genres || []);
      incoming.genres.forEach((g) => existingGenres.add(g));
      merged.genres = Array.from(existingGenres);
    }

    if (incoming.grouping) {
      const existingGrouping = new Set(existing.grouping || []);
      incoming.grouping.forEach((g) => existingGrouping.add(g));
      merged.grouping = Array.from(existingGrouping);
    }

    // Prefer new values for simple fields if provided
    if (incoming.bpm !== undefined && incoming.bpm !== null) {
      merged.bpm = incoming.bpm;
    }
    if (incoming.year !== undefined && incoming.year !== null) {
      merged.year = incoming.year;
    }
    if (incoming.rating !== undefined && incoming.rating !== null) {
      merged.rating = incoming.rating;
    }
    if (incoming.key !== undefined && incoming.key !== null && incoming.key !== '') {
      merged.key = incoming.key;
    }
    if (incoming.duration !== undefined && incoming.duration !== null && incoming.duration > 0) {
      // Prefer more precise duration (non-zero)
      if (!merged.duration || merged.duration === 0) {
        merged.duration = incoming.duration;
      }
    }
    if (incoming.album !== undefined && incoming.album !== null && incoming.album !== '') {
      merged.album = incoming.album;
    }

    // Merge sources array
    const existingSources = [...(existing.sources || [])];
    
    // Check if source already exists (by sourceType + filePath or sourceMetadata.id)
    const sourceKey = newSource.sourceMetadata?.id || newSource.filePath;
    const existingIndex = existingSources.findIndex((s) => {
      if (s.sourceType === newSource.sourceType) {
        if (sourceKey && s.sourceMetadata?.id === sourceKey) return true;
        if (newSource.filePath && s.filePath === newSource.filePath) return true;
      }
      return false;
    });

    if (existingIndex >= 0) {
      // Update existing source
      existingSources[existingIndex] = newSource;
    } else {
      // Add new source
      existingSources.push(newSource);
    }

    merged.sources = existingSources;

    return merged;
  }

  /**
   * Upsert song with merge logic and source management
   * @param artist - Artist name
   * @param title - Song title
   * @param duration - Duration in milliseconds
   * @param songData - Song data to merge
   * @param source - Source information
   * @returns Created or updated song
   */
  async upsertSongWithMerge(
    artist: string,
    title: string,
    duration: number | undefined,
    songData: Partial<ISong>,
    source: ISource
  ): Promise<ISong> {
    // Try to find existing song
    const existing = await this.findMatchingSong(artist, title, duration);

    if (existing) {
      // Merge with existing song
      const merged = this.mergeSongData(existing, songData, source);
      return await Song.findByIdAndUpdate(existing._id, merged, { new: true });
    } else {
      // Create new song
      const newSong = new Song({
        ...songData,
        artist,
        title,
        duration,
        sources: [source],
      });
      return await newSong.save();
    }
  }

  async createSong(data: Partial<ISong>): Promise<ISong> {
    const song = new Song(data);
    return await song.save();
  }

  async updateSong(id: string, data: Partial<ISong>): Promise<ISong | null> {
    return await Song.findByIdAndUpdate(id, data, { new: true });
  }

  async deleteSong(id: string): Promise<ISong | null> {
    return await Song.findByIdAndDelete(id);
  }

  async getGenreStats(): Promise<Array<{ genre: string; count: number }>> {
    const result = await Song.aggregate([
      { $unwind: '$genres' },
      { $group: { _id: '$genres', count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
      { $project: { genre: '$_id', count: 1, _id: 0 } },
    ]);
    return result;
  }
}

export const songService = new SongService();
