import { Song, ISong } from '../models/Song.js';

export class SongService {
  async getAllSongs(): Promise<ISong[]> {
    return await Song.find().sort({ createdAt: -1 });
  }

  async getSongById(id: string): Promise<ISong | null> {
    return await Song.findById(id);
  }

  async getSongByTrackId(trackId: string): Promise<ISong | null> {
    return await Song.findOne({ trackId });
  }

  async createSong(data: Partial<ISong>): Promise<ISong> {
    const song = new Song(data);
    return await song.save();
  }

  async upsertSong(trackId: string, data: Partial<ISong>): Promise<ISong | null> {
    return await Song.findOneAndUpdate(
      { trackId },
      { ...data, lastImportDate: new Date() },
      { upsert: true, new: true }
    );
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
