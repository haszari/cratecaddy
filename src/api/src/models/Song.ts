import mongoose, { Schema, Document } from 'mongoose';

export interface ISong extends Document {
  trackId: string;
  name: string;
  artist: string;
  album: string;
  genres: string[];
  composer: string;
  grouping: string;
  remixer: string;
  label: string;
  tonality: string;
  kind: string;
  totalTime: number;
  year: number;
  bpm: number;
  bitRate: number;
  sampleRate: number;
  playCount: number;
  rating: number;
  dateAdded: Date;
  location: string;
  lastImportDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

const songSchema = new Schema<ISong>(
  {
    trackId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    artist: {
      type: String,
      trim: true,
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
    composer: {
      type: String,
      trim: true,
    },
    grouping: {
      type: String,
      trim: true,
    },
    remixer: {
      type: String,
      trim: true,
    },
    label: {
      type: String,
      trim: true,
    },
    tonality: {
      type: String,
      trim: true,
    },
    kind: {
      type: String,
      trim: true,
    },
    totalTime: {
      type: Number,
      default: 0,
    },
    year: {
      type: Number,
      default: 0,
    },
    bpm: {
      type: Number,
      default: 0,
    },
    bitRate: {
      type: Number,
      default: 0,
    },
    sampleRate: {
      type: Number,
      default: 0,
    },
    playCount: {
      type: Number,
      default: 0,
    },
    rating: {
      type: Number,
      default: 0,
    },
    dateAdded: {
      type: Date,
    },
    location: {
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
