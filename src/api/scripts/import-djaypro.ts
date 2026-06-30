#!/usr/bin/env ts-node
/**
 * dJay Pro CSV Importer
 * 
 * Imports songs from dJay Pro CSV export into CrateCaddy database.
 * Songs are matched by normalized artist+title+duration (see findMatchingSong).
 * BPM, key and album fill nulls only (passive merge — never overwrites existing values).
 * 
 * Imports:
 *   - Title, Artist → song identity (matching + create)
 *   - Album, BPM, Key → song metadata (mergeField, fills nulls)
 *   - Time → duration (matching only, not re-written)
 *   - URL → source.filePath
 * 
 * Does NOT import: genres, grouping, rating, year, favourite
 *   (not available in the djaypro CSV export format)
 * 
 * Environment Variables:
 *   MONGODB_URI - MongoDB connection string (default: mongodb://localhost:27017/cratecaddy)
 * 
 * Parameters:
 *   csvPath - Path to CSV file (optional, defaults to ../../data/dJayPro.csv)
 * 
 * Usage:
 *   npm run import:djaypro [path/to/dJayPro.csv]
 * 
 * CSV Format:
 *   Title, Artist, Album, Time, BPM, Key, URL
 */

import mongoose from 'mongoose';
import { readFileSync } from 'fs';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { songService } from '../src/services/songService.js';

dotenv.config({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.env') });

const connectDB = async () => {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/cratecaddy';
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB');
};

const parseTimeToMs = (timeStr?: string): number | undefined => {
  if (!timeStr || timeStr.trim() === '') return undefined;
  const parts = timeStr.trim().split(':');
  let hours = 0, minutes = 0, seconds = 0;
  if (parts.length === 3) {
    hours = parseInt(parts[0], 10);
    minutes = parseInt(parts[1], 10);
    seconds = parseInt(parts[2], 10);
  } else if (parts.length === 2) {
    minutes = parseInt(parts[0], 10);
    seconds = parseInt(parts[1], 10);
  } else {
    return undefined;
  }
  if ([hours, minutes, seconds].some(isNaN)) return undefined;
  return ((hours * 60 + minutes) * 60 + seconds) * 1000;
};

const parseCSVLine = (line: string): string[] => {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
};

// Camelot wheel → standard musical key
const camelotToKey: Record<string, string> = {
  '1A': 'Gm', '2A': 'Dm', '3A': 'Am', '4A': 'Em', '5A': 'Bm', '6A': 'F#m',
  '7A': 'C#m', '8A': 'G#m', '9A': 'D#m', '10A': 'A#m', '11A': 'Fm', '12A': 'Cm',
  '1B': 'C', '2B': 'G', '3B': 'D', '4B': 'A', '5B': 'E', '6B': 'B',
  '7B': 'F#', '8B': 'C#', '9B': 'G#', '10B': 'D#', '11B': 'A#', '12B': 'F',
};

const standardKeyPattern = /^[A-G][b#]?(?:m|dim|aug|sus)?$/;

const convertKey = (value?: string): string | undefined => {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (standardKeyPattern.test(trimmed)) return trimmed;
  if (camelotToKey[trimmed]) return camelotToKey[trimmed];
  console.warn(`  Unrecognised key format: "${value}" — discarding`);
  return undefined;
};

const importSongs = async (csvPath: string) => {
  try {
    await connectDB();

    console.log(`Importing songs from: ${csvPath}`);
    const csvData = readFileSync(csvPath, 'utf-8');
    const lines = csvData.split('\n').filter((line) => line.trim() !== '');
    if (lines.length < 2) {
      throw new Error('CSV file must have at least a header and one data row');
    }

    const dataLines = lines.slice(1);
    console.log(`Found ${dataLines.length} tracks in CSV`);

    let imported = 0;
    let updated = 0;
    let skipped = 0;
    let errors = 0;

    for (const line of dataLines) {
      const fields = parseCSVLine(line);
      if (fields.length < 7) {
        skipped++;
        continue;
      }

      const title = fields[0] || '';
      const artist = fields[1] || '';
      const album = fields[2] || '';
      const timeStr = fields[3] || '';
      const bpmStr = fields[4] || '';
      const keyRaw = fields[5] || '';
      const url = fields[6] || '';

      if (!title || !artist) {
        skipped++;
        continue;
      }

      const duration = parseTimeToMs(timeStr);
      const bpmRaw = bpmStr ? parseFloat(bpmStr) : undefined;
      const bpm = bpmRaw !== undefined && !isNaN(bpmRaw) ? bpmRaw : undefined;

      try {
        const existing = await songService.findMatchingSong(artist, title, duration);
        const isNew = !existing;

        await songService.updateWithHistory(
          artist,
          title,
          duration,
          {
            bpm,
            key: convertKey(keyRaw),
            album,
          },
          {
            sourceType: 'djaypro',
            filePath: url || undefined,
            importMeta: { url },
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
    console.log(`  Total: ${imported + updated + errors + skipped}`);

    await mongoose.disconnect();
  } catch (error) {
    console.error('Import error:', error);
    process.exit(1);
  }
};

// Get CSV file path from command line or use default
const csvPath = process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'data', 'dJayPro.csv');
importSongs(csvPath);
