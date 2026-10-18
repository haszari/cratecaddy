# JSON Snapshot for the published site

**Question:** If we build a published Snapshot, what data format delivers the song database to the browser with no backend?

The Snapshot is a plain JSON file (`src/ui/public/data/snapshot-<sha8>.json`), written at build time by `npm run snapshot` from MongoDB. The browser loads it once and filters in memory. The filename is the content hash of the song list, so a changed library produces a new URL and an unchanged one keeps the same name.

The payload is an allowlist of Song fields (see the snapshot script), wrapped with Snapshot metadata: version, `takenAt`, app version, commit, filter and count. Local file paths, file sizes, bit rates and import provenance are excluded.

The dataset is small (10K songs at ~500 bytes each = ~5 MB uncompressed, ~600 KB gzipped). All filtering, sorting, pagination and genre stats are array operations completing in sub-millisecond — `Array.filter()` and a Map reduce. No WASM, no worker, no initialisation delay.

This serves the club DJ use case: instant startup, works offline once loaded, zero network dependency. A service worker precaches the app shell and the Snapshot, with content revisions so a new deploy activates atomically.

Rejected alternatives:

1. **SQLite WASM (sql.js):** ~1 MB WASM bundle with 50-100ms initialization. FTS5 for full-text search is nice but overkill — regex on 10K strings is sub-millisecond. Worker complexity adds deployment overhead for no perceptible benefit at this scale.

2. **DuckDB WASM:** ~6 MB WASM bundle — larger than the entire song dataset. Designed for analytical queries on millions of rows, not genre tag filtering on 10K songs. Heavy startup cost, complex setup.

See also [ADR-0013](./0013-snapshot-build-two-shells-shared-engine.md) and [CONTEXT.md](../../CONTEXT.md) for the Snapshot definition.
