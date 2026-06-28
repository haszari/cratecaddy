# Toolbar Reorganisation + Filter Expansion

## BEFORE EXECUTING PLAN
- confirm if using live-refresh-whiletyping (like search) OR hit-enter-to-search (as current)
- decide based on human operator discussion, best practice, and internal app consistency

## Overview
Adopt Mantine UI (trial), reorganise FilterBar into three groups with space-between, add heart toggle (favorite filter), add debounced text search.

## Layout A (confirmed)
```
┌──────────────────────────────────────────────────────────────────┐
│ [🏠] [✏️] [🔀 🎲]         [✘Techno][✘House]        [❤] [60–120bpm✕] [🔍search…] │
│  ← nav/view (flex-start) →   ← exclude (center) →    ← filters (flex-end) →    │
└──────────────────────────────────────────────────────────────────┘
```

## Execution order

### 1. Adopt Mantine (trial)
- `npm install @mantine/core @mantine/hooks` (v9, React 19 compatible)
- Import `@mantine/core/styles.css` in `main.tsx`
- Wrap app with `<MantineProvider>` in `App.tsx`
- Components used: `ActionIcon`, `TextInput` (with `leftSection`), `Group`, `Tooltip`, `useDebouncedValue`
- Tempo RangeSlider deferred to follow-up plan
- Mantine v7+ uses native CSS, no CSS-in-JS. Zero conflict with MUI Emotion styles.

### 2. Backend: `favorite` filter param
- Add `favorite?: string` to `ApiFilterParams` in `apiParams.ts`
- Add `favorite` to `FILTER_PARAM_KEYS`
- In `buildSongFilter.ts`: if `favorite=true/1/starred`, add `{ favorite: 'starred' }` to conditions
- Song model already has `favorite?: 'starred' | 'normal' | 'disliked'`

### 3. Frontend: extend `useFilters` hook
- Add `favoriteActive: boolean` from `searchParams.get('favorite') === 'true'`
- Add `search: string` from `searchParams.get('search')`
- Add `toggleFavorite()` callback (toggles `favorite` param between `'true'` and absent)
- Add `setSearch()` callback (writes to URL param `search`)

### 4. FilterBar SCSS: new space-between layout
- Replace 3-equal-column flex with `display: flex; justify-content: space-between;`
- Three sub-containers: `.FilterBar-navGroup` (flex-start), `.FilterBar-excludeGroup` (center), `.FilterBar-filterGroup` (flex-end)
- Remove `.FilterBar-section-left/center/right`
- Tidy gap and padding

### 5. FilterBar TSX: reorganise controls
- nav/view (left): Home, Edit toggle (via `editHref`), Done (via `doneHref`, mutually exclusive with edit), ShuffleControl (only when `!readOnly`)
- exclude (center): Excluded tag chips (read-only in edit mode)
- filters (right): Heart toggle, BPM inputs, Search input

### 6. FilterBar: add heart toggle
- Prop: `favoriteActive: boolean`, `onFavoriteToggle?: () => void`
- Mantine `ActionIcon` + `<Heart>` from lucide-react
- Active: filled heart; inactive: outline
- readOnly: non-clickable display showing current state

### 7. FilterBar: add debounced text search
- Prop: `search: string`, `onSearchChange?: (val: string) => void`
- Mantine `TextInput` with `leftSection={<Search size={14} />}`
- Local input buffer state (`searchInput`), synced from prop on mount only
- `useDebouncedValue(searchInput, 300)` from `@mantine/hooks`
- `useEffect` fires `onSearchChange` when debounced value changes
- readOnly: static text `"search: {term}"`

### 8. Page wiring

| Page | nav/view | exclude | heart | tempo | search | editHref |
|------|----------|---------|-------|-------|--------|----------|
| Home | interactive | interactive | interactive | interactive | interactive | — |
| GenreDetail | interactive | interactive | interactive | interactive | interactive | ✅ |
| Artist | interactive | interactive | interactive | interactive | interactive | ✅ |
| EditMetadata | Home + Done | readOnly | readOnly | readOnly | readOnly | — |
| Song | Home only | — | — | — | — | — |

EditMetadata reads `favorite` and `search` URL params directly via `searchParams.get()` (same pattern as `bpm.gte`, `bpm.lte`, `genre.not`).

### 9. Follow-up: tempo RangeSlider plan
- Write `plans/2026xxxx-tempo-range-slider.md`
- Replace `input[type=number]` x2 with Mantine `RangeSlider`
- Show min/max value labels, wider, vertically centred, keep clear button

## Files changed

**Backend (2):**
- `src/api/src/helpers/apiParams.ts`
- `src/api/src/helpers/buildSongFilter.ts`

**Frontend (10):**
- `src/ui/package.json`
- `src/ui/src/main.tsx`
- `src/ui/src/App.tsx`
- `src/ui/src/hooks/useFilters.ts`
- `src/ui/src/components/FilterBar.tsx`
- `src/ui/src/components/FilterBar.scss`
- `src/ui/src/pages/EditMetadata.tsx`
- `src/ui/src/pages/Home.tsx`
- `src/ui/src/pages/GenreDetail.tsx`
- `src/ui/src/pages/Artist.tsx`
- `plans/2026xxxx-tempo-range-slider.md` (new)

## Critical gaps noted during review

1. **Search debounce edge case** — local input state must NOT re-sync from URL prop after user has edited. Sync only on initial mount.
2. **Mantine + MUI CSS ordering** — import Mantine CSS before component SCSS; test early for conflicts.
3. **Song page empty groups** — acceptable; no regression from current behaviour.
4. **EditMetadata must read `favorite` + `search` params** — same pattern as existing bpm/genreNot reads.
5. **MantineProvider wrapping order** — specify `MantineProvider > MUI ThemeProvider > BrowserRouter` if both exist.
6. **Mobile overflow** — out of scope for this PR.
7. **No test framework** — manual verification + lint only.
