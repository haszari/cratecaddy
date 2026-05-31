# Metadata editor — implementation plan

## Status

Steps 1–5 complete (Song+History models, import rewrite, re-import, legacy code removal, API endpoints). Step 6 (edit UI) is scaffolded but needs full rebuild with MUI.

## Architecture decisions

### Add MUI v7 + Emotion

Replace custom SCSS form inputs with MUI components. `@mui/material`, `@emotion/react`, `@emotion/styled`. Keep existing Lucide icons (no `@mui/icons-material`). App sits in `<ThemeProvider>` with a custom theme matching the current aesthetic: flat, subtle borders, pale backgrounds, small border-radius. Eventually migrate app-wide SCSS into MUI theme overrides — no rush.

### Edit mode entry

- Toggle button in header bar (current FilterBar "ED" button). Same for all three song-list pages (Home, GenreDetail, Artist).
- Keyboard `e` to toggle.
- All pages supported: Home, GenreDetail, Artist. Not on Song detail page (v1).

### Layout

Split pane: CompactSongTable (left, ~40%) + SongEditForm (right, ~60%). Resize not needed in v1.

**CompactSongTable**: `<table>` element sharing `SongTable`'s row styling. Same component with columns hidden:
- Visible: Artist, Title
- Hidden: Sources, Genres, Rating, BPM, Key
- Selected row gets highlight (same as current CompactSongTable row highlight).
- No pagination — shows current page's songs only.

**SongEditForm**: flexbox with gap, fields flow naturally.

### Keyboard shortcuts

Global (no field focused):

| Key | Action |
|-----|--------|
| `↑`/`↓` | Navigate songs |
| `Escape` | Exit edit mode |
| `1`–`5` | Set rating |
| `d` | Toggle DJing grouping |
| `l` | Toggle Listening grouping |
| `t` | Focus title |
| `a` | Focus artist |
| `g` | Focus styles autosuggest |
| `b` | Focus BPM |
| `y` | Focus year |
| `r` | Focus rating |

Key field (when focused):

| Key | Action |
|-----|--------|
| `Shift+A`–`Shift+G` | Set root note |
| `+` (`Shift+=`) | Toggle sharp |
| `m` | Toggle minor |

### Save model

Auto-save on blur, 800ms debounce. Collects all pending changes into a single PUT `/api/songs/:id/metadata`. Prevent empty title/artist (validation on blur, revert to previous value).

### Genre decomposition (at edit time)

Parse `song.genres` on form open:

- If a token matches a known **stage** (`Warmup`, `Peak`, `Later`) → set stage field
- If a token matches a known **set** (`Deep`, `BAM`, `Ambient`) → set set field
- If token is `NZ` → set location checkbox
- Everything else → styles array

Ambient is both a set and a listening style. Set token takes priority during decomposition.

### Genre reassembly (on save)

Order: `styles (alphabetically), ?NZ, set, stage`

This means: descriptive free-form tags first, then location, then structural classification at the end. Example: `Minimal, Dub Techno, NZ, Warmup, Deep`.

Strip empty/falsy values before sending.

### Grouping field

Toggle button group with two chips: `[DJing] [Listening]`. At least one always active. Click toggles individually (both on = both on). Values map directly to the `grouping: string[]` field on Song.

### Key field

MUI Select (dropdown) for root note: `C, C#, D, D#, E, F, F#, G, G#, A, A#, B`. Toggle button for sharp (`♯`). Toggle button for minor (`m`). Minor toggle appends `m` to the root. Sharp toggle replaces natural with `#` variant. The three components compose into a single value string.

Storage: `key` field on Song, e.g. `"F#m"`, `"G"`, `"Dm"`.

### Location (NZ)

Single toggle chip labelled `NZ`. When active, inserts `"NZ"` into the genres array at the `?location` position. No other locations get special UI — they appear in the styles bucket if they exist.

### Styles autosuggest

MUI Autocomplete with `freeSolo`, `multiple` (chip mode). Suggestion source: all unique genre tokens from the DB, excluding known org tags (stage/set values and "NZ"). Sorted by popularity (most-used first). `filterOptions` filters against current input.

When grouping contains Listening, show a subtle hint below the field: "Common: Jazz, Funk, Classical, Contemporary, Electronic, Dance, Hip Hop, Pop, Rock, Country, Indie, Ambient".

### Validation / requiredness UI

Fields Set, Stage, Styles get **bold labels** + subtle highlight/underline on their input when:
- Grouping contains DJing, AND
- The field is empty

Grouping containing Listening does not trigger requiredness for Set/Stage.

Validation is visual guidance only — no block on save.

### Reassembly order contingency

The current assembly order (`styles, NZ, set, stage`) may be customised per-user later. Not in scope for v1.

## Implementation steps (Step 6)

### 6a. Install MUI

```sh
npm install @mui/material @emotion/react @emotion/styled
```

### 6b. Create MUI theme

`src/ui/src/styles/theme.ts` — `createTheme` with custom palette (match current app), shape (small border-radius), typography (system-ui), and component overrides for palette, shape, typography.

Wrap `<App>` in `<ThemeProvider>`.

### 6c. Refactor CompactSongTable

Replace with `<table>` based rendering. Import row layout from `SongTable`. Conditionally hide columns. Add selected-row highlighting. Remove `.CompactSongTable.scss` (or gut it).

### 6d. Build SongEditForm (MUI version)

Rewrite `SongEditForm.tsx`:

- **Artist | Title**: MUI TextField, multiline? single-line. Auto-save on blur.
- **Grouping**: MUI ToggleButtonGroup with two values. At least one selected.
- **BPM | Year**: MUI TextField type="number".
- **Key**: MUI Select + two MUI ToggleButtons (sharp/minor). Compose value string on change.
- **Set | Stage**: MUI Select dropdowns.
- **Location**: MUI ToggleButton for NZ.
- **Styles**: MUI Autocomplete, freeSolo, multiple, chip mode. Async suggestions sorted by popularity.
- **Favorite**: Three MUI ToggleButtons (star/circle/x). Or MUI ToggleButtonGroup.
- **Export**: MUI Button.

Debounce logic: collect changes in a `useRef` accumulator, flush on blur after 800ms.

### 6e. Genre decomposition hook

`useGenreDecomposition` — takes `song.genres`, returns `{ stage, set, location, styles }`. Memoized. Also provides `reassemble(stage, set, location, styles, grouping)` for the save side.

### 6f. Keyboard shortcut system

Centralise in `useEditMode` or a new `useEditKeyboard` hook. Based on a field focus ref that components register into. Global shortcuts handled at the `EditLayout` level (already done for j/k). Add ↑/↓, field focus hotkeys, rating, grouping toggles.

### 6g. History display

Keep existing history list at bottom of form (MUI List or simple divs). Scrollable.

### 6h. Remove old CSS

Remove `SongEditForm.scss`, gut `CompactSongTable.scss`, clean up `EditLayout.scss` (MUI handles field styling now — EditLayout retains layout SCSS for the split pane).

## Verification

- `npm run dev` — UI renders, edit mode toggles, form fields work
- Edit a song on each page (Home, GenreDetail, Artist)
- Verify genres decompose correctly (known tokens → fields, rest → styles)
- Verify genres reassemble correctly on save
- Verify export to Apple Music produces correct genre string
- Keyboard shortcuts work without conflicts
- `npm run build` — compiles without errors
- `npm run lint` — 0 errors

## Commit strategy

Waypoint commits, one per logical sub-step above. Format:

```
[agent opencode-big-pickle <agent>] step 6a: install MUI v7 + Emotion
[agent opencode-big-pickle <agent>] step 6b: create MUI theme with light palette
[agent opencode-big-pickle <agent>] step 6c: refactor CompactSongTable to share SongTable row styles
[agent opencode-big-pickle <agent>] step 6d: rebuild SongEditForm with MUI components
...
```
