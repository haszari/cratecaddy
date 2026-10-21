# Library is CrateCaddy's own model, not a mirror of a music player

CrateCaddy keeps its own **Library** — the Songs in its database — as the source of truth for collection metadata. Apple Music, Rekordbox and djay Pro are peer systems that exchange data with it via Import and Export; none of them owns the Library. The Library's relationship to those systems is the app's core architecture, not an implementation detail of a particular import script.

This is what makes the rest possible: merging several sources into one Song, recording a History of writes, choosing a canonical Apple Music ID per Song, and serving builds (the API app, a published Snapshot) without any player running.

Rejected: treating Apple Music as the system of record. It was the starting shape (a metadata front-end for the Music app), but it would make every read depend on a running player, prevent cross-source merging, and make a Snapshot impossible.

Consequences:

- Import is a **merge**, not a mirror; a Song can have sources from several systems.
- Edits can diverge from the Apple Music copy and are reconciled only by Export.
- A Song may exist in the Library with no local file and no streaming source.
- Data owned by another system (persistent IDs, file paths, playback) is treated as interop data, not Library data.

See the glossary in [CONTEXT.md](../../CONTEXT.md).
