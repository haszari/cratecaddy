#!/usr/bin/env ts-node
/**
 * Apple Music XML Plist Importer
 * 
 * Imports songs from Apple Music Library.xml export into CrateCaddy database.
 * 
 * Environment Variables:
 *   MONGODB_URI - MongoDB connection string (default: mongodb://localhost:27017/cratecaddy)
 * 
 * Parameters:
 *   xmlPath - Path to Library.xml file (optional, defaults to ../../data/Library.xml)
 * 
 * Usage:
 *   npm run import:applemusic [path/to/Library.xml]
 * 
 * Filter:
 *   Only imports songs with "DJing" in the Grouping field
 */

import mongoose from 'mongoose';
import { readFileSync } from 'fs';
import plist from 'plist';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { ISource } from '../src/models/Song.js';
import { songService } from '../src/services/songService.js';

dotenv.config({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.env') });

interface PlistDictItem {
  key: string;
  type: string;
  value: any;
}

interface PlistDict {
  [key: string]: PlistDictItem;
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

// Convert Apple Music rating (0-100) to 0-5 scale as float
const convertRating = (rating?: string | number): number | undefined => {
  if (!rating) return undefined;
  const num = typeof rating === 'string' ? parseInt(rating, 10) : rating;
  if (isNaN(num)) return undefined;
  return num / 20; // 0-100 scale to 0-5 scale
};

// Check if track has "DJing" in grouping
const hasDJingGrouping = (grouping?: string): boolean => {
  if (!grouping) return false;
  return grouping.includes('DJing');
};

const importSongs = async (xmlPath: string) => {
  try {
    await connectDB();

    console.log(`Importing songs from: ${xmlPath}`);
    const xmlData = readFileSync(xmlPath, 'utf-8');
    
    // Parse the plist file - plist library returns a proper JS object
    const parsed = plist.parse(xmlData) as Record<string, any>;

    // Get the Tracks dictionary
    const tracksDict = parsed.Tracks;
    if (!tracksDict || typeof tracksDict !== 'object') {
      throw new Error('Failed to find Tracks dict in plist');
    }

    const trackIds = Object.keys(tracksDict);
    console.log(`Found ${trackIds.length} tracks in XML`);

    let imported = 0;
    let updated = 0;
    let skipped = 0;
    let filtered = 0;

    // Iterate through each track
    for (const trackId of trackIds) {
      const trackData = tracksDict[trackId];

      if (!trackData || typeof trackData !== 'object') {
        skipped++;
        continue;
      }

      // Filter by DJing grouping
      const groupingRawString = trackData['Grouping'];
      if (!hasDJingGrouping(groupingRawString)) {
        filtered++;
        continue;
      }

      // Get name
      const name = trackData['Name'];

      // Skip tracks without names
      if (!name || (typeof name === 'string' && name.trim() === '')) {
        skipped++;
        continue;
      }

      // Extract all values safely
      const persistentId = trackData['Persistent ID'] || '';
      const artist = trackData['Artist'] || '';
      const album = trackData['Album'] || '';
      const genres = splitTagsField(trackData['Genre']);
      const grouping = splitTagsField(trackData['Grouping']);
      const bpm = trackData['BPM'] ? parseInt(String(trackData['BPM']), 10) || undefined : undefined;
      const fileSize = trackData['Size'] ? parseInt(String(trackData['Size']), 10) || undefined : undefined;
      const totalTime = trackData['Total Time'] ? parseInt(String(trackData['Total Time']), 10) || undefined : undefined;
      const year = trackData['Year'] ? parseInt(String(trackData['Year']), 10) || undefined : undefined;
      const bitRate = trackData['Bit Rate'] ? parseInt(String(trackData['Bit Rate']), 10) || undefined : undefined;
      const rating = convertRating(trackData['Rating']);
      const location = trackData['Location'];
      const fileType = trackData['Kind'] || undefined;
      const dateAdded = trackData['Date Added'] instanceof Date ? trackData['Date Added'] : undefined;
      const dateModified = trackData['Date Modified'] instanceof Date ? trackData['Date Modified'] : undefined;
      const dateLastPlayed = trackData['Play Date UTC'] instanceof Date ? trackData['Play Date UTC'] : undefined;
      const trackType = trackData['Track Type'];
      const isProtected = trackData['Protected'] === true;
      const isAppleMusic = trackData['Track Type'] === 'Remote';

      // Create source object
      const source: ISource = {
        sourceType: 'applemusic',
        filePath: location,
        fileSize,
        bitRate,
        fileType,
        sourceMetadata: {
          id: trackId,
          persistentId,
          dateAdded,
          dateModified,
          dateLastPlayed,
          trackType,
          isProtected,
          isAppleMusic,
        },
        lastImportDate: new Date(),
      };

      // Create song data (song-level fields only)
      const songData = {
        title: name,
        album,
        genres,
        grouping,
        bpm: bpm || undefined,
        duration: totalTime,
        year: year || undefined,
        rating: rating || undefined,
      };

      // Check if song already exists (by matching)
      const existing = await songService.findMatchingSong(artist, name, totalTime);
      const isNew = !existing;

      // Upsert with merge
      await songService.upsertSongWithMerge(artist, name, totalTime, songData, source);

      if (isNew) {
        imported++;
      } else {
        updated++;
      }
    }

    console.log(`\nImport complete!`);
    console.log(`  Imported: ${imported}`);
    console.log(`  Updated: ${updated}`);
    console.log(`  Skipped (no name): ${skipped}`);
    console.log(`  Filtered (no "DJing" tag): ${filtered}`);
    console.log(`  Total processed: ${imported + updated + skipped}`);
    console.log(`  Total in file: ${trackIds.length}`);

    await mongoose.disconnect();
  } catch (error) {
    console.error('Import error:', error);
    process.exit(1);
  }
};

// Get XML file path from command line or use default
const xmlPath = process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'data', 'Library.xml');
importSongs(xmlPath);
