#!/usr/bin/env ts-node

import mongoose from 'mongoose';
import { config } from '../src/config/env.js';

const connectDB = async () => {
  await mongoose.connect(config.mongoUri);
};

const quoteCsv = (val: string): string => {
  if (val.includes(',') || val.includes('"') || val.includes('\n')) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
};

const exportArtists = async () => {
  try {
    await connectDB();

    const pipeline = [
      { $match: { artist: { $exists: true, $nin: ['', null] } } },
      { $addFields: {
        isNz: {
          $or: [
            { $in: ['NZ', '$genres'] },
            { $in: ['New Zealand', '$genres'] },
          ],
        },
      }},
      { $group: {
        _id: '$artist',
        country: { $max: '$isNz' },
        year: { $max: '$year' },
      }},
      { $project: {
        _id: 0,
        artist: '$_id',
        country: { $cond: ['$country', 'NZ', ''] },
        year: { $ifNull: ['$year', null] },
      }},
      { $sort: { artist: 1 } },
    ];

    const db = mongoose.connection.db;
    const results = await db.collection('songs').aggregate(pipeline).toArray();

    // Output CSV to stdout
    console.log('artist,country,year');
    for (const row of results) {
      const y = row.year ?? '';
      console.log(`${quoteCsv(row.artist)},${row.country},${y}`);
    }

    await mongoose.disconnect();
  } catch (error) {
    console.error('Export error:', error);
    process.exit(1);
  }
};

exportArtists();
