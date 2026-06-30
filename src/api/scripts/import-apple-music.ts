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
 *   Only imports songs with "DJing" or "Listening" in the Grouping field,
 *   or songs marked as Loved (Starred) in Apple Music.
 */

import mongoose from 'mongoose';
import { readFileSync } from 'fs';
import plist from 'plist';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { SourceFormat } from '../src/models/Song.js';
import { songService } from '../src/services/songService.js';

dotenv.config({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.env') });

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

const convertRating = (rating?: string | number): number | undefined => {
  if (!rating) return undefined;
  const num = typeof rating === 'string' ? parseInt(rating, 10) : rating;
  if (isNaN(num)) return undefined;
  return num / 20;
};

const parseKeyFromComment = (comment?: string): string | undefined => {
  if (!comment) return undefined;
  const match = comment.match(/musicalKey=([A-G][b#]?(?:m|dim|aug|sus)?)/);
  return match ? match[1] : undefined;
};

const detectFormat = (trackType?: string, kind?: string): SourceFormat | undefined => {
  if (trackType === 'Remote') return 'applemusicstream';
  if (!kind) return undefined;
  if (kind.includes('Apple Lossless') || kind.includes('ALAC')) return 'alac';
  if (kind.includes('AIFF')) return 'aiff';
  if (kind.includes('WAV')) return 'wav';
  if (kind.includes('AAC')) return 'aac';
  if (kind.includes('MPEG') || kind.includes('mp3')) return 'mp3';
  return undefined;
};

const importSongs = async (xmlPath: string) => {
  try {
    await connectDB();

    console.log(`Importing songs from: ${xmlPath}`);
    const xmlData = readFileSync(xmlPath, 'utf-8');
    const parsed = plist.parse(xmlData) as Record<string, any>;

    const tracksDict = parsed.Tracks;
    if (!tracksDict || typeof tracksDict !== 'object') {
      throw new Error('Failed to find Tracks dict in plist');
    }

    const trackIds = Object.keys(tracksDict);
    // Sort: Remote (stream) tracks first, File tracks last
    // so local file metadata (richer genres) wins over Apple Music streams
    trackIds.sort((a, b) => {
      const aTrack = tracksDict[a];
      const bTrack = tracksDict[b];
      const aIsRemote = aTrack?.['Track Type'] === 'Remote';
      const bIsRemote = bTrack?.['Track Type'] === 'Remote';
      if (aIsRemote && !bIsRemote) return -1;
      if (!aIsRemote && bIsRemote) return 1;
      return 0;
    });
    console.log(`Found ${trackIds.length} tracks in XML`);

    let imported = 0;
    let updated = 0;
    let skipped = 0;
    let filtered = 0;
    let errors = 0;

    for (const trackId of trackIds) {
      const trackData = tracksDict[trackId];

      if (!trackData || typeof trackData !== 'object') {
        skipped++;
        continue;
      }

      const groupingRawString = trackData['Grouping'];
      const loved = trackData['Loved'] === true;
      const hasValidGrouping = groupingRawString && (groupingRawString.includes('DJing') || groupingRawString.includes('Listening'));
      if (!hasValidGrouping && !loved) {
        filtered++;
        continue;
      }

      const name = trackData['Name'];

      if (!name || (typeof name === 'string' && name.trim() === '')) {
        skipped++;
        continue;
      }

      const persistentId = trackData['Persistent ID'] || '';
      const artist = trackData['Artist'] || '';
      const album = trackData['Album'] || '';
      const comment = trackData['Comments'] || '';
      const genres = splitTagsField(trackData['Genre']);
      const grouping = splitTagsField(groupingRawString);
      const bpmRaw = trackData['BPM'] ? parseInt(String(trackData['BPM']), 10) : undefined;
      const bpm = bpmRaw !== undefined && !isNaN(bpmRaw) ? bpmRaw : undefined;
      const totalTime = trackData['Total Time'] ? parseInt(String(trackData['Total Time']), 10) || undefined : undefined;
      const year = trackData['Year'] ? parseInt(String(trackData['Year']), 10) || undefined : undefined;
      const rating = convertRating(trackData['Rating']);
      const location = trackData['Location'];
      const kind = trackData['Kind'] || undefined;
      const trackType = trackData['Track Type'];
      const isProtected = trackData['Protected'] === true;
      const isAppleMusic = trackData['Track Type'] === 'Remote';
      const disliked = trackData['Disliked'] === true;

      let favorite: 'normal' | 'starred' | 'disliked' = 'normal';
      if (loved) favorite = 'starred';
      else if (disliked) favorite = 'disliked';

      try {
        const existing = await songService.findMatchingSong(artist, name, totalTime);
        const isNew = !existing;

        await songService.updateWithHistory(
          artist,
          name,
          totalTime,
          {
            genres,
            grouping,
            bpm,
            rating,
            year,
            album,
            appleMusicId: persistentId,
            key: parseKeyFromComment(comment),
            favorite,
          },
          {
            sourceType: 'applemusic',
            format: detectFormat(trackType, kind),
            appleMusicId: persistentId,
            filePath: location,
            importMeta: {
              trackId,
              persistentId,
              dateAdded: trackData['Date Added'] instanceof Date ? trackData['Date Added'] : undefined,
              dateModified: trackData['Date Modified'] instanceof Date ? trackData['Date Modified'] : undefined,
              dateLastPlayed: trackData['Play Date UTC'] instanceof Date ? trackData['Play Date UTC'] : undefined,
              trackType,
              isProtected: trackData['Protected'] === true,
              fileSize: trackData['Size'] ? parseInt(String(trackData['Size']), 10) || undefined : undefined,
              bitRate: trackData['Bit Rate'] ? parseInt(String(trackData['Bit Rate']), 10) || undefined : undefined,
              fileType: kind,
            },
          }
        );

        if (isNew) {
          imported++;
        } else {
          updated++;
        }
      } catch (err) {
        console.error(`  Error importing "${artist} – ${name}":`, (err as Error).message);
        errors++;
      }
    }

    console.log(`\nImport complete!`);
    console.log(`  Imported: ${imported}`);
    console.log(`  Updated: ${updated}`);
    console.log(`  Errors: ${errors}`);
    console.log(`  Skipped (no name): ${skipped}`);
    console.log(`  Filtered (no DJing/Listening/Starred): ${filtered}`);
    console.log(`  Total processed: ${imported + updated + errors + skipped}`);
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
