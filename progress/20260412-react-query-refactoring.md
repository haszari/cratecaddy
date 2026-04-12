# Implementation Plan: React Query Integration for API State Management

## Overview

Refactor frontend to use React Query for API requests, replacing direct fetch calls and manual state management.

## Current State

**App.tsx (HomePage):**
- Direct fetch to GET /api/songs in useEffect
- Manual useState for songs, tags, loading, error
- Client-side genre indexing with indexTags()
- Splits tags into main (count > 1) and fringe (count = 1)

**GenreDetail.tsx:**
- Direct fetch to GET /api/songs in useEffect
- Client-side filtering by genre
- Manual useState for allSongs, filteredSongs, tags, loading, error
- Duplicate indexTags() function

**Problem:** Both pages fetch all songs independently with no caching, duplicate code, and manual state management.

## Implementation Plan

### Phase 1: Dependencies and Setup

1. **Install React Query and DevTools**
   ```bash
   cd src/ui
   npm install @tanstack/react-query 
   npm install -D @tanstack/react-query-devtools
   ```

2. **Create Shared Types File**
   - Extract duplicate interfaces from App.tsx and GenreDetail.tsx
   - Create `src/ui/src/types/index.ts`
   - Export: Song, ISource, TagInfo

3. **Create API Client Module**
   - Create `src/ui/src/api/client.ts`
   - Centralize fetch logic with error handling
   - Export functions for each API endpoint
   - Use environment variable for base URL

### Phase 2: React Query Infrastructure

4. **Set up QueryClient and Provider**
   - Create `src/ui/src/lib/queryClient.ts`
   - Configure QueryClient with sensible defaults
   - Add QueryClientProvider to main.tsx
   - Wrap App component

5. **Add React Query DevTools**
   - Import ReactQueryDevtools from @tanstack/react-query-devtools
   - Add to main.tsx (conditionally in dev mode)

### Phase 3: Custom Hooks

6. **Create useSongs Hook**
   - Create `src/ui/src/hooks/useSongs.ts`
   - Use useQuery with query key `['songs']`
   - Fetch from `/api/songs`
   - Return: data, isLoading, error, refetch

7. **Create useSongsByGenre Hook**
   - Create `src/ui/src/hooks/useSongsByGenre.ts`
   - Use useSongs hook internally (shared cache)
   - Filter songs by genre parameter
   - Return: filteredSongs, isLoading, error, refetch

### Phase 4: Utility Functions

8. **Extract Helper Functions**
   - Create `src/ui/src/utils/tagUtils.ts`
   - Move `indexTags()` function from App.tsx
   - Move `indexTags()` function from GenreDetail.tsx
   - Export as reusable utility

9. **Extract GenreTagCloud Component**
   - Create `src/ui/src/components/GenreTagCloud.tsx`
   - Move from App.tsx
   - Accept tags as prop
   - Reusable in both pages

### Phase 5: Component Refactoring

10. **Refactor App.tsx**
    - Remove useState for songs, tags, loading, error
    - Remove useEffect fetch logic
    - Import and use useSongs hook
    - Import shared types from types/index.ts
    - Import indexTags from utils/tagUtils.ts
    - Import GenreTagCloud component
    - Simplify component logic

11. **Refactor GenreDetail.tsx**
    - Remove useState for allSongs, filteredSongs, tags, loading, error
    - Remove useEffect fetch logic
    - Import and use useSongsByGenre hook
    - Import shared types from types/index.ts
    - Import indexTags from utils/tagUtils.ts
    - Import GenreTagCloud component
    - Simplify component logic

### Phase 6: Testing and Validation

12. **Functional Testing**
    - Verify home page loads songs correctly
    - Verify genre detail page loads and filters correctly
    - Verify tag indexing works as before
    - Verify related tags display correctly
    - Verify song table displays correctly

13. **React Query Testing**
    - Verify caching works (navigate between pages, check network tab)
    - Verify background refetching (if configured)
    - Verify loading states display correctly
    - Verify error states display correctly
    - Verify dev tools show query state

14. **Edge Case Testing**
    - Test with empty song library
    - Test with large song library
    - Test with special characters in genre names
    - Test network errors

## Technical Considerations

### Query Key Strategy

- `['songs']` - All songs query
- `['songs', genre]` - Songs filtered by genre (if backend filtering added)
- Shared cache between useSongs and useSongsByGenre
- Client-side filtering for genre (current approach)

### QueryClient Configuration

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
  },
});
```

### Error Handling

- API client: catch network errors, parse responses, throw consistent errors
- Components: use React Query error state, display user-friendly messages

## Files to Create

### New Files:
- `src/ui/src/types/index.ts` - Shared TypeScript interfaces
- `src/ui/src/api/client.ts` - API client with fetch functions
- `src/ui/src/lib/queryClient.ts` - QueryClient configuration
- `src/ui/src/hooks/useSongs.ts` - Hook for fetching all songs
- `src/ui/src/hooks/useSongsByGenre.ts` - Hook for fetching songs by genre
- `src/ui/src/utils/tagUtils.ts` - Utility functions for tag indexing
- `src/ui/src/components/GenreTagCloud.tsx` - Reusable tag cloud component

## Files to Modify

### Modified Files:
- `src/ui/package.json` - Add @tanstack/react-query and @tanstack/react-query-devtools
- `src/ui/src/main.tsx` - Add QueryClientProvider and ReactQueryDevtools
- `src/ui/src/App.tsx` - Refactor to use useSongs hook and shared types
- `src/ui/src/pages/GenreDetail.tsx` - Refactor to use useSongsByGenre hook and shared types

## Implementation Phases

### Phase 1: Setup
- Install dependencies
- Create types file
- Create API client module

### Phase 2: Infrastructure
- Set up QueryClient
- Add QueryClientProvider
- Add ReactQueryDevtools

### Phase 3: Custom Hooks
- Create useSongs hook
- Create useSongsByGenre hook

### Phase 4: Utilities
- Extract tagUtils
- Create GenreTagCloud component

### Phase 5: Component Refactoring
- Refactor App.tsx
- Refactor GenreDetail.tsx

### Phase 6: Testing
- Functional testing
- React Query testing
- Edge case testing

---

## Progress Checklist

- [ ] Install @tanstack/react-query and @tanstack/react-query-devtools
- [ ] Create shared types file (src/ui/src/types/index.ts)
- [ ] Create API client module (src/ui/src/api/client.ts)
- [ ] Create QueryClient configuration (src/ui/src/lib/queryClient.ts)
- [ ] Add QueryClientProvider to main.tsx
- [ ] Add ReactQueryDevtools to main.tsx
- [ ] Create useSongs hook (src/ui/src/hooks/useSongs.ts)
- [ ] Create useSongsByGenre hook (src/ui/src/hooks/useSongsByGenre.ts)
- [ ] Extract indexTags to utils/tagUtils.ts
- [ ] Create GenreTagCloud component
- [ ] Refactor App.tsx to use useSongs hook
- [ ] Refactor GenreDetail.tsx to use useSongsByGenre hook
- [ ] Remove duplicate code from components
- [ ] Test home page functionality
- [ ] Test genre detail page functionality
- [ ] Verify caching works (check network tab)
- [ ] Verify loading states work
- [ ] Verify error states work
- [ ] Verify dev tools display correctly
- [ ] Test with empty song library
- [ ] Test with large song library
- [ ] Test network error handling
