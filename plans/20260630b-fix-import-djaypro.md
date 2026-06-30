# Fix import:djaypro — Plan

Audit findings and fixes for the djayPro CSV import script.

## Items

| # | File(s) | Change | Effort |
|---|---|---|---|
| 1 | `import-djaypro.ts:112-118` | Remove `genres: [], grouping: []` from `songData` — let `undefined` skip `unionMerge` entirely | Trivial |
| 2 | `import-djaypro.ts` | Add `convertKey(key)` — regex for standard notation + Camelot fallback map. Discard unrecognised with a warning | Small |
| 3 | `import-djaypro.ts:82-131` | Add per-track `try/catch` matching Apple Music/Rekordbox pattern: `console.error` + `errors++` | Small |
| 4 | `import-djaypro.ts:45-62, 89-95` | Fix CSV parser for escaped quotes (`""` → `"`). Remove redundant per-field quote stripping | Trivial |
| 5 | `import-djaypro.ts:35-43` | Extend `parseTimeToMs` for `hh:mm:ss` and `m:ss` | Trivial |
| 6 | All 3 importers | Fix `parseFloat(x) \|\| undefined` BPM-of-zero bug → `isNaN` guard | Trivial × 3 |
| 7 | `import-djaypro.ts` header | Document matching strategy (passive merge, fills nulls only) | Trivial |
| 8 | `import-djaypro.ts` header | Document imported + intentionally skipped fields | Trivial |
| 9 | — | No action | — |
| 10 | — | Removed from scope (safer to keep double-normalise) | — |
| 11 | — | Skipped | — |

## Files touched

- `src/api/scripts/import-djaypro.ts`
- `src/api/scripts/import-apple-music.ts` (item 6 only)
- `src/api/scripts/import-rekordbox.ts` (item 6 only)
