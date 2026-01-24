# Implementation Plan: Song-Based Normalization with Musical Key Support

## Overview

This plan implements a fundamental refactor to support song-based normalization, where:
1. **Songs** are the primary entity (one song can have multiple file instances)
2. **File-specific data** lives in a `sources[]` array
3. **Fuzzy matching** on artist + title + duration to match songs across sources
4. **Musical key** field added to song metadata
5. **Merge operations** to combine data from multiple sources

## 1. Schema Refactor: Song-Based Normalization

### 1.1 New Schema Structure

**Song-Level Fields** (metadata about the song itself):
- `title` (string, required, indexed)
- `artist` (string, indexed)
- `album` (string)
- `duration` (number, milliseconds) - **used for matching**
- `genres` (string array, indexed)
- `grouping` (string array)
- `bpm` (number)
- `year` (number)
- `key` (string, optional, indexed) - **NEW**
- `rating` (number, 0-5 scale)

**Sources Array** (file-specific data):
- `sources[]` - Array of source objects, each containing:
  - `sourceType` (string): "applemusic" | "rekordbox" | "djaypro" | "local"
  - `filePath` (string): File location/URL
  - `fileSize` (number): File size in bytes
  - `bitRate` (number): Audio bit rate
  - `fileType` (string): File format (e.g., "MPEG audio file", "AAC audio file", "AIFF", "MP3")
  - `sourceMetadata` (object): Source-specific data
    - For Apple Music: `id`, `persistentId`, `dateAdded`, `dateModified`, `dateLastPlayed`, `trackType`, `isProtected`, `isAppleMusic`
    - For Rekordbox: `trackId`, `location`, `dateAdded`
    - For dJay Pro: `url`
  - `lastImportDate` (date): When this source was last imported

### 1.2 Migration from Current Schema

**Fields to move from top-level to `sources[]`**:
- `filePath` → `sources[].filePath`
- `fileSize` → `sources[].fileSize`
- `bitRate` → `sources[].bitRate`
- `appleMusic` → `sources[].sourceMetadata` (for Apple Music sources)

**Fields to keep at song level**:
- `title`, `artist`, `album`, `duration`, `genres`, `grouping`, `bpm`, `year`, `rating`
- Add `key` at song level

### 1.3 Schema Implementation

```typescript
interface ISource {
  sourceType: 'applemusic' | 'rekordbox' | 'djaypro' | 'local';
  filePath?: string;
  fileSize?: number;
  bitRate?: number;
  fileType?: string;
  sourceMetadata?: Record<string, any>;
  lastImportDate: Date;
}

interface ISong extends Document {
  title: string;
  artist: string;
  album: string;
  duration?: number; // milliseconds - used for matching
  genres: string[];
  grouping: string[];
  bpm?: number;
  year?: number;
  key?: string; // NEW
  rating?: number;
  sources: ISource[]; // NEW - replaces filePath, fileSize, bitRate, appleMusic
  createdAt: Date;
  updatedAt: Date;
}
```

## 2. Song Matching Logic

### 2.1 Matching Principles

**Primary Match Criteria** (all three required):
1. **Artist** - Normalized (trim, lowercase, remove punctuation)
2. **Title** - Normalized (trim, lowercase, remove punctuation)
3. **Duration** - Within 1-2 seconds tolerance (±1000-2000ms)

**Fuzzy Matching Rules**:
- **Text normalization**: 
  - Trim whitespace
  - Convert to lowercase
  - Remove/replace punctuation (keep essential characters)
  - Normalize unicode characters
- **Duration matching**:
  - Exact match preferred
  - ±1000ms (1 second) tolerance for primary match
  - ±2000ms (2 seconds) tolerance for secondary match
  - Rare to get clashes with same artist+title but different duration

### 2.2 Matching Function

**Location**: `src/api/src/services/songService.ts`

**Function**: `findMatchingSong(artist: string, title: string, duration: number): Promise<ISong | null>`

**Algorithm**:
1. Normalize artist and title
2. Query songs where:
   - Normalized artist matches
   - Normalized title matches
   - Duration is within ±2000ms
3. Return best match (prefer exact duration match)
4. If no match found, return null (create new song)

**Normalization Function**: `normalizeText(text: string): string`
- Trim, lowercase, remove punctuation, normalize whitespace

## 3. Merge Operations

### 3.1 Merge Strategy

When matching an existing song:

1. **Song-Level Fields**:
   - **Arrays (genres, grouping)**: Union merge (add new unique elements)
   - **Simple fields (bpm, year, rating, key)**: Prefer new value if provided
   - **Duration**: Use most accurate/precise value (prefer non-zero)

2. **Sources Array**:
   - Check if source already exists (by `sourceType` + `filePath` or `sourceMetadata.id`)
   - If exists: Update that source entry
   - If new: Add to `sources[]` array
   - Never remove existing sources

### 3.2 Merge Function

**Function**: `mergeSongData(existing: ISong, incoming: Partial<ISong>, newSource: ISource): Partial<ISong>`

**Logic**:
- Merge song-level fields (arrays union, simple fields prefer new)
- Add/update source in `sources[]` array
- Return merged song data

## 4. Import Script Updates

### 4.1 Apple Music Import

**Changes**:
- Extract song-level data: title, artist, album, duration, genres, grouping, bpm, year, rating
- Create source object with:
  - `sourceType: "applemusic"`
  - `filePath`: Location field
  - `fileSize`: Size field
  - `bitRate`: Bit Rate field
  - `fileType`: Kind field
  - `sourceMetadata`: { id, persistentId, dateAdded, dateModified, dateLastPlayed, trackType, isProtected, isAppleMusic }
- Use `findMatchingSong()` to find existing song
- If found: merge and add/update source
- If not found: create new song with source

### 4.2 Rekordbox Import

**Changes**:
- Extract song-level data: title (Name), artist, album, duration (TotalTime), genres, grouping, bpm (AverageBpm), year, **key (Tonality)**
- Create source object with:
  - `sourceType: "rekordbox"`
  - `filePath`: Location field
  - `fileSize`: (if available)
  - `bitRate`: BitRate field
  - `fileType`: Kind field
  - `sourceMetadata`: { trackId, location, dateAdded }
- Use `findMatchingSong()` to find existing song
- If found: merge and add/update source
- If not found: create new song with source

### 4.3 dJay Pro CSV Import (NEW)

**Features**:
- Parse CSV: Title, Artist, Album, Time (duration), BPM, Key, URL
- Extract song-level data: title, artist, album, duration (parse "MM:SS" format), bpm, **key**
- Create source object with:
  - `sourceType: "djaypro"`
  - `filePath`: URL field (decoded)
  - `sourceMetadata`: { url }
- Use `findMatchingSong()` to find existing song
- If found: merge and add/update source
- If not found: create new song with source

## 5. Implementation Phases

### Phase 1: Schema Refactor
1. Update Song model with new structure (sources array, remove filePath/fileSize/bitRate from top level)
2. Add `key` field to song schema
3. Update ISong interface
4. Create ISource interface

### Phase 2: Matching Logic
5. Implement `normalizeText()` function
6. Implement `findMatchingSong()` function with fuzzy matching
7. Add indexes for normalized artist/title fields (for performance)

### Phase 3: Merge Operations
8. Implement `mergeSongData()` function
9. Implement source merge logic (add/update sources array)

### Phase 4: Import Script Refactor
10. Refactor Apple Music import to use new schema and matching
11. Refactor Rekordbox import to use new schema and matching
12. Create dJay Pro CSV import script

### Phase 5: Testing & Validation
13. Test matching logic with duplicate songs (same song, different file types)
14. Test merge operations with multiple sources
15. Test key import from Rekordbox and dJay Pro

### Phase 6: Documentation
16. Update README with new import commands
17. Document song matching behavior
18. Document sources array structure

## 6. Technical Considerations

### 6.1 Matching Performance
- **Indexes**: Create indexes on normalized artist and title fields
- **Query optimization**: Use compound index on (normalizedArtist, normalizedTitle, duration)
- **Caching**: Consider caching normalized values

### 6.2 Data Migration
- **Existing data**: Need migration script to:
  - Move filePath/fileSize/bitRate to sources[] array
  - Convert appleMusic to source entry
  - Normalize existing songs for matching

### 6.3 Edge Cases
- **Same song, different durations**: Use closest match within tolerance
- **Missing duration**: Fall back to artist+title only (less reliable)
- **Missing artist/title**: Skip or use partial matching
- **Multiple sources with same filePath**: Deduplicate or update existing

## 7. Example Scenarios

### Scenario 1: Same Song, Different File Types
- Library.xml has "Funk Like Dis" as .mp3 (duration: 302000ms)
- dJay Pro CSV has "Funk Like Dis" as .aiff (duration: 302000ms)
- **Result**: Single song record with 2 sources in `sources[]` array

### Scenario 2: Import dJay Pro CSV after Apple Music
- Apple Music import: "We Run" by Bailey Ibbs (no key, duration: 371000ms)
- dJay Pro CSV: "We Run" by Bailey Ibbs (key: "Am", duration: 371000ms)
- **Result**: Song matched, key added, dJay Pro source added to sources[]

### Scenario 3: Import Rekordbox with Key
- Existing song from Apple Music (no key)
- Rekordbox import: Same song with key "Gm" from Tonality field
- **Result**: Song matched, key updated to "Gm", Rekordbox source added

## 8. Files to Create/Modify

### New Files:
- `src/api/scripts/import-djaypro.ts` - dJay Pro CSV importer
- `src/api/scripts/migrate-to-sources.ts` - Migration script for existing data

### Modified Files:
- `src/api/src/models/Song.ts` - Complete schema refactor (sources array, add key)
- `src/api/src/services/songService.ts` - Add matching and merge logic
- `src/api/scripts/import-apple-music.ts` - Refactor to use new schema and matching
- `src/api/scripts/import-rekordbox.ts` - Refactor to use new schema and matching, extract key
- `README.md` - Document new structure and import commands

---

## Progress Checklist

- [ ] Song schema refactored with sources[] array
- [ ] File-specific fields moved from top-level to sources array
- [ ] Musical key field added to song schema
- [ ] Fuzzy matching implemented on artist, title, and duration
- [ ] Songs are correctly matched across different import sources
- [ ] Same song with different file types creates single record with multiple sources
- [ ] Keys can be imported from Rekordbox library
- [ ] Keys can be imported from dJay Pro CSV export
- [ ] Merge operations combine data from multiple sources correctly
- [ ] Genres merge correctly when importing from multiple sources
- [ ] Import scripts use new schema and matching logic
