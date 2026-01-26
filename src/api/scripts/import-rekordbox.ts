#!/usr/bin/env ts-node

import mongoose from 'mongoose';
import { readFileSync } from 'fs';
import { parseStringPromise } from 'xml2js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { ISource } from '../src/models/Song.js';
import { songService, normalizeArtistTitle } from '../src/services/songService.js';

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

      const title = attrs.Name;
      const artist = attrs.Artist || '';
      const album = attrs.Album || '';
      const genres = parseGenres(attrs.Genre);
      const grouping = attrs.Grouping ? [attrs.Grouping] : [];
      const tonality = attrs.Tonality || '';
      const fileType = attrs.Kind || '';
      const totalTime = parseInt(attrs.TotalTime || '0', 10) || undefined;
      const year = attrs.Year ? parseInt(attrs.Year, 10) || undefined : undefined;
      const bpm = attrs.AverageBpm ? parseFloat(attrs.AverageBpm) || undefined : undefined;
      const bitRate = attrs.BitRate ? parseInt(attrs.BitRate, 10) || undefined : undefined;
      const rating = attrs.Rating ? parseInt(attrs.Rating, 10) || undefined : undefined;
      const location = attrs.Location || '';
      const dateAdded = attrs.DateAdded ? new Date(attrs.DateAdded) : undefined;

      // Create source object
      const source: ISource = {
        sourceType: 'rekordbox',
        filePath: location,
        bitRate,
        fileType,
        sourceMetadata: {
          trackId: attrs.TrackID,
          location,
          dateAdded,
          composer: attrs.Composer,
          remixer: attrs.Remixer,
          label: attrs.Label,
          sampleRate: attrs.SampleRate ? parseInt(attrs.SampleRate, 10) : undefined,
          playCount: attrs.PlayCount ? parseInt(attrs.PlayCount, 10) : undefined,
        },
        lastImportDate: new Date(),
      };

      // Create song data (song-level fields only)
      const songData = {
        title,
        album,
        genres,
        grouping,
        bpm,
        duration: totalTime,
        year,
        key: tonality || undefined, // Extract key from Tonality field
        rating,
        artistTitleNormalized: normalizeArtistTitle(artist, title),
      };

      // Check if song already exists (by matching)
      const existing = await songService.findMatchingSong(artist, title, totalTime);
      const isNew = !existing;

      // Upsert with merge
      await songService.upsertSongWithMerge(artist, title, totalTime, songData, source);

      if (isNew) {
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
