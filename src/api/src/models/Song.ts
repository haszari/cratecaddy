import mongoose, { Schema, Document } from 'mongoose';
import { normalizeArtistTitle, normalizeGenres } from '../services/songService.js';

export type SourceFormat = 'aiff' | 'wav' | 'alac' | 'aac' | 'mp3' | 'applemusicstream';

export interface ISource {
  sourceType: 'applemusic' | 'rekordbox' | 'djaypro' | 'local' | 'manual';
  format?: SourceFormat;
  appleMusicId?: string;
  filePath?: string;
  fileSize?: number;
  bitRate?: number;
  fileType?: string;
  dateModified?: Date;
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
  favorite?: 'starred' | 'normal' | 'disliked'; // Triage marker
  artistTitleNormalized: string; // Normalized artist + title for fast matching
  canonicalAppleMusicId?: string; // Primary Apple Music persistent ID for this track.
                                  // Elected by format hierarchy; always one of appleMusicIds.
  appleMusicIds: string[];        // All known Apple Music persistent IDs from import sources.
                                  // Used for cross-source matching.
  sources: ISource[];
  createdAt: Date;
  updatedAt: Date;
}

const sourceSchema = new Schema<ISource>(
  {
    sourceType: {
      type: String,
      required: true,
      enum: ['applemusic', 'rekordbox', 'djaypro', 'local', 'manual'],
    },
    format: {
      type: String,
      enum: ['aiff', 'wav', 'alac', 'aac', 'mp3', 'applemusicstream'],
    },
    appleMusicId: {
      type: String,
      trim: true,
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
    dateModified: {
      type: Date,
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
    favorite: {
      type: String,
      enum: ['starred', 'normal', 'disliked'],
    },
    canonicalAppleMusicId: {
      type: String,
      trim: true,
      index: true,
    },
    appleMusicIds: {
      type: [String],
      default: [],
    },
    artistTitleNormalized: {
      type: String,
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

// Pre-validate middleware to auto-populate artistTitleNormalized and normalize genres
// Runs before validation so required checks pass
songSchema.pre('validate', function(next) {
  if (this.isModified('artist') || this.isModified('title') || this.isNew) {
    this.artistTitleNormalized = normalizeArtistTitle(this.artist, this.title);
  }

  // Normalize genres: trim whitespace and remove duplicates (case-sensitive)
  if (this.isModified('genres') || this.isNew) {
    this.genres = normalizeGenres(this.genres);
  }

  next();
});

export const Song = mongoose.model<ISong>('Song', songSchema);
