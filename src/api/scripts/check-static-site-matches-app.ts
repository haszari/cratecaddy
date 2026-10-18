/**
 * Checks that the static site and the app show the same songs.
 *
 * CrateCaddy has two browse implementations: MongoDB behind the API, and an
 * in-memory filter behind the static site (ADR-0014). If they drift, a
 * track that exists in the app silently disappears from the static site.
 * This check runs the same queries through both and fails when the song sets
 * or the tag counts differ. It gates publishing.
 *
 * Compares the MongoDB query builder (`buildSongFilter`) behind the API
 * against the in-memory predicate (`songQuery.matchesFilters`) behind the
 * static site, over the Library being published and a fixed matrix of
 * query params.
 *
 * Asserts, per case:
 *   - identical matching Song IDs (membership)
 *   - identical genre stats (genre -> count)
 *
 * Does NOT assert sort order: MongoDB collation cannot be mirrored exactly and
 * ordering is presentation, not correctness.
 *
 * Any new filter must be added to both implementations and to this matrix.
 *
 * Usage: npm run check:static-site-matches-app
 * Requires MongoDB running and non-empty (use the dev database).
 */
import mongoose from 'mongoose';
import { config } from '../src/config/env.js';
import { Song } from '../src/models/Song.js';
import { buildSongFilter } from '../src/helpers/buildSongFilter.js';
import { matchesFilters, computeGenreStats, QueryableSong } from '../src/helpers/songQuery.js';
import { ApiFilterParams, KEY } from '../src/helpers/apiParams.js';
import { songService } from '../src/services/songService.js';

interface ParityCase {
  name: string;
  params: ApiFilterParams;
}

const CASES: ParityCase[] = [
  { name: 'no filters', params: {} },

  { name: 'genre.any single', params: { [KEY.genreAny]: 'House' } },
  { name: 'genre.any list', params: { [KEY.genreAny]: 'House,Techno' } },
  { name: 'genre.any case variant', params: { [KEY.genreAny]: 'house' } },
  { name: 'genre.any substring', params: { [KEY.genreAny]: 'Deep' } },
  { name: 'genre.all two', params: { [KEY.genreAll]: 'House,Deep' } },
  { name: 'genre.all impossible', params: { [KEY.genreAll]: 'House,NoSuchStyle' } },
  { name: 'genre.not single', params: { [KEY.genreNot]: 'Ambient' } },
  { name: 'genre.not list', params: { [KEY.genreNot]: 'Ambient,House' } },
  { name: 'genre.not substring', params: { [KEY.genreNot]: 'Deep' } },
  { name: 'genre.any + genre.not', params: { [KEY.genreAny]: 'House', [KEY.genreNot]: 'Deep' } },

  { name: 'artist.any', params: { [KEY.artistAny]: 'bailey' } },
  { name: 'artist.any matches title', params: { [KEY.artistAny]: 'love' } },
  { name: 'artist.all', params: { [KEY.artistAll]: 'bailey' } },
  { name: 'artist.not', params: { [KEY.artistNot]: 'bailey' } },
  { name: 'artist.any + genre.all', params: { [KEY.artistAny]: 'bailey', [KEY.genreAll]: 'House' } },

  { name: 'bpm.gte only', params: { [KEY.bpmGte]: '120' } },
  { name: 'bpm.lte only', params: { [KEY.bpmLte]: '120' } },
  { name: 'bpm range', params: { [KEY.bpmGte]: '120', [KEY.bpmLte]: '140' } },
  { name: 'bpm inverted range', params: { [KEY.bpmGte]: '140', [KEY.bpmLte]: '120' } },
  { name: 'bpm invalid bounds', params: { [KEY.bpmGte]: 'abc', [KEY.bpmLte]: '' } },

  { name: 'rating.gte only', params: { [KEY.ratingGte]: '3' } },
  { name: 'rating.lte only', params: { [KEY.ratingLte]: '2' } },
  { name: 'rating range', params: { [KEY.ratingGte]: '3', [KEY.ratingLte]: '5' } },
  { name: 'rating inverted range', params: { [KEY.ratingGte]: '5', [KEY.ratingLte]: '3' } },

  { name: 'favorite true', params: { [KEY.favorite]: 'true' } },
  { name: 'favorite starred', params: { [KEY.favorite]: 'starred' } },
  { name: 'favorite disliked', params: { [KEY.favorite]: 'disliked' } },
  { name: 'favorite ignored value', params: { [KEY.favorite]: 'false' } },

  { name: 'ownership owned', params: { [KEY.ownership]: 'owned' } },
  { name: 'ownership streaming', params: { [KEY.ownership]: 'streaming' } },
  { name: 'ownership owned + genre.all', params: { [KEY.ownership]: 'owned', [KEY.genreAll]: 'House' } },
  { name: 'ownership ignored value', params: { [KEY.ownership]: 'borrowed' } },

  { name: 'search artist', params: { [KEY.search]: 'bailey' } },
  { name: 'search title', params: { [KEY.search]: 'love' } },
  { name: 'search genre', params: { [KEY.search]: 'house' } },
  { name: 'search case variant', params: { [KEY.search]: 'HOUSE' } },
  { name: 'search regex characters', params: { [KEY.search]: 'a.b' } },
  { name: 'search whitespace only', params: { [KEY.search]: '   ' } },

  {
    name: 'combined filters',
    params: {
      [KEY.genreAll]: 'House',
      [KEY.genreNot]: 'Ambient',
      [KEY.bpmGte]: '120',
      [KEY.bpmLte]: '140',
      [KEY.ratingGte]: '3',
      [KEY.favorite]: 'true',
    },
  },
];

type LeanSong = QueryableSong & { _id: mongoose.Types.ObjectId; title: string; artist: string };

function describe(song: LeanSong): string {
  return `${song.artist} – ${song.title}`;
}

function compareStats(
  expected: Array<{ genre: string; count: number }>,
  actual: Array<{ genre: string; count: number }>,
): string[] {
  const problems: string[] = [];
  const expectedMap = new Map(expected.map(({ genre, count }) => [genre, count]));
  const actualMap = new Map(actual.map(({ genre, count }) => [genre, count]));

  for (const [genre, count] of expectedMap) {
    const actualCount = actualMap.get(genre);
    if (actualCount === undefined) {
      problems.push(`genre "${genre}" missing from JS stats (mongo count ${count})`);
    } else if (actualCount !== count) {
      problems.push(`genre "${genre}" count ${actualCount} in JS vs ${count} in mongo`);
    }
  }
  for (const [genre, count] of actualMap) {
    if (!expectedMap.has(genre)) {
      problems.push(`genre "${genre}" only in JS stats (count ${count})`);
    }
  }
  return problems;
}

async function runCase({ name, params }: ParityCase, allSongs: LeanSong[]): Promise<string[]> {
  const problems: string[] = [];

  const mongoSongs = await Song.find(buildSongFilter(params))
    .select({ _id: 1, artist: 1, title: 1 })
    .lean<LeanSong[]>();
  const mongoIds = new Set(mongoSongs.map((song) => String(song._id)));

  const jsMatches = allSongs.filter((song) => matchesFilters(song, params));
  const jsIds = new Set(jsMatches.map((song) => String(song._id)));

  const onlyMongo = mongoSongs.filter((song) => !jsIds.has(String(song._id)));
  const onlyJs = jsMatches.filter((song) => !mongoIds.has(String(song._id)));

  if (onlyMongo.length > 0 || onlyJs.length > 0) {
    problems.push(
      `membership differs: ${onlyMongo.length} only in mongo, ${onlyJs.length} only in JS`,
    );
    for (const song of onlyMongo.slice(0, 5)) {
      problems.push(`  only mongo: ${describe(song)} (${song._id})`);
    }
    for (const song of onlyJs.slice(0, 5)) {
      problems.push(`  only JS: ${describe(song)} (${song._id})`);
    }
  }

  const mongoStats = await songService.getFilteredGenreStats(params);
  const jsStats = computeGenreStats(jsMatches);
  const statProblems = compareStats(mongoStats, jsStats);
  if (statProblems.length > 0) {
    problems.push(`genre stats differ: ${statProblems.length} problem(s)`);
    for (const problem of statProblems.slice(0, 5)) {
      problems.push(`  ${problem}`);
    }
  }

  if (problems.length === 0) {
    console.log(`  ok  ${name} (${mongoIds.size} songs)`);
  } else {
    console.log(`  FAIL ${name}`);
    for (const problem of problems) console.log(`       ${problem}`);
  }

  return problems;
}

async function main() {
  await mongoose.connect(config.mongoUri);
  console.log(`Connected to MongoDB: ${config.mongoUri}`);

  const allSongs = await Song.find({}).lean<LeanSong[]>();
  if (allSongs.length === 0) {
    console.error('No songs in the database — parity check needs data. Import a library first.');
    process.exitCode = 1;
    return;
  }
  console.log(`Loaded ${allSongs.length} songs, running ${CASES.length} parity cases\n`);

  let failures = 0;
  for (const parityCase of CASES) {
    const problems = await runCase(parityCase, allSongs);
    if (problems.length > 0) failures++;
  }

  console.log('');
  if (failures > 0) {
    console.error(`Site/app agreement check failed: ${failures}/${CASES.length} cases differ.`);
    process.exitCode = 1;
  } else {
    console.log(`Site/app agreement check passed: ${CASES.length}/${CASES.length} cases match.`);
  }
}

main()
  .catch((error) => {
    console.error('Parity check error:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
