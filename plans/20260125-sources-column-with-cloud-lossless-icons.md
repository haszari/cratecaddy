# Implementation Plan: Sources Column with Cloud & Lossless Icons

## Overview

This plan implements a Sources column in the song table that displays:
1. **Cloud status** - Cloud icon when all versions are cloud-based (Apple Music streaming)
2. **Lossless availability** - Diamond icon when lossless formats (AIFF, WAV, FLAC) are available
3. **Icon rendering** - Using monochrome icon fonts for theme compatibility

## 1. Icon Solution Research

### 1.1 Icon Font Options

**Option 1: Lucide Icons (Recommended)**
- Modern, comprehensive icon library
- React components available
- Monochrome, theme-friendly
- Cloud icon: `Cloud`
- Diamond icon: `Diamond`
- Installation: `npm install lucide-react`

**Option 2: Heroicons**
- Adobe's icon library
- React components
- Cloud icon: `CloudIcon`
- Diamond icon: `SparklesIcon` (closest to diamond)
- Installation: `npm install @heroicons/react`

**Option 3: Font Awesome**
- Classic icon font
- Web font approach
- Cloud icon: `fas fa-cloud`
- Diamond icon: `fas fa-gem`
- Installation: `npm install @fortawesome/fontawesome-free`

**Option 4: CSS-only Icons**
- No dependencies
- Unicode symbols or SVG
- Cloud: `☁` (U+2601)
- Diamond: `♦` (U+2666)

### 1.2 Recommended Approach: Lucide React

**Benefits:**
- Tree-shakable (only import used icons)
- TypeScript support
- Consistent design language
- Easy to customize with CSS
- No font loading issues

**Installation:**
```bash
cd src/ui
npm install lucide-react
```

## 2. Data Structure Analysis

### 2.1 Current Sources Structure
```typescript
interface ISource {
  sourceType: 'applemusic' | 'rekordbox' | 'djaypro' | 'local';
  filePath?: string;
  fileSize?: number;
  bitRate?: number;
  fileType?: string;
  sourceMetadata?: {
    isAppleMusic?: boolean; // Key for cloud detection
    // ... other metadata
  };
  lastImportDate: Date;
}
```

### 2.2 Logic Requirements

**Cloud Detection:**
- Show cloud icon if ALL sources have `isAppleMusic: true`
- Hide cloud icon if ANY source is local (has filePath)

**Lossless Detection:**
- Show diamond icon if ANY source has lossless fileType
- Lossless formats: AIFF, WAV, FLAC, ALAC
- Check `fileType` field for these extensions

## 3. Implementation Plan

### 3.1 Phase 1: Icon Setup

1. **Install Lucide React**
2. **Create Icon Component**
```typescript
// src/ui/src/components/SourcesIcons.tsx
import { Cloud, Diamond } from 'lucide-react';

interface SourcesIconsProps {
  sources: ISource[];
}

export function SourcesIcons({ sources }: SourcesIconsProps) {
  const isAllCloud = sources.every(s => s.sourceMetadata?.isAppleMusic);
  const hasLossless = sources.some(s => 
    ['AIFF', 'WAV', 'FLAC', 'ALAC'].some(format => 
      s.fileType?.includes(format)
    )
  );

  return (
    <div className="sources-icons">
      {isAllCloud && <Cloud size={16} className="cloud-icon" />}
      {hasLossless && <Diamond size={16} className="lossless-icon" />}
    </div>
  );
}
```

### 3.2 Phase 2: UI Integration

3. **Update Song Interface**
```typescript
interface Song {
  _id?: string;
  title: string;
  artist: string;
  genres: string[];
  bpm?: number;
  rating?: number;
  key?: string;
  sources: ISource[]; // Add sources array
}
```

4. **Update Table Headers**
```typescript
// Add Sources column after Rating
<th>Sources</th>
```

5. **Update Table Data**
```typescript
<td>
  <SourcesIcons sources={song.sources} />
</td>
```

### 3.3 Phase 3: Styling

6. **CSS Styling**
```scss
// src/ui/src/components/SourcesIcons.scss
.sources-icons {
  display: flex;
  gap: 0.5em;
  align-items: center;
  justify-content: center;
  
  .cloud-icon {
    color: #666; // Will inherit text color
    opacity: 0.8;
    
    &:hover {
      opacity: 1;
    }
  }
  
  .lossless-icon {
    color: #666; // Will inherit text color
    opacity: 0.8;
    
    &:hover {
      opacity: 1;
    }
  }
}
```

7. **Table Styling Updates**
```scss
// src/ui/src/pages/GenreDetail.scss
table {
  th, td {
    &:last-child { // Sources column
      width: 80px; // Fixed width for icons
      text-align: center;
    }
  }
}
```

## 4. Technical Considerations

### 4.1 Data Flow
- Backend already includes `sources` array in API responses
- Frontend needs to parse sources array for each song
- Icons update automatically when sources change

### 4.2 Performance
- Lucide icons are tree-shakable
- Component is lightweight (simple conditional logic)
- No additional API calls needed

### 4.3 Accessibility
- Add `title` attributes for icon tooltips
- Consider `aria-label` for screen readers
```typescript
<Cloud 
  size={16} 
  className="cloud-icon" 
  title="All versions are cloud-based"
/>
<Diamond 
  size={16} 
  className="lossless-icon" 
  title="Lossless version available"
/>
```

### 4.4 Edge Cases
- **No sources**: Show no icons
- **Mixed sources**: Show diamond if lossless, no cloud if any local
- **Unknown file types**: Default to not lossless
- **Missing metadata**: Default to not cloud

## 5. Example Scenarios

### Scenario 1: Apple Music Streaming Only
```json
{
  "sources": [
    {
      "sourceType": "applemusic",
      "sourceMetadata": { "isAppleMusic": true }
    }
  ]
}
```
**Result**: Cloud icon only

### Scenario 2: Local AIFF + MP3
```json
{
  "sources": [
    {
      "sourceType": "applemusic",
      "fileType": "AIFF audio file",
      "filePath": "file://..."
    },
    {
      "sourceType": "applemusic", 
      "fileType": "MPEG audio file",
      "filePath": "file://..."
    }
  ]
}
```
**Result**: Diamond icon only

### Scenario 3: Mixed Cloud + Local Lossless
```json
{
  "sources": [
    {
      "sourceType": "applemusic",
      "sourceMetadata": { "isAppleMusic": true }
    },
    {
      "sourceType": "rekordbox",
      "fileType": "WAV audio file",
      "filePath": "file://..."
    }
  ]
}
```
**Result**: Both cloud and diamond icons

### Scenario 4: Local MP3 Only
```json
{
  "sources": [
    {
      "sourceType": "applemusic",
      "fileType": "MPEG audio file",
      "filePath": "file://..."
    }
  ]
}
```
**Result**: No icons

## 6. Files to Create/Modify

### New Files:
- `src/ui/src/components/SourcesIcons.tsx` - Icon component
- `src/ui/src/components/SourcesIcons.scss` - Icon styling

### Modified Files:
- `src/ui/package.json` - Add lucide-react dependency
- `src/ui/src/App.tsx` - Update Song interface
- `src/ui/src/pages/GenreDetail.tsx` - Add Sources column
- `src/ui/src/pages/GenreDetail.scss` - Table styling updates

## 7. Implementation Phases

### Phase 1: Setup (Day 1)
- Install lucide-react
- Create SourcesIcons component
- Add basic styling

### Phase 2: Integration (Day 1)
- Update Song interfaces
- Add Sources column to table
- Test with sample data

### Phase 3: Refinement (Day 2)
- Add tooltips and accessibility
- Refine styling and responsiveness
- Test edge cases

### Phase 4: Testing (Day 2)
- Test with various source combinations
- Verify icon display logic
- Check theme compatibility

## 8. Success Criteria

- [ ] Cloud icon displays when all sources are Apple Music streaming
- [ ] Diamond icon displays when lossless formats are available
- [ ] Icons render correctly in light/dark themes
- [ ] No performance impact on table rendering
- [ ] Accessible with tooltips and screen reader support
- [ ] Responsive design works on mobile devices

---

## Progress Checklist

- [ ] Install lucide-react icon library
- [ ] Create SourcesIcons component with cloud/diamond logic
- [ ] Update Song interface to include sources array
- [ ] Add Sources column to GenreDetail table
- [ ] Implement CSS styling for icons
- [ ] Add accessibility features (tooltips, aria-labels)
- [ ] Test with various source combinations
- [ ] Verify theme compatibility
- [ ] Test responsive design
