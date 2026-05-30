import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IHistorySnapshot {
  title: string;
  artist: string;
  genres: string[];
  grouping: string[];
  bpm?: number;
  key?: string;
  rating?: number;
  year?: number;
  favorite?: 'starred' | 'normal' | 'disliked';
}

export interface IHistoryEntry extends Document {
  songId: Types.ObjectId;
  dateEdited: Date;
  sourceType: 'applemusic' | 'rekordbox' | 'djaypro' | 'manual';
  snapshot: IHistorySnapshot;
  importMeta?: Record<string, unknown>;
}

const snapshotSchema = new Schema<IHistorySnapshot>(
  {
    title: { type: String, required: true, trim: true },
    artist: { type: String, required: true, trim: true },
    genres: { type: [String], default: [] },
    grouping: { type: [String], default: [] },
    bpm: Number,
    key: { type: String, trim: true },
    rating: Number,
    year: Number,
    favorite: {
      type: String,
      enum: ['starred', 'normal', 'disliked'],
    },
  },
  { _id: false }
);

const historyEntrySchema = new Schema<IHistoryEntry>(
  {
    songId: {
      type: Schema.Types.ObjectId,
      ref: 'Song',
      required: true,
    },
    dateEdited: {
      type: Date,
      required: true,
      default: () => new Date(),
    },
    sourceType: {
      type: String,
      required: true,
      enum: ['applemusic', 'rekordbox', 'djaypro', 'manual'],
    },
    snapshot: {
      type: snapshotSchema,
      required: true,
    },
    importMeta: {
      type: Schema.Types.Mixed,
    },
  },
  {
    timestamps: false,
  }
);

historyEntrySchema.index({ songId: 1, dateEdited: -1 });

export const HistoryEntry = mongoose.model<IHistoryEntry>('HistoryEntry', historyEntrySchema);
