/**
 * Writes a CrateCaddy Snapshot: a point-in-time, filtered, read-only copy of
 * the Library, as static JSON for the published browse-only build.
 *
 * A Snapshot is not an Export — it does not leave CrateCaddy for another
 * system, it is the data for CrateCaddy's own read-only deployment.
 * See CONTEXT.md and docs/adr/0013.
 *
 * Usage:
 *   npm run snapshot
 *   npm run snapshot -- --grouping DJing,Listening
 *   npm run snapshot -- --grouping "" --genre.all=Techno --bpm.gte=120
 *
 * The payload is an explicit allowlist: new Song fields never reach the
 * static site unless they are added here. Local filesystem paths, file
 * sizes, bit rates and import provenance are deliberately dropped; `sources`
 * keeps just what the UI renders, with `isLocal` derived from `filePath`.
 *
 * The filename is content-hashed (snapshot-<sha8>.json) so a changed Library
 * produces a new URL, and an unchanged one does not trigger a redeploy.
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import zlib from 'zlib';
import { execSync } from 'child_process';
import { FilterQuery } from 'mongoose';
import mongoose from 'mongoose';
import { config } from '../src/config/env.js';
import { Song, ISong } from '../src/models/Song.js';
import { buildSongFilter } from '../src/helpers/buildSongFilter.js';
import { ApiFilterParams, FILTER_PARAM_KEYS, KEY } from '../src/helpers/apiParams.js';

interface SnapshotConfig {
  grouping?: string[];
  filters?: ApiFilterParams;
}

interface SnapshotSource {
  sourceType: string;
  format?: string;
  appleMusicId?: string;
  isLocal: boolean;
  sourceMetadata?: { isAppleMusic?: boolean; fileType?: string };
}

interface SnapshotSong {
  _id: string;
  title: string;
  artist: string;
  album?: string;
  duration?: number;
  genres: string[];
  grouping: string[];
  bpm?: number;
  year?: number;
  keyCamelot?: number;
  rating?: number;
  favorite?: string;
  canonicalAppleMusicId?: string;
  appleMusicIds: string[];
  artistTitleNormalized?: string;
  sources: SnapshotSource[];
}

const ALLOWED_SONG_KEYS = new Set([
  '_id', 'title', 'artist', 'album', 'duration', 'genres', 'grouping',
  'bpm', 'year', 'keyCamelot', 'rating', 'favorite',
  'canonicalAppleMusicId', 'appleMusicIds', 'artistTitleNormalized', 'sources',
]);

const ALLOWED_SOURCE_KEYS = new Set(['sourceType', 'format', 'appleMusicId', 'isLocal', 'sourceMetadata']);
const ALLOWED_SOURCE_METADATA_KEYS = new Set(['isAppleMusic', 'fileType']);

const OUTPUT_DIR = path.join(config.repoRoot, 'src/ui/public/data');
const CONFIG_PATH = path.join(config.repoRoot, 'snapshot.config.json');

function readConfig(configPath: string): SnapshotConfig {
  if (!fs.existsSync(configPath)) {
    return { grouping: ['DJing'], filters: {} };
  }
  const raw = fs.readFileSync(configPath, 'utf8');
  return JSON.parse(raw) as SnapshotConfig;
}

interface CliArgs {
  configPath: string;
  grouping?: string[];
  filters: ApiFilterParams;
  help: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { configPath: CONFIG_PATH, filters: {}, help: false };

  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') {
      args.help = true;
      continue;
    }
    if (arg === '--config') {
      throw new Error('Use --config=<path>');
    }
    if (arg.startsWith('--config=')) {
      args.configPath = path.resolve(arg.slice('--config='.length));
      continue;
    }
    if (arg === '--grouping') {
      throw new Error('Use --grouping=<comma,separated,values> (empty for all songs)');
    }
    if (arg.startsWith('--grouping=')) {
      const value = arg.slice('--grouping='.length);
      args.grouping = value
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean);
      continue;
    }
    if (arg.startsWith('--')) {
      const [key, ...rest] = arg.slice(2).split('=');
      if (!FILTER_PARAM_KEYS.includes(key as keyof ApiFilterParams)) {
        throw new Error(`Unknown option: --${key}`);
      }
      args.filters[key as keyof ApiFilterParams] = rest.join('=');
      continue;
    }
    throw new Error(`Unexpected argument: ${arg}`);
  }

  return args;
}

function printHelp() {
  console.log(`Usage: npm run snapshot -- [options]

Options:
  --grouping=<values>   Grouping values the Song must contain (comma separated).
                        Defaults to snapshot.config.json. Empty string means all songs.
  --<filter>=<value>    Any app filter param, e.g. --genre.all=Techno --bpm.gte=120
                        (${FILTER_PARAM_KEYS.join(', ')})
  --config=<path>       Config file (default: snapshot.config.json at repo root)
  --help                Show this message`);
}

/** True for local file URLs. Remote streaming tracks have no file URL. */
function isLocalFileUrl(filePath?: string): boolean {
  return typeof filePath === 'string' && filePath.startsWith('file://');
}

function toSnapshotSource(source: ISong['sources'][number]): SnapshotSource {
  const result: SnapshotSource = {
    sourceType: source.sourceType,
    isLocal: Boolean(
      (source.format && source.format !== 'applemusicstream') || isLocalFileUrl(source.filePath),
    ),
  };
  if (source.format) result.format = source.format;
  if (source.appleMusicId) result.appleMusicId = source.appleMusicId;

  const metadata: { isAppleMusic?: boolean; fileType?: string } = {};
  const rawMetadata = source.sourceMetadata as Record<string, unknown> | undefined;
  if (rawMetadata?.isAppleMusic !== undefined) {
    metadata.isAppleMusic = Boolean(rawMetadata.isAppleMusic);
  }
  if (typeof rawMetadata?.fileType === 'string') {
    metadata.fileType = rawMetadata.fileType;
  }
  if (Object.keys(metadata).length > 0) result.sourceMetadata = metadata;
  return result;
}

function toSnapshotSong(song: ISong): SnapshotSong {
  return {
    _id: String(song._id),
    title: song.title,
    artist: song.artist,
    album: song.album,
    duration: song.duration,
    genres: song.genres ?? [],
    grouping: song.grouping ?? [],
    bpm: song.bpm,
    year: song.year,
    keyCamelot: song.keyCamelot,
    rating: song.rating,
    favorite: song.favorite,
    canonicalAppleMusicId: song.canonicalAppleMusicId,
    appleMusicIds: song.appleMusicIds ?? [],
    artistTitleNormalized: song.artistTitleNormalized,
    sources: (song.sources ?? []).map(toSnapshotSource),
  };
}

function assertAllowedKeys(song: SnapshotSong, index: number): void {
  const where = `song[${index}] (${song.artist} – ${song.title})`;
  for (const key of Object.keys(song)) {
    if (!ALLOWED_SONG_KEYS.has(key)) {
      throw new Error(`Unexpected field "${key}" on ${where} — update the Snapshot allowlist deliberately`);
    }
  }
  for (const source of song.sources) {
    for (const key of Object.keys(source)) {
      if (!ALLOWED_SOURCE_KEYS.has(key)) {
        throw new Error(`Unexpected source field "${key}" on ${where}`);
      }
    }
    if (source.sourceMetadata) {
      for (const key of Object.keys(source.sourceMetadata)) {
        if (!ALLOWED_SOURCE_METADATA_KEYS.has(key)) {
          throw new Error(`Unexpected sourceMetadata field "${key}" on ${where}`);
        }
      }
    }
  }
}

function validate(songs: SnapshotSong[]): void {
  if (songs.length === 0) {
    throw new Error('Snapshot would be empty — check the grouping and filter config');
  }
  songs.forEach((song, index) => {
    if (!song._id) throw new Error(`song[${index}] is missing _id`);
    if (!song.title) throw new Error(`song[${index}] is missing title`);
    if (!song.artist) throw new Error(`song[${index}] is missing artist`);
    if (!Array.isArray(song.genres)) throw new Error(`song[${index}] has non-array genres`);
    assertAllowedKeys(song, index);
  });
}

function gitInfo(): { commit: string; dirty: boolean } {
  const run = (command: string) => {
    try {
      return execSync(command, { cwd: config.repoRoot, stdio: ['ignore', 'pipe', 'ignore'], encoding: 'utf8' }).trim();
    } catch {
      return '';
    }
  };
  const commit = run('git rev-parse --short HEAD') || 'unknown';
  const dirty = run('git status --porcelain').length > 0;
  return { commit, dirty };
}

function appVersion(): string {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(config.repoRoot, 'src/api/package.json'), 'utf8'));
    return String(pkg.version ?? '0.1.0');
  } catch {
    return '0.1.0';
  }
}

function removeOldSnapshots(): void {
  if (!fs.existsSync(OUTPUT_DIR)) return;
  for (const file of fs.readdirSync(OUTPUT_DIR)) {
    if (/^snapshot-[0-9a-f]+\.json$/.test(file)) {
      fs.unlinkSync(path.join(OUTPUT_DIR, file));
    }
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const fileConfig = readConfig(args.configPath);
  const grouping = args.grouping ?? fileConfig.grouping ?? ['DJing'];
  const filters: ApiFilterParams = { ...(fileConfig.filters ?? {}), ...args.filters };

  await mongoose.connect(config.mongoUri);
  console.log(`Connected to MongoDB: ${config.mongoUri}`);

  const query: FilterQuery<ISong> = { ...buildSongFilter(filters) };
  if (grouping.length > 0) {
    // Array membership: contains any of these grouping values (`DJing` alone
    // includes both [DJing] and [DJing, Listening]).
    query.grouping = { $in: grouping };
  }

  const docs = await Song.find(query).sort({ _id: 1 }).lean<ISong[]>();
  const songs = docs.map(toSnapshotSong);
  validate(songs);

  const version = crypto.createHash('sha256').update(JSON.stringify(songs)).digest('hex').slice(0, 8);
  const payload = {
    snapshot: {
      version,
      takenAt: new Date().toISOString(),
      appVersion: appVersion(),
      commit: gitInfo().commit,
      filter: grouping.length > 0 ? { grouping, ...filters } : { ...filters },
      count: songs.length,
    },
    songs,
  };

  const json = JSON.stringify(payload);
  const fileName = `snapshot-${version}.json`;
  removeOldSnapshots();
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUTPUT_DIR, fileName), json);

  const gzipBytes = zlib.gzipSync(json).length;
  const kb = (bytes: number) => `${(bytes / 1024).toFixed(0)} KB`;

  console.log(`\nSnapshot written: ${path.join(OUTPUT_DIR, fileName)}`);
  console.log(`  Songs:    ${songs.length}`);
  console.log(`  Filter:   ${JSON.stringify(payload.snapshot.filter)}`);
  console.log(`  Size:     ${kb(Buffer.byteLength(json))} (${kb(gzipBytes)} gzipped)`);
  console.log(`  Version:  ${version} · app ${payload.snapshot.appVersion}+${payload.snapshot.commit}`);
  console.log(`  Taken at: ${payload.snapshot.takenAt}`);

  const dirty = gitInfo().dirty;
  if (dirty) {
    console.log('\nNote: working tree is dirty — the published version will read -dirty.');
  }
}

main()
  .catch((error) => {
    console.error(`Snapshot failed: ${error instanceof Error ? error.message : error}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
