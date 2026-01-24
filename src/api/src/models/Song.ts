import mongoose, { Schema, Document } from 'mongoose';
import { normalizeArtistTitle } from '../services/songService.js';

export interface ISource {
  sourceType: 'applemusic' | 'rekordbox' | 'djaypro' | 'local';
  filePath?: string;
  fileSize?: number;
  bitRate?: number;
  fileType?: string;
  sourceMetadata?: Record<string, any>;
  lastImportDate: Date;
}

export interface ISong extends Document {
  title: string;
  artist: string;
  album: string;
  duration?: number; // in milliseconds - used for matching
  genres: string[];
  grouping: string[];
  bpm?: number;
  year?: number;
  key?: string; // Musical key (e.g., "Am", "G", "F#m")
  rating?: number; // 0-5 scale (can be fractional)
  artistTitleNormalized: string; // Normalized artist + title for fast matching
  sources: ISource[];
  createdAt: Date;
  updatedAt: Date;
}

const sourceSchema = new Schema<ISource>(
  {
    sourceType: {
      type: String,
      required: true,
      enum: ['applemusic', 'rekordbox', 'djaypro', 'local'],
    },
    filePath: {
      type: String,
      trim: true,
    },
    fileSize: {
      type: Number,
    },
    bitRate: {
      type: Number,
    },
    fileType: {
      type: String,
      trim: true,
    },
    sourceMetadata: {
      type: Schema.Types.Mixed,
    },
    lastImportDate: {
      type: Date,
      default: () => new Date(),
    },
  },
  { _id: false }
);

const songSchema = new Schema<ISong>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    artist: {
      type: String,
      trim: true,
      index: true,
    },
    album: {
      type: String,
      trim: true,
    },
    duration: {
      type: Number, // milliseconds - used for matching
      index: true,
    },
    genres: {
      type: [String],
      default: [],
      index: true,
    },
    grouping: {
      type: [String],
      default: [],
    },
    bpm: {
      type: Number,
    },
    year: {
      type: Number,
    },
    key: {
      type: String,
      trim: true,
      index: true,
    },
    rating: {
      type: Number, // 0-5 scale (can be fractional)
    },
    artistTitleNormalized: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    sources: {
      type: [sourceSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for matching: normalized artist + title + duration
songSchema.index({ artistTitleNormalized: 1, duration: 1 });

// Pre-save middleware to auto-populate artistTitleNormalized
songSchema.pre('save', function(next) {
  if (this.isModified('artist') || this.isModified('title') || this.isNew) {
    this.artistTitleNormalized = normalizeArtistTitle(this.artist, this.title);
  }
  next();
});

export const Song = mongoose.model<ISong>('Song', songSchema);
