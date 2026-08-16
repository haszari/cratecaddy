#!/usr/bin/env ts-node
/**
 * Apple Music XML Plist Importer
 * 
 * Imports songs from Apple Music Library.xml export into CrateCaddy database.
 * 
 * Environment Variables:
 *   MONGODB_URI - MongoDB connection string (default: mongodb://localhost:5327/cratecaddy)
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
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from '../src/config/env.js';
import { SourceFormat, Song } from '../src/models/Song.js';
import { songService } from '../src/services/songService.js';
import { splitTagsField } from '../src/helpers/tags.js';

const connectDB = async () => {
  await mongoose.connect(config.mongoUri);
  console.log('Connected to MongoDB');
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
    let filteredVideos = 0;
    let errors = 0;

    for (const trackId of trackIds) {
      const trackData = tracksDict[trackId];

      if (!trackData || typeof trackData !== 'object') {
        skipped++;
        continue;
      }

      // Skip music videos — audio tracks only
      if (trackData['Has Video'] === true) {
        filteredVideos++;
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

    // Favourite sync: un-star songs no longer loved in Apple Music
    console.log(`\nRunning favourite sync...`);
    const lovedIds = new Set<string>();
    for (const trackId of trackIds) {
      const track = tracksDict[trackId];
      if (track && track['Loved'] === true && track['Persistent ID']) {
        lovedIds.add(track['Persistent ID']);
      }
    }

    let unstarred = 0;
    let stayedStarred = 0;
    let skippedNoSource = 0;
    let syncErrors = 0;

    const starredSongs = await Song.find({ favorite: 'starred' });
    for (const song of starredSongs) {
      const appleSource = song.sources?.find((s) => s.sourceType === 'applemusic');
      if (!appleSource?.appleMusicId) {
        skippedNoSource++;
        continue;
      }
      if (lovedIds.has(appleSource.appleMusicId)) {
        stayedStarred++;
        continue;
      }
      try {
        await songService.updateSongMetadata(String(song._id), { favorite: 'normal' }, 'applemusic');
        console.log(`  Favourite sync: un-starred "${song.artist} – ${song.title}" (appleMusicId: ${appleSource.appleMusicId})`);
        unstarred++;
      } catch (err) {
        console.error(`  Favourite sync error for "${song.artist} – ${song.title}":`, (err as Error).message);
        syncErrors++;
      }
    }

    console.log(`\nImport complete!`);
    console.log(`  Imported: ${imported}`);
    console.log(`  Updated: ${updated}`);
    console.log(`  Errors: ${errors}`);
    console.log(`  Skipped (no name): ${skipped}`);
    console.log(`  Filtered (audio, no DJing/Listening/Starred): ${filtered}`);
    console.log(`  Filtered (videos): ${filteredVideos}`);
    console.log(`  Total processed: ${imported + updated + errors + skipped}`);
    console.log(`  Total in file: ${trackIds.length}`);
    console.log(`\nFavourite sync complete!`);
    console.log(`  Un-starred: ${unstarred}`);
    console.log(`  Stayed starred: ${stayedStarred}`);
    console.log(`  Skipped (no applemusic source): ${skippedNoSource}`);
    if (syncErrors > 0) console.log(`  Sync errors: ${syncErrors}`);

    await mongoose.disconnect();
  } catch (error) {
    console.error('Import error:', error);
    process.exit(1);
  }
};

// Get XML file path from command line or use default
const xmlPath = process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'data', 'Library.xml');
importSongs(xmlPath);
