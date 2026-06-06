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

function unionMerge(existing: string[], incoming: string[]): string[] {
  const seen = new Set(existing);
  return [...existing, ...incoming.filter((x) => !seen.has(x))];
}

function favoriteRank(fav?: 'starred' | 'normal' | 'disliked'): number {
  if (fav === 'starred') return 2;
  if (fav === 'disliked') return 1;
  return 0;
}

function formatRank(format?: SourceFormat): number {
  const ranking: Record<string, number> = {
    aiff: 5,
    wav: 4,
    aac: 3,
    mp3: 2,
    alac: 1,
    applemusicstream: 0,
  };
  return format ? ranking[format] ?? -1 : -1;
}

function getMostRecentSourceDate(sources: ISource[]): Date | undefined {
  let mostRecent: Date | undefined;
  for (const s of sources) {
    if (s.dateModified && (!mostRecent || s.dateModified > mostRecent)) {
      mostRecent = s.dateModified;
    }
  }
  return mostRecent;
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

      const importMetaDate = source.importMeta?.dateModified;
      const incomingDate = importMetaDate instanceof Date ? importMetaDate : undefined;

      const newSourceEntry: ISource = {
        sourceType: source.sourceType,
        lastImportDate: new Date(),
      };
      if (source.format) newSourceEntry.format = source.format;
      if (source.appleMusicId) newSourceEntry.appleMusicId = source.appleMusicId;
      if (source.filePath) newSourceEntry.filePath = source.filePath;
      if (incomingDate) newSourceEntry.dateModified = incomingDate;
      if (source.importMeta) newSourceEntry.sourceMetadata = source.importMeta;

      if (existingIndex >= 0) {
        existingSources[existingIndex] = newSourceEntry;
      } else {
        existingSources.push(newSourceEntry);
      }

      const song = await Song.findById(existing._id);
      if (!song) throw new Error(`Failed to find song with id ${existing._id}`);

      // Multi-value fields: union merge
      if (songData.genres !== undefined) {
        song.genres = unionMerge(song.genres, songData.genres);
      }
      if (songData.grouping !== undefined) {
        song.grouping = unionMerge(song.grouping, songData.grouping);
      }

      // Favorite: max rank wins
      if (songData.favorite !== undefined) {
        if (favoriteRank(songData.favorite) > favoriteRank(song.favorite)) {
          song.favorite = songData.favorite;
        }
      }

      // Single-value fields: existing holds; incoming fills nulls;
      // if both non-null and differ, most-recent dateModified wins
      const existingDate = getMostRecentSourceDate(existingSources);

      function mergeField<T>(
        current: T | undefined,
        incoming: T | undefined,
        set: (val: T) => void,
      ): void {
        if (incoming === undefined) return;
        if (current === undefined) { set(incoming); return; }
        if (current !== incoming && incomingDate && existingDate) {
          if (incomingDate > existingDate) {
            set(incoming);
          }
        }
      }

      mergeField(song.bpm, songData.bpm, (v) => { song.bpm = v; });
      mergeField(song.key, songData.key, (v) => { song.key = v; });
      mergeField(song.rating, songData.rating, (v) => { song.rating = v; });
      mergeField(song.year, songData.year, (v) => { song.year = v; });
      mergeField(song.album, songData.album, (v) => { song.album = v; });

      // appleMusicIds: accumulate
      if (source.appleMusicId) {
        const existingIds = song.appleMusicIds || [];
        if (!existingIds.includes(source.appleMusicId)) {
          existingIds.push(source.appleMusicId);
        }
        song.appleMusicIds = existingIds;
      }

      // appleMusicId (canonical): elected by format hierarchy
      if (source.appleMusicId && source.format) {
        const currentRank = formatRank(
          song.appleMusicId
            ? existingSources.find((s) => s.appleMusicId === song.appleMusicId)?.format
            : undefined,
        );
        const incomingRank = formatRank(source.format);
        if (incomingRank > currentRank) {
          song.appleMusicId = source.appleMusicId;
        } else if (!song.appleMusicId) {
          song.appleMusicId = source.appleMusicId;
        }
      }

      song.sources = existingSources;

      const saved = await song.save();

      await this.pushHistory(saved, source.sourceType, source.importMeta);

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
      appleMusicIds: source.appleMusicId ? [source.appleMusicId] : [],
      sources: [{
        sourceType: source.sourceType,
        format: source.format,
        appleMusicId: source.appleMusicId,
        filePath: source.filePath,
        dateModified: source.importMeta?.dateModified instanceof Date ? source.importMeta.dateModified : undefined,
        sourceMetadata: source.importMeta,
        lastImportDate: new Date(),
      }],
    });

    const saved = await newSong.save();

    await this.pushHistory(saved, source.sourceType, source.importMeta);

    return saved;
  }

  async updateSongMetadata(
    id: string,
    songData: {
      artist?: string;
      title?: string;
      genres?: string[];
      grouping?: string[];
      bpm?: number;
      key?: string;
      rating?: number;
      year?: number;
      favorite?: 'starred' | 'normal' | 'disliked';
    }
  ): Promise<ISong | null> {
    const song = await Song.findById(id);
    if (!song) return null;

    if (songData.artist !== undefined) song.artist = songData.artist;
    if (songData.title !== undefined) song.title = songData.title;
    if (songData.genres !== undefined) song.genres = songData.genres;
    if (songData.grouping !== undefined) song.grouping = songData.grouping;
    if (songData.bpm !== undefined) song.bpm = songData.bpm;
    if (songData.key !== undefined) song.key = songData.key;
    if (songData.rating !== undefined) song.rating = songData.rating;
    if (songData.year !== undefined) song.year = songData.year;
    if (songData.favorite !== undefined) song.favorite = songData.favorite;

    const saved = await song.save();
    await this.pushHistory(saved, 'manual');
    return saved;
  }

  async getHistory(songId: string): Promise<IHistoryEntry[]> {
    return await HistoryEntry.find({ songId }).sort({ dateEdited: -1 });
  }

  async writeToAppleMusic(songId: string): Promise<{ success: boolean; message: string }> {
    const song = await Song.findById(songId);
    if (!song) return { success: false, message: 'Song not found' };

    const { writeToAppleMusic: runWrite } = await import('./appleMusicWrite.js');
    return runWrite(song);
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
    const { page, limit, skip, shuffleSeed, sort, sortDirection } = parsePagination(params.pagination);

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

    const sortObj: Record<string, 1 | -1> = sort
      ? { [sort]: sortDirection === 'desc' ? -1 : 1 }
      : { rating: -1 };

    const [data, total] = await Promise.all([
      Song.find(filter).sort(sortObj).skip(skip).limit(limit),
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

  private async pushHistory(
    song: ISong,
    sourceType: 'applemusic' | 'rekordbox' | 'djaypro' | 'manual',
    importMeta?: Record<string, unknown>,
  ): Promise<void> {
    const snapshot: IHistorySnapshot = {
      title: song.title,
      artist: song.artist,
      genres: song.genres,
      grouping: song.grouping,
      bpm: song.bpm,
      key: song.key,
      rating: song.rating,
      year: song.year,
      favorite: song.favorite,
    };

    const lastEntry = await HistoryEntry.findOne({ songId: song._id })
      .sort({ dateEdited: -1 });

    if (lastEntry) {
      const snapFields: (keyof IHistorySnapshot)[] = [
        'title', 'artist', 'genres', 'grouping',
        'bpm', 'key', 'rating', 'year', 'favorite',
      ];
      const same = snapFields.every(
        f => JSON.stringify(lastEntry.snapshot[f]) === JSON.stringify(snapshot[f]),
      );
      if (same) return;

      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
      if (lastEntry.sourceType === sourceType && lastEntry.dateEdited > fiveMinAgo) {
        lastEntry.snapshot = snapshot;
        lastEntry.dateEdited = new Date();
        await lastEntry.save();
        return;
      }
    }

    await HistoryEntry.create({
      songId: song._id,
      dateEdited: new Date(),
      sourceType,
      entryType: lastEntry ? 'update' : 'create',
      snapshot,
      ...(importMeta ? { importMeta } : {}),
    });
  }
}

export const songService = new SongService();
