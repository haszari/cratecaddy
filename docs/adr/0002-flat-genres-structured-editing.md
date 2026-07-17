# Flat genres storage with structured editing interface

**Question:** If genres are a flat string array shared between the database and Apple Music, how do we enable structured editing without breaking existing queries?

The `genres` array on the Song document remains a flat `string[]` for filtering, tag-cloud aggregation, and Apple Music round-trip compatibility. The edit UI decomposes it into purpose-specific sub-fields (stage, set, location, styles) for validation and guided entry.

This keeps existing features (genre stats, `genre.any`/`.all`/`.not` filters) working without changes while enabling rich editing. The assembly order when writing to Apple Music's single `genre` field is deterministic: `stage, set, ?location, styles (sorted)`.

Rejected alternative: storing genre sub-fields as dedicated MongoDB fields. This would require rewriting every query, filter builder, and aggregation pipeline that touches genres. The flat array is the shared language between the database and Apple Music's comma-separated genre field.
