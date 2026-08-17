/**
 * Split a comma-separated tags field (Apple Music Genre/Grouping) into a
 * trimmed, de-duplicated-free list of non-empty tokens.
 */
export function splitTagsField(fieldStr?: string): string[] {
  if (!fieldStr || fieldStr.trim() === '') return [];
  return fieldStr
    .split(',')
    .map((tag) => tag.trim())
    .filter((tag) => tag !== '');
}
