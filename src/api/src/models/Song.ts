import mongoose, { Schema, Document } from 'mongoose';

export interface IAppleMusicSource {
  trackType?: string;
  isProtected?: boolean;
  isAppleMusic?: boolean;
}

export interface IAppleMusicMetadata {
  id: string;
  persistentId: string;
  dateAdded?: Date;
  dateModified?: Date;
  dateLastPlayed?: Date;
  source?: IAppleMusicSource;
}

export interface ISong extends Document {
  title: string;
  artist: string;
  album: string;
  genres: string[];
  grouping: string[];
  bpm?: number;
  fileSize?: number;
  duration?: number; // in milliseconds
  year?: number;
  appleMusic: IAppleMusicMetadata;
  bitRate?: number;
  rating?: number; // 0-5 scale (can be fractional)
  filePath?: string;
  lastImportDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

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
    fileSize: {
      type: Number,
    },
    duration: {
      type: Number, // milliseconds
    },
    year: {
      type: Number,
    },
    appleMusic: {
      id: {
        type: String,
        required: true,
        unique: true,
        index: true,
      },
      persistentId: {
        type: String,
        required: true,
      },
      dateAdded: Date,
      dateModified: Date,
      dateLastPlayed: Date,
      source: {
        trackType: String,
        isProtected: Boolean,
        isAppleMusic: Boolean,
      },
    },
    bitRate: {
      type: Number,
    },
    rating: {
      type: Number, // 0-5 scale (can be fractional)
    },
    filePath: {
      type: String,
      trim: true,
    },
    lastImportDate: {
      type: Date,
      default: () => new Date(),
    },
  },
  {
    timestamps: true,
  }
);

export const Song = mongoose.model<ISong>('Song', songSchema);
