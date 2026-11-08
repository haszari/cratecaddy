/**
 * Translates browse params into a MongoDB query. This is the API's filter
 * implementation; `songQuery.matchesFilters` is the in-memory equivalent used
 * by the static site. They are kept deliberately parallel (ADR-0014):
 * add new filters to both and to `npm run check:static-site-matches-app`.
 */
import { FilterQuery } from 'mongoose';
import { ISong } from '../models/Song.js';
import { KEY, ApiFilterParams } from './apiParams.js';
import { parseKey, keysWithin } from './musicalKey.js';

export type { ApiFilterParams as SongFilterParams };

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function splitValues(value: string): string[] {
  return value
    .split(',')
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
}

function buildAnyCondition(field: 'genres' | 'artist', values: string[]): FilterQuery<ISong> {
  if (values.length === 0) return {};
  const escaped = values.map((v) => escapeRegex(v));
  const regexes = escaped.map((v) => ({
    [field]: { $regex: v, $options: 'i' },
  }));
  return { $or: regexes };
}

function buildAllCondition(field: 'genres' | 'artist', values: string[]): FilterQuery<ISong> {
  if (values.length === 0) return {};
  const escaped = values.map((v) => escapeRegex(v));
  const regexes = escaped.map((v) => ({
    [field]: { $regex: v, $options: 'i' },
  }));
  return { $and: regexes };
}

function buildNotCondition(field: 'genres' | 'artist', values: string[]): FilterQuery<ISong> {
  if (values.length === 0) return {};
  const escaped = values.map((v) => escapeRegex(v));
  const regexes = escaped.map((v) => ({
    [field]: { $regex: v, $options: 'i' },
  }));
  return { $nor: regexes };
}

/**
 * A Song is owned when at least one source is a local file. Any format that is
 * not the streaming marker counts (codecs can appear that we never enumerate);
 * a file:// path covers older imports with no format. Songs with only
 * applemusicstream sources are streaming-only.
 */
function ownedSourceCondition(): FilterQuery<ISong> {
  return {
    sources: {
      $elemMatch: {
        $or: [
          { format: { $exists: true, $ne: 'applemusicstream' } },
          { format: { $exists: false }, filePath: { $regex: '^file://' } },
        ],
      },
    },
  };
}

function buildOwnershipCondition(ownership: string): FilterQuery<ISong> | null {
  if (ownership === 'owned') return ownedSourceCondition();
  if (ownership === 'streaming') {
    return {
      $and: [
        { $nor: [ownedSourceCondition()] },
        { 'sources.format': 'applemusicstream' },
      ],
    };
  }
  return null;
}

function buildSearchCondition(term: string): FilterQuery<ISong> {
  if (!term.trim()) return {};
  const escaped = escapeRegex(term.trim());
  const match = { $regex: escaped, $options: 'i' };
  return {
    $or: [
      { artist: match },
      { title: match },
      { genres: match },
    ],
  };
}

export function buildSongFilter(params: ApiFilterParams): FilterQuery<ISong> {
  const conditions: FilterQuery<ISong>[] = [];

  const anyGenre = params[KEY.genreAny];
  if (anyGenre) {
    const vals = splitValues(anyGenre);
    if (vals.length > 0) conditions.push(buildAnyCondition('genres', vals));
  }
  const allGenre = params[KEY.genreAll];
  if (allGenre) {
    const vals = splitValues(allGenre);
    if (vals.length > 0) conditions.push(buildAllCondition('genres', vals));
  }
  const notGenre = params[KEY.genreNot];
  if (notGenre) {
    const vals = splitValues(notGenre);
    if (vals.length > 0) conditions.push(buildNotCondition('genres', vals));
  }

  const anyArtist = params[KEY.artistAny];
  if (anyArtist) {
    const vals = splitValues(anyArtist);
    if (vals.length > 0) {
      const escaped = vals.map((v) => escapeRegex(v));
      const regexes = escaped.flatMap((v) => [
        { artist: { $regex: v, $options: 'i' } },
        { title: { $regex: v, $options: 'i' } },
      ]);
      conditions.push({ $or: regexes });
    }
  }
  const allArtist = params[KEY.artistAll];
  if (allArtist) {
    const vals = splitValues(allArtist);
    if (vals.length > 0) conditions.push(buildAllCondition('artist', vals));
  }
  const notArtist = params[KEY.artistNot];
  if (notArtist) {
    const vals = splitValues(notArtist);
    if (vals.length > 0) conditions.push(buildNotCondition('artist', vals));
  }

  const bpmGte = params[KEY.bpmGte];
  const bpmLte = params[KEY.bpmLte];
  if (bpmGte != null || bpmLte != null) {
    const bpmRange: Record<string, number> = {};
    if (bpmGte != null) {
      const val = parseFloat(bpmGte);
      if (!isNaN(val)) bpmRange.$gte = val;
    }
    if (bpmLte != null) {
      const val = parseFloat(bpmLte);
      if (!isNaN(val)) bpmRange.$lte = val;
    }
    if (bpmRange.$gte !== undefined && bpmRange.$lte !== undefined && bpmRange.$gte > bpmRange.$lte) {
      const tmp = bpmRange.$gte;
      bpmRange.$gte = bpmRange.$lte;
      bpmRange.$lte = tmp;
    }
    if (Object.keys(bpmRange).length > 0) {
      conditions.push({
        $or: [
          { bpm: bpmRange },
          { bpm: { $exists: false } },
          { bpm: null },
        ],
      });
    }
  }

  if (params[KEY.bpmEmpty] === 'true') {
    conditions.push({ $or: [{ bpm: { $exists: false } }, { bpm: null }] });
  }

  const ratingGte = params[KEY.ratingGte];
  const ratingLte = params[KEY.ratingLte];
  if (ratingGte != null || ratingLte != null) {
    const ratingRange: Record<string, number> = {};
    if (ratingGte != null) {
      const val = parseFloat(ratingGte);
      if (!isNaN(val)) ratingRange.$gte = val;
    }
    if (ratingLte != null) {
      const val = parseFloat(ratingLte);
      if (!isNaN(val)) ratingRange.$lte = val;
    }
    if (ratingRange.$gte !== undefined && ratingRange.$lte !== undefined && ratingRange.$gte > ratingRange.$lte) {
      const tmp = ratingRange.$gte;
      ratingRange.$gte = ratingRange.$lte;
      ratingRange.$lte = tmp;
    }
    if (Object.keys(ratingRange).length > 0) {
      conditions.push({ rating: ratingRange });
    }
  }

  const keyParam = params[KEY.key];
  if (keyParam) {
    const target = parseKey(keyParam);
    if (target !== null) {
      const rawTolerance = parseInt(params[KEY.keyTolerance] ?? '0', 10);
      const tolerance = isNaN(rawTolerance) ? 0 : Math.max(0, Math.min(6, rawTolerance));
      const allowed = keysWithin(target, tolerance);
      conditions.push({ keyCamelot: { $in: allowed } });
    }
  }

  if (params[KEY.keyEmpty] === 'true') {
    conditions.push({ $or: [{ keyCamelot: { $exists: false } }, { keyCamelot: null }] });
  }

  const yearGte = params[KEY.yearGte];
  const yearLte = params[KEY.yearLte];
  if (yearGte != null || yearLte != null) {
    const yearRange: Record<string, number> = {};
    if (yearGte != null) {
      const val = parseFloat(yearGte);
      if (!isNaN(val)) yearRange.$gte = val;
    }
    if (yearLte != null) {
      const val = parseFloat(yearLte);
      if (!isNaN(val)) yearRange.$lte = val;
    }
    if (yearRange.$gte !== undefined && yearRange.$lte !== undefined && yearRange.$gte > yearRange.$lte) {
      const tmp = yearRange.$gte;
      yearRange.$gte = yearRange.$lte;
      yearRange.$lte = tmp;
    }
    if (Object.keys(yearRange).length > 0) {
      conditions.push({
        $or: [
          { year: yearRange },
          { year: { $exists: false } },
          { year: null },
        ],
      });
    }
  }
  if (params[KEY.yearEmpty] === 'true') {
    conditions.push({ $or: [{ year: { $exists: false } }, { year: null }] });
  }

  const favorite = params[KEY.favorite];
  if (favorite) {
    if (favorite === 'true' || favorite === '1' || favorite === 'starred') {
      conditions.push({ favorite: 'starred' });
    } else if (favorite === 'disliked') {
      conditions.push({ favorite: 'disliked' });
    }
  }

  const ownership = params[KEY.ownership];
  if (ownership) {
    const condition = buildOwnershipCondition(ownership);
    if (condition) conditions.push(condition);
  }

  const searchTerm = params[KEY.search];
  if (searchTerm && searchTerm.trim()) {
    conditions.push(buildSearchCondition(searchTerm));
  }

  if (conditions.length === 0) return {};
  if (conditions.length === 1) return conditions[0];
  return { $and: conditions };
}
