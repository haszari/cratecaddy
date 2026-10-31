#!/usr/bin/env ts-node
/**
 * Backfill keyCamelot (canonical Camelot index) for all songs.
 *
 * Derives the index from the stored `key` note name using the standard wheel.
 * Songs with no recognisable key get keyCamelot removed. Idempotent — safe to
 * rerun. Bypasses the Mongoose pre-save hook via updateOne (schema migration,
 * not a normal write path).
 *
 * Usage: npm run backfill:key-camelot
 */
import mongoose from 'mongoose';
import { config } from '../src/config/env.js';
import { keyToIndex } from '../src/helpers/musicalKey.js';

async function main() {
  await mongoose.connect(config.mongoUri);
  console.log(`Connected to MongoDB: ${config.mongoUri}`);

  const collection = mongoose.connection.collection('songs');
  const cursor = collection.find({}, { projection: { key: 1 } });

  let updated = 0;
  let cleared = 0;
  let scanned = 0;

  for await (const doc of cursor) {
    scanned++;
    const index = keyToIndex(doc.key);
    if (index === null) {
      if (doc.keyCamelot !== undefined && doc.keyCamelot !== null) {
        await collection.updateOne({ _id: doc._id }, { $unset: { keyCamelot: '' } });
        cleared++;
      }
    } else if (doc.keyCamelot !== index) {
      await collection.updateOne({ _id: doc._id }, { $set: { keyCamelot: index } });
      updated++;
    }
  }

  console.log(`Backfill complete: ${scanned} scanned, ${updated} updated, ${cleared} cleared.`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
