#!/usr/bin/env ts-node

/**
 * Cross-reference NZ WordPress export against artists.csv.
 *
 * Parses the WordPress XML (nztechnohouse export), extracts artist names
 * and genre tags, then merges into artists.csv:
 *   - Marks country as NZ
 *   - Populates a genres column (semicolon-delimited)
 *   - Adds new rows for artists not yet in the CSV
 *
 * Usage: npm run crossref:nzxml           # preview to stdout
 *        npm run crossref:nzxml -- --write  # update data/artists.csv in place
 */

import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '../../../data');

const CSV_PATH = path.join(DATA_DIR, 'artists.csv');
const XML_PATH = path.join(
  DATA_DIR,
  'nztechnohousebreakbeatampelectronica.WordPress.2026-05-22.xml',
);

interface XmlArtist {
  name: string;
  genres: string[];
}

interface CsvRow {
  artist: string;
  country: string;
  year: string;
  countryGuess: string;
  source: string;
  genres: string;
}

const decodeEntities = (text: string): string =>
  text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'");

const quoteCsv = (val: string): string => {
  if (val.includes(',') || val.includes('"') || val.includes('\n') || val.includes(';')) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
};

// ── Parse WordPress XML ──

const parseXml = (xmlPath: string): XmlArtist[] => {
  const raw = readFileSync(xmlPath, 'utf-8');

  const artists: XmlArtist[] = [];

  // Match each <item> block
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match: RegExpExecArray | null;

  while ((match = itemRegex.exec(raw)) !== null) {
    const itemContent = match[1];

    // Extract title
    const titleMatch = itemContent.match(/<title><!\[CDATA\[([^\]]*?)\]\]><\/title>/);
    if (!titleMatch) continue;
    const name = decodeEntities(titleMatch[1].trim());
    if (!name) continue;

    // Extract genre tags (post_tag domain)
    const genres: string[] = [];
    const tagRegex =
      /<category\s+domain="post_tag"[^>]*?>\s*<!\[CDATA\[([^\]]*?)\]\]>\s*<\/category>/g;
    let tagMatch: RegExpExecArray | null;
    while ((tagMatch = tagRegex.exec(itemContent)) !== null) {
      const genre = decodeEntities(tagMatch[1].trim());
      if (genre) genres.push(genre);
    }

    artists.push({ name, genres });
  }

  return artists;
};

// ── Parse CSV ──

const parseCsv = (csvPath: string): CsvRow[] => {
  const raw = readFileSync(csvPath, 'utf-8');
  const lines = raw.split('\n').filter((l) => l.trim() !== '');

  if (lines.length === 0) return [];

  // Parse header to find column indices
  const header = lines[0];
  const cols = header.split(',').map((c) => c.trim().toLowerCase());

  const colIndex = (name: string): number => cols.indexOf(name);

  const artistIdx = colIndex('artist');
  const countryIdx = colIndex('country');
  const yearIdx = colIndex('year');
  const countryGuessIdx = colIndex('country-guess');
  const sourceIdx = colIndex('source');
  const genresIdx = colIndex('genres');

  const rows: CsvRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    // Simple CSV parser (handles quoted fields)
    const vals = parseCsvLine(lines[i]);
    rows.push({
      artist: vals[artistIdx]?.trim() ?? '',
      country: vals[countryIdx]?.trim() ?? '',
      year: vals[yearIdx]?.trim() ?? '',
      countryGuess: countryGuessIdx >= 0 ? vals[countryGuessIdx]?.trim() ?? '' : '',
      source: sourceIdx >= 0 ? vals[sourceIdx]?.trim() ?? '' : '',
      genres: genresIdx >= 0 ? vals[genresIdx]?.trim() ?? '' : '',
    });
  }

  return rows;
};

const parseCsvLine = (line: string): string[] => {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
};

// ── Main ──

const crossref = () => {
  // 1. Parse XML
  console.error(`Reading XML: ${XML_PATH}`);
  const xmlArtists = parseXml(XML_PATH);
  console.error(`Found ${xmlArtists.length} artists in XML`);

  // 2. Parse CSV
  console.error(`Reading CSV: ${CSV_PATH}`);
  const csvRows = parseCsv(CSV_PATH);
  console.error(`Found ${csvRows.length} rows in CSV`);

  // 3. Build lookup: normalized name -> row index
  const lookup = new Map<string, number>();
  for (let i = 0; i < csvRows.length; i++) {
    const key = csvRows[i].artist.toLowerCase().trim();
    // Only store first occurrence to avoid ambiguity
    if (!lookup.has(key)) {
      lookup.set(key, i);
    }
  }

  // 4. Cross-reference
  let matched = 0;
  let added = 0;

  for (const xml of xmlArtists) {
    const key = xml.name.toLowerCase().trim();
    const idx = lookup.get(key);

    if (idx !== undefined) {
      // Found in CSV — mark NZ and add genres
      const row = csvRows[idx];
      row.country = 'NZ';
      row.countryGuess = row.countryGuess || 'NZ';
      const existing = row.genres ? row.genres.split(/\s*;\s*/).filter(Boolean) : [];
      const allGenres = [...new Set([...existing, ...xml.genres])];
      row.genres = allGenres.join('; ');
      matched++;
    } else {
      // Not in CSV — add new row
      csvRows.push({
        artist: xml.name,
        country: 'NZ',
        year: '',
        countryGuess: 'NZ',
        source: '',
        genres: xml.genres.join('; '),
      });
      added++;
    }
  }

  console.error(`Matched: ${matched}, Added: ${added}`);
  console.error(`Total rows: ${csvRows.length}`);

  // 5. Output CSV with genres column
  const shouldWrite = process.argv.includes('--write');
  const outLines: string[] = [];

  outLines.push('artist,country,year,country-guess,source,genres');
  for (const row of csvRows) {
    const parts = [
      quoteCsv(row.artist),
      quoteCsv(row.country),
      row.year,
      quoteCsv(row.countryGuess),
      quoteCsv(row.source),
      quoteCsv(row.genres),
    ];
    outLines.push(parts.join(','));
  }

  if (shouldWrite) {
    writeFileSync(CSV_PATH, outLines.join('\n') + '\n', 'utf-8');
    console.error(`Wrote ${csvRows.length} rows to ${CSV_PATH}`);
  } else {
    console.log(outLines.join('\n'));
  }
};

crossref();
