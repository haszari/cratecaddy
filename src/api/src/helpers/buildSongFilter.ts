import { FilterQuery } from 'mongoose';
import { ISong } from '../models/Song.js';
import { ApiFilterParams } from './apiParams.js';

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

  const anyGenre = params['genre.any'];
  if (anyGenre) {
    const vals = splitValues(anyGenre);
    if (vals.length > 0) conditions.push(buildAnyCondition('genres', vals));
  }
  const allGenre = params['genre.all'];
  if (allGenre) {
    const vals = splitValues(allGenre);
    if (vals.length > 0) conditions.push(buildAllCondition('genres', vals));
  }
  const notGenre = params['genre.not'];
  if (notGenre) {
    const vals = splitValues(notGenre);
    if (vals.length > 0) conditions.push(buildNotCondition('genres', vals));
  }

  const anyArtist = params['artist.any'];
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
  const allArtist = params['artist.all'];
  if (allArtist) {
    const vals = splitValues(allArtist);
    if (vals.length > 0) conditions.push(buildAllCondition('artist', vals));
  }
  const notArtist = params['artist.not'];
  if (notArtist) {
    const vals = splitValues(notArtist);
    if (vals.length > 0) conditions.push(buildNotCondition('artist', vals));
  }

  const bpmGte = params['bpm.gte'];
  const bpmLte = params['bpm.lte'];
  if (bpmGte || bpmLte) {
    const bpmRange: Record<string, number> = {};
    if (bpmGte) {
      const val = parseFloat(bpmGte);
      if (!isNaN(val)) bpmRange.$gte = val;
    }
    if (bpmLte) {
      const val = parseFloat(bpmLte);
      if (!isNaN(val)) bpmRange.$lte = val;
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

  const ratingGte = params['rating.gte'];
  const ratingLte = params['rating.lte'];
  if (ratingGte || ratingLte) {
    const ratingRange: Record<string, number> = {};
    if (ratingGte) {
      const val = parseFloat(ratingGte);
      if (!isNaN(val)) ratingRange.$gte = val;
    }
    if (ratingLte) {
      const val = parseFloat(ratingLte);
      if (!isNaN(val)) ratingRange.$lte = val;
    }
    if (Object.keys(ratingRange).length > 0) {
      conditions.push({ rating: ratingRange });
    }
  }

  const favorite = params.favorite;
  if (favorite) {
    if (favorite === 'true' || favorite === '1' || favorite === 'starred') {
      conditions.push({ favorite: 'starred' });
    } else if (favorite === 'disliked') {
      conditions.push({ favorite: 'disliked' });
    }
  }

  const searchTerm = params.search;
  if (searchTerm && searchTerm.trim()) {
    conditions.push(buildSearchCondition(searchTerm));
  }

  if (conditions.length === 0) return {};
  if (conditions.length === 1) return conditions[0];
  return { $and: conditions };
}
