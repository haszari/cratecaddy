# NeDB for native app database

**Question:** If we build a native macOS app, what embedded database replaces MongoDB (which requires a separate `mongod` process)?

We will use NeDB (`@seald-io/nedb`) as the native app's embedded database. NeDB's MongoDB-like query API makes the migration from Mongoose mechanical — swap `Song.find()` to `db.find()`, replace `aggregate()` with ~15 lines of JS. Estimated 1-2 days of work.

The native app is an experiment. NeDB gets a working app fastest. The dataset is small (10K songs, ~5 MB). All queries translate directly — `$regex`, `$or`, `$and`, `$nor`, `$gte`, `$lte`, `$exists` are all supported. The main compound query (normalized artist+title + duration range ±2s) works as a single NeDB query, not two-step.

The 3 aggregation pipelines (genre stats, filtered genre stats, shuffle) will become in-memory JS with ~15 lines each. Performance at 10K docs is sub-millisecond for iteration, 50-200ms for filtered searches — imperceptible.

SQLite is the long-term pivot if the app proves worth investing in. See [SQLite as future pivot](../../plans/20260715-alternative-build-targets.md#sqlite-as-future-pivot) in the analysis doc for migration cost and benefits.

For full analysis including performance benchmarks and migration estimates, see [Alternative build targets analysis](../../plans/20260715-alternative-build-targets.md).

Rejected alternatives:

1. **SQLite via better-sqlite3 + Drizzle ORM:** Better long-term choice (proper aggregation, FTS5, WAL mode, web service compatibility), but 4-5 days of migration effort vs 1-2 days for NeDB. The native app is an experiment — the extra investment isn't justified yet. The merge/upsert logic (`updateWithHistory`) is the same algorithm regardless of database, so the pivot cost is predictable.

2. **Keep MongoDB (local or remote):** Zero data layer changes, but requires the user to install MongoDB locally (poor UX) or connect to Atlas (requires internet). Bundling `mongod` as a sidecar is ~300+ MB. Defeats the lightweight desktop app goal.
