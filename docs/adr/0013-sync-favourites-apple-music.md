# Favourite sync is heart-only, one-way Apple → DB

**Question:** What does "Sync with Apple Music" do for favourites?

**Decision:** The sync action (button on `/favourited`) reconciles Apple Music `Loved` ↔ DB `favorite: 'starred'` only, and only in the Apple → DB direction:

- DB songs starred but not Loved in Apple are un-starred (`favorite: 'normal'`).
- Apple Music Loved tracks matching a DB song are starred.
- Apple Music Loved tracks with no DB match are created, importing whatever metadata AppleScript can provide (name, artist, album, duration, genre, grouping, bpm, rating, year).
- `Disliked` is untouched. DB hearts are never written back to Apple.

**Rationale:** The user stars songs on the phone; CrateCaddy is the triage/curation layer. Heart = star matches the existing XML favourite-sync pass in `import-apple-music.ts`, so both entry points (CLI import and the in-app sync button) agree on semantics. The sync runs on the macOS host where `osascript` is available — the same constraint that governs `write-to-apple-music`.

**Rejected alternatives:**

1. **Two-way sync (DB → Apple write-back of hearts).** Writing DB state into Apple risks clobbering on-phone stars with stale DB state, and adds risk to the shared `appleMusicWrite.ts` write path. Deferred — could be added later as an explicit separate action.
2. **Full tri-state sync (Loved/Disliked/neither).** Adds disliked handling, UI surface, and merge complexity not requested by issue #18. The import mapping can still write `disliked`; only the sync button ignores it.
