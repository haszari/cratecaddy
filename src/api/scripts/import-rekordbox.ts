#!/usr/bin/env ts-node
/**
 * Rekordbox XML Importer
 * 
 * Imports songs from Rekordbox XML export into CrateCaddy database.
 * Uses the same dedup and merge pipeline as the Apple Music importer
 * (findMatchingSong + updateWithHistory).
 * 
 * Environment Variables:
 *   MONGODB_URI - MongoDB connection string (default: mongodb://localhost:27017/cratecaddy)
 * 
 * Parameters:
 *   xmlPath - Path to Rekordbox XML file (optional, defaults to ../../data/rekordbox.xml)
 * 
 * Usage:
 *   npm run import:rekordbox [path/to/rekordbox.xml]
 * 
 * Imports all tracks from the XML (no filter).
 */

import mongoose from 'mongoose';
import { readFileSync } from 'fs';
import { XMLParser } from 'fast-xml-parser';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { songService } from '../src/services/songService.js';

dotenv.config({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.env') });

interface RekordboxTrack {
  Name?: string;
  Artist?: string;
  Album?: string;
  Grouping?: string;
  Genre?: string;
  Tonality?: string;
  TotalTime?: string;
  Year?: string;
  AverageBpm?: string;
  Rating?: string;
  Location?: string;
  Kind?: string;
  Composer?: string;
  Remixer?: string;
  Label?: string;
  SampleRate?: string;
  BitRate?: string;
  PlayCount?: string;
  DateAdded?: string;
}

const connectDB = async () => {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/cratecaddy';
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB');
};

const splitTagsField = (fieldStr?: string): string[] => {
  if (!fieldStr || fieldStr.trim() === '') return [];
  return fieldStr
    .split(',')
    .map((tag) => tag.trim())
    .filter((tag) => tag !== '');
};

const convertRating = (rating?: string): number | undefined => {
  if (!rating) return undefined;
  const num = parseInt(rating, 10);
  if (isNaN(num)) return undefined;
  return num / 20;
};

const camelotToKey: Record<string, string> = {
  '1A': 'Gm', '2A': 'Dm', '3A': 'Am', '4A': 'Em', '5A': 'Bm', '6A': 'F#m',
  '7A': 'C#m', '8A': 'G#m', '9A': 'D#m', '10A': 'A#m', '11A': 'Fm', '12A': 'Cm',
  '1B': 'C', '2B': 'G', '3B': 'D', '4B': 'A', '5B': 'E', '6B': 'B',
  '7B': 'F#', '8B': 'C#', '9B': 'G#', '10B': 'D#', '11B': 'A#', '12B': 'F',
};

const convertKey = (tonality?: string): string | undefined => {
  if (!tonality || tonality.trim() === '') return undefined;
  const trimmed = tonality.trim();
  const camelotMatch = trimmed.match(/^(\d{1,2})([AB])$/);
  if (camelotMatch) return camelotToKey[trimmed];
  return trimmed;
};

const importSongs = async (xmlPath: string) => {
  try {
    await connectDB();

    console.log(`Importing songs from: ${xmlPath}`);
    const xmlData = readFileSync(xmlPath, 'utf-8');
    const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '', isArray: (name) => name === 'TRACK' });
    const parsed = parser.parse(xmlData);

    const collection = parsed.DJ_PLAYLISTS?.COLLECTION;
    if (!collection || !collection.TRACK) {
      throw new Error('Failed to find COLLECTION/TRACK in XML');
    }

    const tracks = collection.TRACK as RekordboxTrack[];
    console.log(`Found ${tracks.length} tracks in XML`);

    let imported = 0;
    let updated = 0;
    let skipped = 0;
    let errors = 0;

    for (const track of tracks) {
      if (!track.Name || track.Name.trim() === '') {
        skipped++;
        continue;
      }

      const title = track.Name.trim();
      const artist = track.Artist?.trim() || '';

      if (!artist) {
        skipped++;
        continue;
      }

      const album = track.Album?.trim() || '';
      const genres = splitTagsField(track.Genre);
      const grouping = splitTagsField(track.Grouping);
      const totalTimeSec = parseInt(track.TotalTime || '0', 10) || undefined;
      const duration = totalTimeSec ? totalTimeSec * 1000 : undefined;
      const year = track.Year ? parseInt(track.Year, 10) || undefined : undefined;
      const bpm = track.AverageBpm ? parseFloat(track.AverageBpm) || undefined : undefined;
      const rating = convertRating(track.Rating);
      const location = track.Location || '';

      try {
        const existing = await songService.findMatchingSong(artist, title, duration);
        const isNew = !existing;

        await songService.updateWithHistory(
          artist,
          title,
          duration,
          {
            genres,
            grouping,
            bpm,
            year,
            rating,
            album,
            key: convertKey(track.Tonality),
          },
          {
            sourceType: 'rekordbox',
            filePath: location,
            importMeta: {
              location,
              dateAdded: track.DateAdded ? new Date(track.DateAdded) : undefined,
              composer: track.Composer,
              remixer: track.Remixer,
              label: track.Label,
              sampleRate: track.SampleRate ? parseInt(track.SampleRate, 10) : undefined,
              playCount: track.PlayCount ? parseInt(track.PlayCount, 10) : undefined,
              bitRate: track.BitRate ? parseInt(track.BitRate, 10) : undefined,
              fileType: track.Kind,
            },
          }
        );

        if (isNew) {
          imported++;
        } else {
          updated++;
        }
      } catch (err) {
        console.error(`  Error importing "${artist} – ${title}":`, (err as Error).message);
        errors++;
      }
    }

    console.log(`\nImport complete!`);
    console.log(`  Imported: ${imported}`);
    console.log(`  Updated: ${updated}`);
    console.log(`  Errors: ${errors}`);
    console.log(`  Skipped: ${skipped}`);
    console.log(`  Total processed: ${imported + updated + errors + skipped}`);
    console.log(`  Total in file: ${tracks.length}`);

    await mongoose.disconnect();
  } catch (error) {
    console.error('Import error:', error);
    process.exit(1);
  }
};

const xmlPath = process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'data', 'rekordbox.xml');
importSongs(xmlPath);
