#!/usr/bin/env ts-node

import mongoose from 'mongoose';
import { readFileSync } from 'fs';
import { parseStringPromise } from 'xml2js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { Song } from '../src/models/Song.js';

dotenv.config({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.env') });

interface RekordboxTrack {
  $: {
    TrackID: string;
    Name: string;
    Artist?: string;
    Album?: string;
    Grouping?: string;
    Genre?: string;
    Composer?: string;
    Label?: string;
    Remixer?: string;
    Tonality?: string;
    Kind?: string;
    TotalTime?: string;
    Year?: string;
    AverageBpm?: string;
    BitRate?: string;
    SampleRate?: string;
    PlayCount?: string;
    Rating?: string;
    DateAdded?: string;
    Location?: string;
  };
}

interface RekordboxXML {
  DJ_PLAYLISTS: {
    COLLECTION: Array<{
      TRACK: RekordboxTrack[];
    }>;
  };
}

const connectDB = async () => {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/cratecaddy';
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB');
};

const parseGenres = (genreStr?: string): string[] => {
  if (!genreStr || genreStr.trim() === '') return [];
  return genreStr
    .split(',')
    .map((g) => g.trim())
    .filter((g) => g !== '');
};

const importSongs = async (xmlPath: string) => {
  try {
    await connectDB();

    console.log(`Importing songs from: ${xmlPath}`);
    const xmlData = readFileSync(xmlPath, 'utf-8');
    const parsed = (await parseStringPromise(xmlData)) as RekordboxXML;

    const tracks = parsed.DJ_PLAYLISTS.COLLECTION[0].TRACK;
    console.log(`Found ${tracks.length} tracks in XML`);

    let imported = 0;
    let updated = 0;
    let skipped = 0;

    for (const track of tracks) {
      const attrs = track.$;

      // Skip tracks without names
      if (!attrs.Name || attrs.Name.trim() === '') {
        skipped++;
        continue;
      }

      const trackData = {
        trackId: attrs.TrackID,
        name: attrs.Name,
        artist: attrs.Artist || '',
        album: attrs.Album || '',
        genres: parseGenres(attrs.Genre),
        composer: attrs.Composer || '',
        grouping: attrs.Grouping || '',
        remixer: attrs.Remixer || '',
        label: attrs.Label || '',
        tonality: attrs.Tonality || '',
        kind: attrs.Kind || '',
        totalTime: parseInt(attrs.TotalTime || '0', 10),
        year: parseInt(attrs.Year || '0', 10),
        bpm: parseFloat(attrs.AverageBpm || '0'),
        bitRate: parseInt(attrs.BitRate || '0', 10),
        sampleRate: parseInt(attrs.SampleRate || '0', 10),
        playCount: parseInt(attrs.PlayCount || '0', 10),
        rating: parseInt(attrs.Rating || '0', 10),
        dateAdded: attrs.DateAdded ? new Date(attrs.DateAdded) : new Date(),
        location: attrs.Location || '',
      };

      const result = await Song.findOneAndUpdate(
        { trackId: trackData.trackId },
        { ...trackData, lastImportDate: new Date() },
        { upsert: true, new: true }
      );

      if (result.createdAt === result.updatedAt) {
        imported++;
      } else {
        updated++;
      }
    }

    console.log(`\nImport complete!`);
    console.log(`  Imported: ${imported}`);
    console.log(`  Updated: ${updated}`);
    console.log(`  Skipped: ${skipped}`);
    console.log(`  Total: ${imported + updated + skipped}`);

    await mongoose.disconnect();
  } catch (error) {
    console.error('Import error:', error);
    process.exit(1);
  }
};

// Get XML file path from command line or use default
const xmlPath = process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'data', 'rekordbox.xml');
importSongs(xmlPath);
