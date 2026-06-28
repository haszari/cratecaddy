# Write to Apple Music for Multi-Edit

Write selected songs to Apple Music via osascript from the multi-song metadata edit form, with per-song status indicators in the song list.

---

## API Restructure (Verb-Style)

Replace the single `POST /api/songs/:id/write-to-apple-music` route with two verb-style routes:

| Method | Path | Body | Purpose |
|--------|------|------|---------|
| `POST` | `/api/songs/write-to-apple-music` | `{ ids: string[] }` | Batch write |
| `POST` | `/api/songs/write-to-apple-music/:id` | — | Single write |

No route ordering conflict — Express matches exact path before `:id` param.

### songService

```typescript
async writeToAppleMusic(songId: string): Promise<{ success: boolean; message: string }> {
  const song = await Song.findById(songId);
  if (!song) return { success: false, message: 'Song not found' };
  const { writeToAppleMusic: runWrite } = await import('./appleMusicWrite.js');
  return runWrite(song);
}

async writeToAppleMusicBatch(ids: string[]):
  Promise<{ results: { id: string; success: boolean; message: string }[] }> {
  const results: { id: string; success: boolean; message: string }[] = [];
  for (const id of ids) {
    const result = await this.writeToAppleMusic(id);
    results.push({ id, ...result });
  }
  return { results };
}
```

Sequential iteration — same 15s osascript timeout per song. Acceptable for v1 (2-10 songs).

### songController

```typescript
async writeToAppleMusicBatch(req: Request, res: Response) {
  try {
    const { ids } = req.body as { ids: string[] };
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids array is required' });
    }
    const result = await songService.writeToAppleMusicBatch(ids);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to write to Apple Music' });
  }
}
```

Update existing `writeToAppleMusic` to match new route signature (no change needed — already reads `req.params.id`).

### Routes

```typescript
router.post('/write-to-apple-music', (req, res) => songController.writeToAppleMusicBatch(req, res));
router.post('/write-to-apple-music/:id', (req, res) => songController.writeToAppleMusic(req, res));
```

Delete old `router.post('/:id/write-to-apple-music', ...)`.

---

## Client API

```typescript
export async function writeToAppleMusicBatch(ids: string[]):
  Promise<{ results: { id: string; success: boolean; message: string }[] }> {
  const response = await fetch(`${API_URL}/api/songs/write-to-apple-music`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
  });
  if (!response.ok) {
    const body = await response.json();
    throw new Error(body.error ?? 'Failed to write to Apple Music');
  }
  return response.json();
}
```

Update existing `writeToAppleMusic` to use new URL:
```typescript
`${API_URL}/api/songs/write-to-apple-music/${id}`
```

---

## MultiSongMetadataEditForm Changes

### New State
- `isExporting: boolean` (useState)
- `exportMsg: string`, `exportIsError: boolean`

### handleExportBatch
```typescript
const handleExportBatch = useCallback(async () => {
  setIsExporting(true);
  onDirtyChange?.(true);
  try {
    const { results } = await writeToAppleMusicBatch(songs.map(s => s._id!));
    const errors = results.filter(r => !r.success);
    if (errors.length === 0) {
      setExportMsg(`Written to ${results.length} song${results.length > 1 ? 's' : ''} in Apple Music`);
      setExportIsError(false);
      onExportComplete?.(results);
    } else {
      setExportMsg(`${errors.length} song(s) failed: ${errors[0].message}`);
      setExportIsError(true);
      onExportComplete?.(results);
    }
  } catch (err) {
    setExportMsg(err instanceof Error ? err.message : 'Write to Apple Music failed');
    setExportIsError(true);
  } finally {
    setIsExporting(false);
    onDirtyChange?.(false);
  }
}, [songs, onDirtyChange, onExportComplete]);
```

### Status Mode — 5-value
Merge save + export into single status span (same pattern as single-song form):
- `'idle'` | `'saving'` | `'exporting'` | `'save-result'` | `'export-result'`

### Actions Row Layout
```
[Save Changes] [Cancel]  3em gap  [Save to Apple Music]  margin-left:auto  [status]
```

- **Save**: unchanged
- **Cancel**: disabled when `!hasChanges || saveMutation.isPending || isExporting`
- **Spacer**: `.MultiSongMetadataEditForm-actions-gap` — 3em inline-block
- **Export button**: styled as pill (`.pill--action`)
  - Text: "Save to Apple Music" (normal), "Writing…" (exporting)
  - Disabled when `hasChanges || saveMutation.isPending || isExporting`

### Props
```typescript
interface MultiSongMetadataEditFormProps {
  songs: Song[];
  onDirtyChange?: (dirty: boolean) => void;
  onExportComplete?: (results: { id: string; success: boolean; message: string }[]) => void;
}
```

---

## Per-Song Status in CompactSongTable

### EditLayout
- Owns `songExportStatuses: Map<string, { success: boolean; message: string }>` state
- Initialised as empty Map
- Updated when MultiSongMetadataEditForm fires `onExportComplete`:
  ```typescript
  const handleExportComplete = useCallback(
    (results: { id: string; success: boolean; message: string }[]) => {
      setSongExportStatuses(prev => {
        const next = new Map(prev);
        for (const r of results) {
          next.set(r.id, { success: r.success, message: r.message });
        }
        return next;
      });
    }, []);
  ```
- Passes `songExportStatuses` to CompactSongTable

### CompactSongTable
- New prop: `exportStatuses?: Map<string, { success: boolean; message: string }>`
- In each row, after the song text, show an indicator:
  - Green checkmark ✓ for success
  - Red ✗ for error
  - Nothing if not in map

### CompactSongTable SCSS
```scss
.CompactSongTable-export-status {
  margin-left: 0.5em;
  font-size: 0.75em;
  user-select: none;

  &--success {
    color: #4caf50;
  }

  &--error {
    color: #e53935;
  }
}
```

---

## SCSS Additions

### MultiSongMetadataEditForm

```scss
.MultiSongMetadataEditForm-actions-gap {
  display: inline-block;
  width: 3em;
}

.MultiSongMetadataEditForm-export {
  // Reuse pill--action styling from single-song
  background: $pill-off-bg;
  color: $pill-off-text;
  padding: 0.5em 1em;
  border-radius: 0.5em;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
  border: none;

  &:hover:not(:disabled) {
    background: $pill-on;
    color: #fff;
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
}

.MultiSongMetadataEditForm-status {
  margin-left: auto;
}
```

---

## Edge Cases

- **osascript sequential 15s timeout**: Acceptable for v1 (typical 2-10 songs). Each call is independent.
- **Songs without appleMusicId**: Reported as individual errors with message "No appleMusicId — cannot identify track in Apple Music".
- **Export + save both pending**: Impossible — export requires clean form (`!hasChanges && !saveMutation.isPending`).
- **Cancel during export**: Cancel is disabled when `isExporting`.
- **Re-export after success**: Form is clean, export button re-enabled. User can click again (will re-write all songs).
- **Song list re-render after export**: Statuses persist in EditLayout Map until next export or page navigation.
- **Mixed results**: Partial failures show count + first error in status. Individual rows show green/red indicators.

---

## Out of Scope

- Writing per-song metadata diffs to Apple Music (uses DB state only)
- Parallel osascript execution (sequential only)
- Retry failed songs
- Progress bar per song
