# Tempo UI Redesign + Toolbar Theme

## Overview

Replace the two-number-input BPM filter with a single pill-shaped tempo control using a centre + range model. Re-theme the toolbar with subtle grey background and consistent grey/white pill styling for filter controls.

## Live-update behaviour (confirmed)

| Interaction | Behaviour |
|-------------|-----------|
| Button clicks (↑ ↓ < >) | Immediate — single-tap action, no confirmation needed |
| Centre tempo number typing | Debounced live update (~300ms via `useDebouncedValue`, same pattern as search) |

## Layout

### Active tempo pill

```
[  <  120  ✕ 125 +-  130  >  ]
```

Elements (left to right):

| # | Element | Type | Behaviour |
|---|---------|------|-----------|
| 1 | `<` | full-height button | Narrows range by 1 bpm (min 0) |
| 2 | `120` | dimmed text | Computed min = centre − range, not editable |
| 3 | `✕` | full-height button | Clears BPM filter (removes all BPM URL params) |
| 4 | `125` | `<input type="number">` | Centre tempo, editable inline (`min=0`, `max=999`, step=1) |
| 5 | `+-` | 2-button vertical stack (↑↓) | Adjusts centre tempo by ±1 bpm per click |
| 6 | `130` | dimmed text | Computed max = centre + range, not editable |
| 7 | `>` | full-height button | Widens range by 1 bpm |

### Inactive (placeholder) pill

```
[  +  bpm  ]
```

- Compact pill, same grey/white styling
- Clicking + activates the full pill with empty centre and default range=5
- Clicking ↑↓ while empty sets centre=120 (per user spec: "up/down can start on 120 if clicked when empty")
- Typing in centre input activates with range=5

### Read-only state (EditMetadata page)

Same layout as active but:
- All buttons hidden (< > ✕ +-)
- Centre displayed as plain text (not editable)
- Hints still shown for context

## Data model

```
centre = bpmGte !== undefined || bpmLte !== undefined
       ? Math.round(((bpmGte ?? bpmLte!) + (bpmLte ?? bpmGte!)) / 2)
       : undefined

range  = bpmGte !== undefined && bpmLte !== undefined
       ? Math.floor((bpmLte - bpmGte) / 2)
       : 0
```

Derived:
- min hint = centre !== undefined ? centre − range : undefined
- max hint = centre !== undefined ? centre + range : undefined

On change → `onBpmChange(centre − range, centre + range)`

When range = 0: gte = lte = centre (exact match still works; backend $or includes songs with no BPM).

When clearing → `onBpmChange(undefined, undefined)`

## Theme: toolbar colour palette

| Token | Value | Usage |
|-------|-------|-------|
| toolbar bg | `rgba(0, 0, 0, 0.15)` | `.FilterBar` background |
| pill bg | `rgba(255, 255, 255, 0.9)` | Tempo pill, search pill |
| pill fg | `#333` | All pill text |
| pill hint fg | `#999` | Dimmed min/max hint text |
| pill border-radius | `0.5em` | Matches genre pill |
| icon buttons | transparent (unchanged) | Home, edit, shuffle — keep current style |
| exclude chips | red (unchanged) | Keep current `#ffcdd2` / `#c62828` |

## Search pill restyling

Currently a Mantine `TextInput` with default `"default"` variant. Change to:

- Same grey/white pill bg and rounded look as tempo pill
- Dark grey text (`#333`)
- `variant="filled"` with custom CSS override, or `variant="unstyled"` with full custom CSS
- Same `border-radius: 0.5em` and flat (no border) appearance

## Component structure

### New: `src/ui/src/components/TempoControl.tsx`

Full pill component. Props:
```tsx
interface TempoControlProps {
  bpmGte?: number;
  bpmLte?: number;
  onChange?: (gte?: number, lte?: number) => void;
  readOnly?: boolean;
}
```

### New: `src/ui/src/components/TempoControl.scss`

Styling for the pill layout, buttons, hints, stepper.

### Modified: `src/ui/src/components/FilterBar.tsx`

- Replace current `FilterBar-bpm` section with `<TempoControl>`
- Update search `TextInput` className or variant for pill styling

### Modified: `src/ui/src/components/FilterBar.scss`

- Add `.FilterBar` `background: rgba(0, 0, 0, 0.15)`
- Remove old BPM styles (`.FilterBar-bpm`, `.FilterBar-bpm-input`, etc.)
- Add pill-style `.FilterBar-search` styling

### No changes needed

- `useFilters.ts` — `setBpmRange(gte?, lte?)` contract unchanged
- `buildSongFilter.ts` — backend unchanged
- `apiParams.ts` — unchanged
- Pages (Home, GenreDetail, Artist, EditMetadata) — already pass correct props

## Behaviour details

- All buttons borderless, full-height of pill (matching genre pill button pattern)
- Up/down stepper: two buttons stacked vertically, each half the pill height, chevron icons (↑ ↓)
- Number input: no visible borders/bg, font-weight: 600, text-align: center, width ~2.5em
- Hover states: buttons get `rgba(0,0,0,0.1)` background
- Clear (✕) hover: `rgba(220, 38, 38, 0.15)` red tint
- Range can't go below 0; `<` button disabled when range = 0
- Centre tempo clamped to 0–999
- Local state buffer for centre input → `useDebouncedValue` 300ms → `onChange`

## Files changed

| File | Action |
|------|--------|
| `src/ui/src/components/TempoControl.tsx` | **Create** |
| `src/ui/src/components/TempoControl.scss` | **Create** |
| `src/ui/src/components/FilterBar.tsx` | Modify |
| `src/ui/src/components/FilterBar.scss` | Modify |

## Removed from scope (already done in previous PR)

- Mantine adoption (ActionIcon, TextInput, useDebouncedValue)
- Heart toggle
- Debounced search
- Layout reorg (three groups with space-between)

## Verification

- `npm run lint` (UI) — 0 errors, 2 pre-existing warnings only
- Manual: click up/down, type centre value, widen/narrow range, clear, verify URL params update
- Manual: EditMetadata page shows read-only pill correctly
- Manual: verify exclude chips and icon buttons unchanged
