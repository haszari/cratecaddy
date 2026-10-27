# What can I do with CrateCaddy?

CrateCaddy is a tool for finding, managing, and assembling music — your collection explored through tags. Everything in the app serves one of three activities.

The app calls tags "genres" — same thing, a historical field name. Here: tag = label = genre.

## Explore

Find music. Browse and filter the library by tags, artists, tempo, key, rating — to listen, discover combinations, or answer "do I have more techno around 133 BPM?".

- Related: Browse, Discover
- Current state: most fully realised. The read-only static build is Explore only.

In the app:

- **Home `/`** — tag cloud. Browse tags with counts; click a tag to include it, exclude it, filter by search / tempo / rating, shuffle.
- **Tag `/genre/:g`** — song list for one tag, or an AND (`+`) / OR (`,`) combination. Sort, paginate, refine with related tags.
- **Artist `/artist/:name`** — songs by an artist. Sort, filter, add or remove tags.
- **Song `/song/:id`** — a single track. Artist link, tags, bpm, key.

## Curate

Manage the collection. Bring music in (import), define tag conventions and rules, edit metadata, sync changes out.

- Related: Label, Collect, Tag
- Current state: working but custom for one user — Apple Music in, write-back out. Prototype of a more general import/edit/sync feature.

In the app:

- **Import (CLI)** — bring music in. `cratecaddy import [apple|djay] <file>`, `npm run import:rekordbox <xml>`.
- **Edit `/edit-metadata`** — edit a single song, or edit tags for multiple songs at once (bulk). Edit history, keyboard shortcuts.
- **Save to Apple Music** — write edited metadata back to Apple Music, one song or a batch.
- **Favourited `/favourited`** — starred songs, used as a process / review list while curating.

## Perform

Assemble music and use it live — put songs into a set or flow, log playlist while playing, combine and edit for performance.

- Related: Plan, Mix, Prepare
- Current state: early, little support yet. Next focus; will morph as it develops.

In the app: none yet.

---

Full entry-point → action map: [screen audit](./screen-audit.md).
