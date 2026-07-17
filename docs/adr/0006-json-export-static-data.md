# JSON export for static site data

**Question:** If we build a static site, what data format delivers the song database to the browser with no backend?

We will use a plain JSON file (`public/data/songs.json`) generated at build time by an export script that queries MongoDB. The browser will load it once and filter in memory.

The dataset is small (10K songs at ~500 bytes each = ~5 MB uncompressed, ~500 KB gzipped). All filtering, sorting, genre stats, and pagination are simple `Array.filter()` / `Array.reduce()` operations that complete in sub-millisecond. No WASM, no worker, no initialization delay — just `JSON.parse()`.

This serves the club DJ use case: instant startup, works offline once loaded, zero network dependency. A service worker caches the JSON file and app shell for reliable offline use.

For full analysis, see [Alternative build targets analysis](../../plans/20260715-alternative-build-targets.md).

Rejected alternatives:

1. **SQLite WASM (sql.js):** ~1 MB WASM bundle with 50-100ms initialization. FTS5 for full-text search is nice but overkill — regex on 10K strings is sub-millisecond. Worker complexity adds deployment overhead for no perceptible benefit at this scale.

2. **DuckDB WASM:** ~6 MB WASM bundle — larger than the entire song dataset. Designed for analytical queries on millions of rows, not genre tag filtering on 10K songs. Heavy startup cost, complex setup.
