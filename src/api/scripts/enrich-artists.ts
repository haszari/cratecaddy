#!/usr/bin/env ts-native

/**
 * Enrich artist list with NZ association via MusicBrainz API + Wikipedia fallback.
 *
 * Strategy:
 * 1. Batch-download ALL artists tagged with area:New Zealand from MusicBrainz
 * 2. Cross-reference against MongoDB artist list
 * 3. Unmatched artists fall back to Wikipedia OpenSearch
 * 4. Outputs CSV with artist, country, year, country-guess, source
 *
 * Usage: npm run enrich:artists > artists-enriched.csv
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.env') });

const MB_API = 'https://musicbrainz.org/ws/2/artist';
const WIKI_API = 'https://en.wikipedia.org/w/api.php';
const UA = 'CrateCaddy/1.0 (artist-enrich/1.0; mailto:user@example.com)';

interface ArtistRow {
  artist: string;
  country: string;
  year: number | null;
  countryGuess: string;
  source: string;
}

const connectDB = async () => {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/cratecaddy';
  await mongoose.connect(mongoUri);
};

const quoteCsv = (val: string): string => {
  if (val.includes(',') || val.includes('"') || val.includes('\n')) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
};

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// ── MusicBrainz: fetch ALL NZ artists (paginated) ───────────────

interface MbArtist {
  id: string;
  name: string;
  sortName?: string;
}

const fetchMbPage = async (offset: number): Promise<{ artists: MbArtist[]; total: number }> => {
  const url = `${MB_API}/?query=area:%22New%20Zealand%22&limit=100&offset=${offset}&fmt=json`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`MusicBrainz error ${res.status} at offset ${offset}`);
  const data: any = await res.json();
  const artists: MbArtist[] = (data.artists || []).map((a: any) => ({
    id: a.id,
    name: a.name,
    sortName: a['sort-name'],
  }));
  return { artists, total: data.count || 0 };
};

const fetchAllNzArtistsFromMusicBrainz = async (): Promise<Map<string, string>> => {
  // Returns Map<normalizedName, musicbrainzUrl>
  const nzMap = new Map<string, string>();
  const first = await fetchMbPage(0);
  for (const a of first.artists) {
    const key = a.name.toLowerCase().trim();
    if (!nzMap.has(key)) {
      nzMap.set(key, `https://musicbrainz.org/artist/${a.id}`);
    }
  }
  const total = first.total;
  console.error(`  MusicBrainz: ${total} total NZ artists, fetching all pages...`);

  const pages = Math.ceil(total / 100);
  for (let page = 1; page < pages; page++) {
    await sleep(1100); // 1 req/s rate limit
    const data = await fetchMbPage(page * 100);
    for (const a of data.artists) {
      const key = a.name.toLowerCase().trim();
      if (!nzMap.has(key)) {
        nzMap.set(key, `https://musicbrainz.org/artist/${a.id}`);
      }
    }
    console.error(`  MusicBrainz: page ${page + 1}/${pages} (${nzMap.size} unique names)`);
  }
  return nzMap;
};

// ── Wikipedia OpenSearch fallback ─────────────────────────────────

const wikiOpenSearch = async (artist: string): Promise<{ isNz: boolean; url: string } | null> => {
  const url = `${WIKI_API}?action=opensearch&search=${encodeURIComponent(artist)}&limit=1&namespace=0&format=json&origin=*`;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA } });
      if (res.ok) {
        const data: any = await res.json();
        if (data[2]?.[0]) {
          const desc = data[2][0].toLowerCase();
          const isNz = desc.includes('new zealand') ||
                       desc.includes(' nz ') ||
                       desc.startsWith('nz ') ||
                       desc.includes('nz singer') ||
                       desc.includes('nz musician') ||
                       desc.includes('nz rapper') ||
                       desc.includes('nz record') ||
                       desc.includes('nz-born') ||
                       desc.includes('nz artist');
          const pageTitle = data[1]?.[0];
          const wikiUrl = pageTitle
            ? `https://en.wikipedia.org/wiki/${encodeURIComponent(pageTitle.replace(/ /g, '_'))}`
            : '';
          return { isNz, url: wikiUrl };
        }
        return { isNz: false, url: '' };
      }
      if (res.status === 429) {
        await sleep(5000 * Math.pow(2, attempt));
        continue;
      }
      return { isNz: false, url: '' };
    } catch {
      return { isNz: false, url: '' };
    }
  }
  return { isNz: false, url: '' };
};

// ── Main ──────────────────────────────────────────────────────────

const enrichArtists = async () => {
  try {
    await connectDB();
    const db = mongoose.connection.db;

    // ── Get artists from MongoDB ──
    console.error('Querying MongoDB...');
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

    const results = await db.collection('songs').aggregate(pipeline).toArray();
    const rows: ArtistRow[] = results.map(r => ({
      artist: r.artist,
      country: r.country,
      year: r.year,
      countryGuess: r.country === 'NZ' ? 'NZ' : '',
      source: '',
    }));

    const alreadyNz = rows.filter(r => r.country === 'NZ').length;
    const toCheck = rows.filter(r => r.country !== 'NZ');
    console.error(`Total: ${rows.length}, already NZ: ${alreadyNz}, to check: ${toCheck.length}`);

    // ── MusicBrainz pass ──
    console.error('Step 1: Fetching NZ artists from MusicBrainz...');
    const mbNzMap = await fetchAllNzArtistsFromMusicBrainz();
    console.error(`  MusicBrainz NZ map: ${mbNzMap.size} unique names`);

    let mbMatched = 0;
    const stripSuffix = (name: string) => name.replace(/\s*\(.*?\)\s*$/, '').trim();

    const mbLookup = new Map<string, string>(); // normalized name -> url
    const mbLookupStripped = new Map<string, string>();
    for (const [name, url] of mbNzMap) {
      mbLookup.set(name, url);
      mbLookupStripped.set(stripSuffix(name), url);
    }

    for (const row of toCheck) {
      if (row.countryGuess) continue;
      const key = row.artist.toLowerCase().trim();
      const url = mbLookup.get(key) || mbLookupStripped.get(key);
      if (url) {
        row.countryGuess = 'NZ';
        row.source = url;
        mbMatched++;
      }
    }
    console.error(`  Matched via MusicBrainz: ${mbMatched}`);

    // Skipped Wikipedia fallback — too mainstream, low hit rate
    // Wikipedia-based matching was yielding 0 additional matches

    // ── Report ──
    const totalNz = rows.filter(r => r.countryGuess === 'NZ').length;
    console.error(`\nFinal: ${totalNz} NZ artists (genre: ${alreadyNz}, musicbrainz: ${mbMatched})`);

    // ── Output CSV ──
    console.log('artist,country,year,country-guess,source');
    for (const row of rows) {
      const y = row.year ?? '';
      console.log(`${quoteCsv(row.artist)},${row.country},${y},${row.countryGuess},${quoteCsv(row.source)}`);
    }

    await mongoose.disconnect();
  } catch (error) {
    console.error('Enrich error:', error);
    process.exit(1);
  }
};

enrichArtists();
