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

export interface ITokens {
  artist: string; // Normalized artist
  title: string; // Normalized title with variation info stripped
  variation?: string; // Normalized variation string (e.g., "Jimbob")
  variationType?: string; // Normalized variation type (e.g., "remix", "edit")
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
  tokens: ITokens; // Sub-structure for normalized tokens
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

const tokensSchema = new Schema<ITokens>(
  {
    artist: {
      type: String,
      required: true,
      trim: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    variation: {
      type: String,
      trim: true,
    },
    variationType: {
      type: String,
      trim: true,
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
    tokens: {
      type: tokensSchema,
      required: true,
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

// Pre-save middleware to auto-populate tokens
songSchema.pre('save', function(next) {
  if (this.isModified('artist') || this.isModified('title') || this.isNew) {
    const { artist, title, variation, variationType } = normalizeTokens(this.artist, this.title);
    this.tokens = { artist, title, variation, variationType };
  }
  next();
});

// Helper function to normalize tokens
function normalizeTokens(artist: string, title: string): ITokens {
  // Normalize artist
  const normalizedArtist = artist.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();

  // Normalize title and extract variation info
  const variationMatch = title.match(/\(([^)]+)\)|-\s*([^\-]+)$/i);
  const variation = variationMatch ? variationMatch[1] || variationMatch[2] : undefined;
  const variationType = variation ? extractVariationType(variation) : undefined;
  const normalizedTitle = title
    .toLowerCase()
    .replace(/\(([^)]+)\)|-\s*([^\-]+)$/i, '')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  return { artist: normalizedArtist, title: normalizedTitle, variation, variationType };
}

// Helper function to extract variation type
function extractVariationType(variation: string): string | undefined {
  const variationKeywords = ['remix', 'edit', 'version', 'radio', 'mix'];
  const lowerVariation = variation.toLowerCase();
  return variationKeywords.find(keyword => lowerVariation.includes(keyword));
}

export const Song = mongoose.model<ISong>('Song', songSchema);
