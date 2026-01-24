#!/usr/bin/env ts-node
/**
 * dJay Pro CSV Importer
 * 
 * Imports songs from dJay Pro CSV export into CrateCaddy database.
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
import { ISource } from '../src/models/Song.js';
import { songService } from '../src/services/songService.js';

dotenv.config({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.env') });

const connectDB = async () => {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/cratecaddy';
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB');
};

/**
 * Parse time string (MM:SS) to milliseconds
 */
const parseTimeToMs = (timeStr?: string): number | undefined => {
  if (!timeStr || timeStr.trim() === '') return undefined;
  
  const parts = timeStr.trim().split(':');
  if (parts.length !== 2) return undefined;
  
  const minutes = parseInt(parts[0], 10);
  const seconds = parseInt(parts[1], 10);
  
  if (isNaN(minutes) || isNaN(seconds)) return undefined;
  
  return (minutes * 60 + seconds) * 1000;
};

/**
 * Parse CSV line (handles quoted fields with commas)
 */
const parseCSVLine = (line: string): string[] => {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
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

const importSongs = async (csvPath: string) => {
  try {
    await connectDB();

    console.log(`Importing songs from: ${csvPath}`);
    const csvData = readFileSync(csvPath, 'utf-8');
    const lines = csvData.split('\n').filter((line) => line.trim() !== '');
    
    if (lines.length < 2) {
      throw new Error('CSV file must have at least a header and one data row');
    }

    // Skip header row
    const dataLines = lines.slice(1);
    console.log(`Found ${dataLines.length} tracks in CSV`);

    let imported = 0;
    let updated = 0;
    let skipped = 0;

    for (const line of dataLines) {
      const fields = parseCSVLine(line);
      
      // Expected format: Title, Artist, Album, Time, BPM, Key, URL
      if (fields.length < 7) {
        skipped++;
        continue;
      }

      const title = fields[0]?.replace(/^"|"$/g, '') || '';
      const artist = fields[1]?.replace(/^"|"$/g, '') || '';
      const album = fields[2]?.replace(/^"|"$/g, '') || '';
      const timeStr = fields[3]?.replace(/^"|"$/g, '') || '';
      const bpmStr = fields[4]?.replace(/^"|"$/g, '') || '';
      const key = fields[5]?.replace(/^"|"$/g, '') || '';
      const url = fields[6]?.replace(/^"|"$/g, '') || '';

      // Skip tracks without title or artist
      if (!title || !artist) {
        skipped++;
        continue;
      }

      const duration = parseTimeToMs(timeStr);
      const bpm = bpmStr ? parseFloat(bpmStr) || undefined : undefined;

      // Create source object
      const source: ISource = {
        sourceType: 'djaypro',
        filePath: url || undefined,
        sourceMetadata: {
          url,
        },
        lastImportDate: new Date(),
      };

      // Create song data (song-level fields only)
      const songData = {
        title,
        album,
        genres: [],
        grouping: [],
        bpm,
        duration,
        key: key || undefined,
      };

      // Check if song already exists (by matching)
      const existing = await songService.findMatchingSong(artist, title, duration);
      const isNew = !existing;

      // Upsert with merge
      await songService.upsertSongWithMerge(artist, title, duration, songData, source);

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

// Get CSV file path from command line or use default
const csvPath = process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'data', 'dJayPro.csv');
importSongs(csvPath);
