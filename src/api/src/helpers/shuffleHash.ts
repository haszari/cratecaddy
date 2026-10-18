/**
 * Deterministic shuffle key shared by the API and the Snapshot build.
 *
 * `shuffleHash` is the single implementation. The API needs a self-contained
 * function body to run inside MongoDB's `$function`; `buildShuffleHashFunction`
 * derives that body from `shuffleHash.toString()` so the two can never drift.
 *
 * Keep the function free of imports, closures and type annotations that do not
 * survive compilation — the generated body runs in MongoDB, not Node.js.
 */
export function shuffleHash(id: string, seed: string): number {
  let hash = 0;
  const str = id + seed;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash);
}

/**
 * Builds the `$function` body used in the Mongo aggregation pipeline.
 * The seed is injected at build time via JSON.stringify to avoid closure
 * issues in the mongo eval context.
 */
export function buildShuffleHashFunction(seed: string): string {
  return `function(id) {
    return (${shuffleHash.toString()})(id, ${JSON.stringify(seed)});
  }`;
}
