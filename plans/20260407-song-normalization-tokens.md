# Plan: Normalization and Tokens for Songs

**Date**: 2026-04-07

## Overview
We will extend the `ISong` schema to include a `tokens` sub-structure for normalized and tokenized fields. These fields will help with:
- Faster and more accurate similarity matching.
- Observability and debugging of normalization logic.
- Manual disambiguation of songs (e.g., artists with the same name).

## Schema Changes
Add a `tokens` sub-structure to the `ISong` schema:

```typescript
interface ISong extends Document {
  // ...existing fields...
  tokens: {
    artist: string; // Normalized artist
    title: string; // Normalized title
    variation: string; // Normalized variation string
    variationType?: string; // Normalized variation type
  };
}
```

## Updated Tokens Structure

### Tokens Sub-Structure
- **`artist`**: Normalized version of the `artist` field.
- **`title`**: Normalized version of the `title` field with variation info stripped.
- **`variation`**: Normalized variation string with type words stripped (e.g., "Jimbob").
- **`variationType`**: Normalized variation type (e.g., "remix", "edit", "version").

## Logic to Generate Tokens

### 1. **Artist Token**
- Convert `artist` to lowercase.
- Remove punctuation.
- Replace synonyms (e.g., `&` → `and`).

### 2. **Title Token**
- Convert `title` to lowercase.
- Remove punctuation.
- Strip variation info using regex patterns:
  - Match and remove common variation patterns (e.g., `(Remix)`, `- Remix`, `(feat. ...)`).

### 3. **Variation Token**
- Extract variation info from `title` using regex patterns:
  - Match common variation patterns (e.g., `(Remix)`, `- Remix`, `(feat. ...)`).
  - Remove type words (e.g., "remix", "edit", "version", "radio").

### 4. **Variation Type Token**
- Identify variation type based on the presence of specific keywords:
  - Examples: "remix", "edit", "version", "radio" "mix" etc.
- Normalize the variation type to a predefined enum (e.g., `remix`, `edit`).

## Implementation Steps

### 1. Update Schema
- Add the `tokens` sub-structure to the `ISong` schema.

### 2. Implement Tokenization Logic
- Extend `songService` to compute the following:
  - `artist`
  - `title`
  - `variation`
  - `variationType`

### 3. Backfill Existing Records
- Write a script to process existing songs and populate the `tokens` sub-structure.

### 4. Index Tokens
- Add indexes to the following fields for efficient querying:
  - `tokens.artist`
  - `tokens.title`
  - `tokens.variation`
  - `tokens.variationType`

### 5. Update Hierarchical Matcher
- Modify the hierarchical matcher to use the `tokens` fields:
  - **Level 1**: Match on `tokens.artist` and `tokens.title`.
  - **Level 2**: Add duration check.
  - **Level 3**: Match on `tokens.variation` and `tokens.variationType`.

## Observability and Manual Updates
- The `tokens` sub-structure will allow manual updates for disambiguation (e.g., artists with the same name).
- Add an admin tool or script to edit `tokens` fields manually.

## Next Steps
1. Update the schema to include the `tokens` sub-structure.
2. Implement normalization and tokenization logic in `songService`.
3. Write a backfill script for existing records.
4. Update the hierarchical matcher to use the `tokens` fields.
5. Add indexes to the `tokens` fields.
6. (Optional) Create an admin tool for manual updates.

---

**Status**: In Progress