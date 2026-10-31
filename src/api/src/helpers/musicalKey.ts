/**
 * Musical key — canonical Camelot wheel.
 *
 * Canonical identity is a Camelot index `0..23`, interleaved by number so that
 * relative major/minor pairs sit adjacent (1A=0, 1B=1, 2A=2, 2B=3, ...).
 * Note names are a rendering of that identity, not the source of truth.
 *
 * The wheel is the standard Camelot system: same number across A (minor) and
 * B (major) is the relative pair. Harmonic "near key" distance is the circular
 * distance on the wheel number, ignoring letter (8A and 8B are distance 0).
 *
 * Import scripts that convert a Camelot tag to a note name (djay Pro) should
 * use this table; the previous rotated table produced correct note names but
 * wrong wheel numbers (see plan 20261031).
 */

/** Minor keys (A ring), sharp notation, Camelot number 1..12. */
const MINOR_BY_NUMBER = [
  'G#m', 'D#m', 'A#m', 'Fm', 'Cm', 'Gm',
  'Dm', 'Am', 'Em', 'Bm', 'F#m', 'C#m',
] as const;

/** Major keys (B ring), sharp notation, Camelot number 1..12. */
const MAJOR_BY_NUMBER = [
  'B', 'F#', 'C#', 'G#', 'D#', 'A#',
  'F', 'C', 'G', 'D', 'A', 'E',
] as const;

/** Flat spellings that map onto the sharp-note canonical wheel. */
const ENHARMONIC: Record<string, string> = {
  Abm: 'G#m',
  Ebm: 'D#m',
  Bbm: 'A#m',
  Db: 'C#',
  Gb: 'F#',
  Ab: 'G#',
  Eb: 'D#',
  Bb: 'A#',
};

/** number (1..12) -> index (0..23) for A and B. */
function numberToIndex(number: number, letter: 'A' | 'B'): number {
  return (number - 1) * 2 + (letter === 'A' ? 0 : 1);
}

export interface CamelotKey {
  number: number; // 1..12
  letter: 'A' | 'B'; // A = minor, B = major
}

/** Build note-name lookup (sharp + flat spellings) -> index. */
const NOTE_TO_INDEX: Record<string, number> = {};
for (let n = 1; n <= 12; n++) {
  NOTE_TO_INDEX[MINOR_BY_NUMBER[n - 1]] = numberToIndex(n, 'A');
  NOTE_TO_INDEX[MAJOR_BY_NUMBER[n - 1]] = numberToIndex(n, 'B');
}
for (const [flat, sharp] of Object.entries(ENHARMONIC)) {
  NOTE_TO_INDEX[flat] = NOTE_TO_INDEX[sharp];
}

const KEY_PATTERN = /^([A-Ga-g])([#b]?)\s*(m)?(?:inor)?$/;

/** Parse a note name (e.g. "F#m", "G", "Abm", "Bbm", "C") into a Camelot index. */
export function keyToIndex(value: string | undefined | null): number | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const direct = NOTE_TO_INDEX[trimmed];
  if (direct !== undefined) return direct;

  const match = KEY_PATTERN.exec(trimmed);
  if (!match) return null;
  const root = match[1].toUpperCase() + (match[2] ?? '');
  const minor = !!match[3];
  const note = root + (minor ? 'm' : '');
  return NOTE_TO_INDEX[note] ?? null;
}

const CAMELOT_LABEL = /^(\d{1,2})([AB])$/;

/**
 * Parse a user-supplied key target: note name ("F#m", "G", "Abm"),
 * Camelot label ("8A"), or raw index string ("14").
 */
export function parseKey(value: string | undefined | null): number | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const byNote = keyToIndex(trimmed);
  if (byNote !== null) return byNote;
  const label = CAMELOT_LABEL.exec(trimmed);
  if (label) {
    const n = parseInt(label[1], 10);
    if (n >= 1 && n <= 12) return camelotToIndex(n, label[2] as 'A' | 'B');
  }
  const asIndex = parseInt(trimmed, 10);
  if (!isNaN(asIndex) && asIndex >= 0 && asIndex <= 23) return asIndex;
  return null;
}

/** Camelot index -> note name (sharp notation). */
export function indexToNote(index: number): string {
  const letter = index % 2 === 0 ? 'A' : 'B';
  const number = Math.floor(index / 2) + 1;
  return letter === 'A' ? MINOR_BY_NUMBER[number - 1] : MAJOR_BY_NUMBER[number - 1];
}

/** Camelot index -> number + letter. */
export function indexToCamelot(index: number): CamelotKey {
  return {
    number: Math.floor(index / 2) + 1,
    letter: index % 2 === 0 ? 'A' : 'B',
  };
}

/** number + letter -> index. */
export function camelotToIndex(number: number, letter: 'A' | 'B'): number {
  return numberToIndex(number, letter);
}

/** Human Camelot label, e.g. "8A". */
export function camelotLabel(index: number): string {
  const { number, letter } = indexToCamelot(index);
  return `${number}${letter}`;
}

/** Circular distance on the wheel number (0..6), ignoring letter. */
export function camelotDistance(a: number, b: number): number {
  const na = Math.floor(a / 2);
  const nb = Math.floor(b / 2);
  const diff = Math.abs(na - nb) % 12;
  return Math.min(diff, 12 - diff);
}

/**
 * All Camelot indices within `tolerance` wheel-steps of `index` (both rings).
 * Tolerance 0 returns the target number's minor and major (relative pair).
 */
export function keysWithin(index: number, tolerance: number): number[] {
  const n = Math.floor(index / 2);
  const out = new Set<number>();
  for (let d = -tolerance; d <= tolerance; d++) {
    const nn = ((n + d) % 12 + 12) % 12;
    out.add(nn * 2);
    out.add(nn * 2 + 1);
  }
  return [...out].sort((a, b) => a - b);
}
