# Last-write-wins with separate History collection

**Question:** If songs are written by multiple sources (imports, manual edits), how do we store current state and track change history?

Song data is stored as flat current values on the Song document. Every write — import or manual edit — overwrites fields directly. A separate History collection records full snapshots for audit and recovery.

This replaced the earlier approach of layered overrides (merge-at-read with manual edits on top of import data) and embedded arrays of edits. The layered model required a `computeEffectiveSong` function at every read path, made aggregation (genre stats) complex, and still had ambiguous merge semantics for array fields.

Rejected alternatives:

1. **Merge-at-read (layered overrides):** a `manualEdits` field overlays on top of base fields. Complex read path; aggregation pipelines don't see effective values without unwinding in application code. Dropped for simplicity.

2. **Embedded history array on Song doc:** grows the document unboundedly; MongoDB's 16MB document limit is a real concern for songs with many import cycles. Moved to separate collection.

3. **Delta-only history:** each entry records only changed fields. Reconstructing state at a point in time requires replaying from the beginning. Full snapshots make querying "what did the song look like on date X" trivial.
