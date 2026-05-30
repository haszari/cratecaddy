import { Song, ISong, ISource, SourceFormat } from '../models/Song.js';
import { HistoryEntry, IHistoryEntry } from '../models/History.js';
import { buildSongFilter } from '../helpers/buildSongFilter.js';
import { ApiFilterParams, ApiPaginationParams } from '../helpers/apiParams.js';
import { parsePagination, PaginationResult } from '../helpers/pagination.js';
import { buildShuffleHashFunction } from '../helpers/shuffleHash.js';

/**
 * Normalize artist and title for database matching
 * - Combine artist + title with space
 * - Trim whitespace, convert to lowercase
 * - Remove "original mix" (case-insensitive)
 * - Remove punctuation using unicode-aware regex (keeps letters, numbers, whitespace)
 * - Normalize whitespace
 */
export function normalizeArtistTitle(artist: string, title: string): string {
  if (!artist || !title) return '';

  return `${artist} ${title}`
    .trim()
    .toLowerCase()
    .replace(/\boriginal mix\b/g, '')
    .replace(/[^\p{Letter}\p{Number}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalize genres array
 * - Trim whitespace from each genre
 * - Remove empty strings
 * - Remove duplicates (case-sensitive)
 */
export function normalizeGenres(genres: string[]): string[] {
  const seen = new Set<string>();
  return genres
    .map((g) => g.trim())
    .filter((g) => g !== '')
    .filter((g) => {
      if (seen.has(g)) return false;
      seen.add(g);
      return true;
    });
}

/**
 * Legacy function for backward compatibility - use normalizeArtistTitle instead
 */
export function normalizeText(text: string): string {
  if (!text) return '';
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
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
   * Find matching song using database-level normalization
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
    const normalizedArtistTitle = normalizeArtistTitle(artist, title);

    if (!normalizedArtistTitle) {
      return null;
    }

    const query: any = {
      artistTitleNormalized: normalizedArtistTitle,
    };

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

    if (duration && duration > 0) {
      const exactMatch = candidates.find(
        (song) => song.duration && Math.abs(song.duration - duration) < 1000
      );
      if (exactMatch) return exactMatch;
    }

    return candidates[0];
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
      if (!merged.duration || merged.duration === 0) {
        merged.duration = incoming.duration;
      }
    }
    if (incoming.album !== undefined && incoming.album !== null && incoming.album !== '') {
      merged.album = incoming.album;
    }

    const existingSources = [...(existing.sources || [])];

    const sourceKey = newSource.sourceMetadata?.id || newSource.filePath;
    const existingIndex = existingSources.findIndex((s) => {
      if (s.sourceType === newSource.sourceType) {
        if (sourceKey && s.sourceMetadata?.id === sourceKey) return true;
        if (newSource.filePath && s.filePath === newSource.filePath) return true;
      }
      return false;
    });

    if (existingIndex >= 0) {
      existingSources[existingIndex] = newSource;
    } else {
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
    const existing = await this.findMatchingSong(artist, title, duration);

    if (existing) {
      const merged = this.mergeSongData(existing, songData, source);
      const updated = await Song.findByIdAndUpdate(existing._id, merged, { new: true });
      if (!updated) {
        throw new Error(`Failed to update song with id ${existing._id}`);
      }
      return updated;
    } else {
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

  async updateWithHistory(
    artist: string,
    title: string,
    duration: number | undefined,
    songData: {
      genres?: string[];
      grouping?: string[];
      bpm?: number;
      key?: string;
      rating?: number;
      year?: number;
      album?: string;
      appleMusicId?: string;
      favorite?: 'starred' | 'normal' | 'disliked';
    },
    source: {
      sourceType: 'applemusic' | 'rekordbox' | 'djaypro' | 'manual';
      format?: SourceFormat;
      appleMusicId?: string;
      filePath?: string;
      importMeta?: Record<string, unknown>;
    }
  ): Promise<ISong> {
    const existing = await this.findMatchingSong(artist, title, duration);

    if (existing) {
      const existingSources = [...(existing.sources || [])];
      const existingIndex = existingSources.findIndex((s) => {
        if (s.sourceType === source.sourceType) {
          if (source.appleMusicId && s.appleMusicId === source.appleMusicId) return true;
          if (source.filePath && s.filePath === source.filePath) return true;
        }
        return false;
      });

      const newSourceEntry: ISource = {
        sourceType: source.sourceType,
        lastImportDate: new Date(),
      };
      if (source.format) newSourceEntry.format = source.format;
      if (source.appleMusicId) newSourceEntry.appleMusicId = source.appleMusicId;
      if (source.filePath) newSourceEntry.filePath = source.filePath;
      if (source.importMeta) newSourceEntry.sourceMetadata = source.importMeta;

      if (existingIndex >= 0) {
        existingSources[existingIndex] = newSourceEntry;
      } else {
        existingSources.push(newSourceEntry);
      }

      const song = await Song.findById(existing._id);
      if (!song) throw new Error(`Failed to find song with id ${existing._id}`);

      if (songData.genres !== undefined) song.genres = songData.genres;
      if (songData.grouping !== undefined) song.grouping = songData.grouping;
      if (songData.bpm !== undefined) song.bpm = songData.bpm;
      if (songData.key !== undefined) song.key = songData.key;
      if (songData.rating !== undefined) song.rating = songData.rating;
      if (songData.year !== undefined) song.year = songData.year;
      if (songData.album !== undefined) song.album = songData.album;
      if (songData.appleMusicId !== undefined) song.appleMusicId = songData.appleMusicId;
      if (songData.favorite !== undefined) song.favorite = songData.favorite;
      song.sources = existingSources;

      const saved = await song.save();

      await HistoryEntry.create({
        songId: saved._id,
        dateEdited: new Date(),
        sourceType: source.sourceType,
        snapshot: {
          title: saved.title,
          artist: saved.artist,
          genres: saved.genres,
          grouping: saved.grouping,
          bpm: saved.bpm,
          key: saved.key,
          rating: saved.rating,
          year: saved.year,
          favorite: saved.favorite,
        },
        importMeta: source.importMeta,
      });

      return saved;
    }

    const newSong = new Song({
      artist,
      title,
      duration,
      genres: songData.genres || [],
      grouping: songData.grouping || [],
      bpm: songData.bpm,
      key: songData.key,
      rating: songData.rating,
      year: songData.year,
      album: songData.album,
      appleMusicId: songData.appleMusicId || source.appleMusicId,
      sources: [{
        sourceType: source.sourceType,
        format: source.format,
        appleMusicId: source.appleMusicId,
        filePath: source.filePath,
        sourceMetadata: source.importMeta,
        lastImportDate: new Date(),
      }],
    });

    const saved = await newSong.save();

    await HistoryEntry.create({
      songId: saved._id,
      dateEdited: new Date(),
      sourceType: source.sourceType,
      snapshot: {
        title: saved.title,
        artist: saved.artist,
        genres: saved.genres,
        grouping: saved.grouping,
        bpm: saved.bpm,
        key: saved.key,
        rating: saved.rating,
        year: saved.year,
        favorite: saved.favorite,
      },
      importMeta: source.importMeta,
    });

    return saved;
  }

  async getHistory(songId: string): Promise<IHistoryEntry[]> {
    return await HistoryEntry.find({ songId }).sort({ dateEdited: -1 });
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

  async querySongs(params: {
    filters: ApiFilterParams;
    pagination: ApiPaginationParams;
  }): Promise<{ data: ISong[]; page: number; limit: number; total: number; totalPages: number; shuffleSeed?: string }> {
    const filter = buildSongFilter(params.filters);
    const { page, limit, skip, shuffleSeed } = parsePagination(params.pagination);

    if (shuffleSeed) {
      const pipeline: any[] = [];
      if (Object.keys(filter).length > 0) pipeline.push({ $match: filter });

      const hashFn = buildShuffleHashFunction(shuffleSeed);

      pipeline.push({
        $addFields: {
          _sortKey: { $function: { body: hashFn, args: [{ $toString: '$_id' }], lang: 'js' } },
        },
      });
      pipeline.push({ $sort: { _sortKey: 1 } });
      pipeline.push({ $skip: skip });
      pipeline.push({ $limit: limit });

      const [data, total] = await Promise.all([
        Song.aggregate(pipeline),
        Song.countDocuments(filter),
      ]);

      return { data, page, limit, total, totalPages: Math.ceil(total / limit), shuffleSeed };
    }

    const [data, total] = await Promise.all([
      Song.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Song.countDocuments(filter),
    ]);

    return {
      data,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getFilteredGenreStats(filters: ApiFilterParams): Promise<
    Array<{ genre: string; count: number }>
  > {
    const filter = buildSongFilter(filters);
    const pipeline: any[] = [];

    if (Object.keys(filter).length > 0) {
      pipeline.push({ $match: filter });
    }

    pipeline.push(
      { $unwind: '$genres' },
      { $group: { _id: '$genres', count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
      { $project: { genre: '$_id', count: 1, _id: 0 } },
    );

    const result = await Song.aggregate(pipeline);
    return result;
  }
}

export const songService = new SongService();
