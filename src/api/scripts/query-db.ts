#!/usr/bin/env ts-node
/**
 * Ad-hoc Database Query Script
 * 
 * Run MongoDB queries interactively or via command line.
 * 
 * Usage:
 *   npm run query:db                    # Interactive mode
 *   npm run query:db "db.songs.countDocuments()"  # Run a query
 * 
 * Examples:
 *   npm run query:db "db.songs.find().limit(5).pretty()"
 *   npm run query:db "db.songs.find({key: {$exists: true}}).count()"
 *   npm run query:db "db.songs.aggregate([{$unwind: '$sources'}, {$group: {_id: '$sources.sourceType', count: {$sum: 1}}}])"
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { Song } from '../src/models/Song.js';

dotenv.config({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.env') });

const connectDB = async () => {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/cratecaddy';
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB');
  return mongoose.connection.db;
};

// Helper function to run common queries
const runQuery = async (query: string) => {
  const db = await connectDB();
  const songs = db.collection('songs');

  // Check if query starts with "search:" for title search
  if (query.toLowerCase().startsWith('search:')) {
    const searchTerm = query.substring(7).trim();
    if (!searchTerm) {
      console.log('Usage: npm run query:db "search:word"');
      await mongoose.disconnect();
      return;
    }
    const results = await songs
      .find({ title: { $regex: searchTerm, $options: 'i' } })
      .toArray();
    console.log(JSON.stringify(results, null, 2));
    await mongoose.disconnect();
    return;
  }

  switch (query.toLowerCase()) {
    case 'count':
      const count = await songs.countDocuments();
      console.log(`Total songs: ${count}`);
      break;

    case 'sample':
      const sample = await songs.find().limit(3).toArray();
      console.log(JSON.stringify(sample, null, 2));
      break;

    case 'with-key':
      const withKey = await songs.find({ key: { $exists: true, $ne: null } }).count();
      console.log(`Songs with key: ${withKey}`);
      break;

    case 'sources':
      const sourceStats = await songs.aggregate([
        { $unwind: '$sources' },
        { $group: { _id: '$sources.sourceType', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]).toArray();
      console.log('Sources by type:');
      sourceStats.forEach((stat) => {
        console.log(`  ${stat._id}: ${stat.count}`);
      });
      break;

    case 'duplicates':
      const duplicates = await songs.aggregate([
        {
          $group: {
            _id: { artist: '$artist', title: '$title' },
            count: { $sum: 1 },
            ids: { $push: '$_id' },
          },
        },
        { $match: { count: { $gt: 1 } } },
        { $limit: 10 },
      ]).toArray();
      console.log(`Found ${duplicates.length} potential duplicates (showing first 10):`);
      duplicates.forEach((dup) => {
        console.log(`  "${dup._id.title}" by ${dup._id.artist}: ${dup.count} records`);
      });
      break;

    default:
      console.log('Available queries:');
      console.log('  count      - Total song count');
      console.log('  sample     - Show 3 sample songs');
      console.log('  with-key   - Count songs with key field');
      console.log('  sources    - Source type statistics');
      console.log('  duplicates - Find potential duplicate songs');
      console.log('  search:word - Search songs by word in title (returns JSON)');
      console.log('\nOr use MongoDB queries directly via mongosh (see README)');
  }

  await mongoose.disconnect();
};

// Get query from command line or show help
const query = process.argv[2] || 'help';
runQuery(query).catch((error) => {
  console.error('Query error:', error);
  process.exit(1);
});
