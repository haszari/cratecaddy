/**
 * Build a hash function body for MongoDB $function aggregation.
 * The function runs inside MongoDB's JS engine, not Node.js, so the body
 * must be a string. The seed is injected at build time via JSON.stringify
 * to avoid closure issues in the mongo eval context.
 */
export function buildShuffleHashFunction(seed: string): string {
  return `function(id) {
    var hash = 0;
    var s = ${JSON.stringify(seed)};
    var str = id + s;
    for (var i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash);
  }`;
}
