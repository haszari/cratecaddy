import { exec } from 'child_process';

export interface AppleLovedTrack {
  persistentId: string;
  name: string;
  artist: string;
  album?: string;
  duration?: number; // milliseconds (Music `total time`)
  genre?: string; // comma-separated — split via splitTagsField before use
  grouping?: string;
  bpm?: number;
  rating?: number; // 0–100 (Music scale) — divide by 20 for the DB 0–5 scale
  year?: number;
}

const DELIM = String.fromCharCode(31);
const FIELD_NAMES = [
  'persistent ID',
  'name',
  'artist',
  'album',
  'total time',
  'genre',
  'grouping',
  'bpm',
  'rating',
  'year',
];

function buildReadScript(): string {
  const fields = FIELD_NAMES.join(') & (ASCII character 31) & (');
  return [
    `tell application "Music"`,
    `  set out to {}`,
    `  set lovedTracks to (every track of library playlist 1 whose loved is true)`,
    `  repeat with t in lovedTracks`,
    `    set end of out to (${fields})`,
    `  end repeat`,
    `  return out`,
    `end tell`,
  ].join('\n');
}

function parseNumber(raw: string | undefined): number | undefined {
  if (raw === undefined || raw === '' || raw === 'missing value') return undefined;
  const num = Number(raw);
  return Number.isFinite(num) ? num : undefined;
}

function cleanText(raw: string | undefined): string | undefined {
  const val = raw?.trim();
  if (!val || val === 'missing value') return undefined;
  return val;
}

export async function readLovedTracks(): Promise<AppleLovedTrack[]> {
  const script = buildReadScript();

  return new Promise((resolve, reject) => {
    exec(`osascript -e '${script.replace(/'/g, "'\\''")}'`, { timeout: 120000 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`AppleScript failed: ${error.message}`));
        return;
      }
      const trimmed = stdout.trim();
      if (trimmed.startsWith('error:')) {
        reject(new Error(trimmed));
        return;
      }
      if (trimmed === '') {
        resolve([]);
        return;
      }

      const tracks: AppleLovedTrack[] = [];
      for (const line of trimmed.split('\n')) {
        const parts = line.split(DELIM);
        if (parts.length < FIELD_NAMES.length) continue;
        const persistentId = parts[0].trim();
        if (!persistentId) continue;
        tracks.push({
          persistentId,
          name: cleanText(parts[1]) || '',
          artist: cleanText(parts[2]) || '',
          album: cleanText(parts[3]),
          duration: parseNumber(parts[4]),
          genre: cleanText(parts[5]),
          grouping: cleanText(parts[6]),
          bpm: parseNumber(parts[7]),
          rating: parseNumber(parts[8]),
          year: parseNumber(parts[9]),
        });
      }
      resolve(tracks);
    });
  });
}
