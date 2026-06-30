import { exec } from 'child_process';
import { ISong } from '../models/Song.js';

function escapeAppleScript(str: string): string {
  return str.replace(/"/g, '\\"').replace(/\n/g, ' ');
}

function writeToSingle(targetId: string, escaped: Record<string, string>, commentBlock: string): Promise<boolean> {
  const scriptLines: string[] = [
    `tell application "Music"`,
    `  try`,
    `    set t to (first track of library playlist 1 whose persistent ID is "${targetId}")`,
    `    set name of t to "${escaped.title}"`,
    `    set artist of t to "${escaped.artist}"`,
  ];

  if (escaped.album) scriptLines.push(`    set album of t to "${escaped.album}"`);
  if (escaped.genre) scriptLines.push(`    set genre of t to "${escaped.genre}"`);
  if (escaped.grouping) scriptLines.push(`    set grouping of t to "${escaped.grouping}"`);
  if (escaped.bpm) scriptLines.push(`    set bpm of t to ${escaped.bpm}`);
  if (escaped.rating) scriptLines.push(`    set rating of t to ${escaped.rating}`);
  if (escaped.year) scriptLines.push(`    set year of t to ${escaped.year}`);

  scriptLines.push(...commentBlock.trim().split('\n').map(l => `    ${l.trim()}`));
  scriptLines.push(`    return "ok"`);
  scriptLines.push(`  on error errMsg`);
  scriptLines.push(`    return "error: " & errMsg`);
  scriptLines.push(`  end try`);
  scriptLines.push(`end tell`);

  const script = scriptLines.join('\n');

  return new Promise((resolve) => {
    exec(`osascript -e '${script.replace(/'/g, "'\\''")}'`, { timeout: 15000 }, (error, stdout) => {
      if (error) { resolve(false); return; }
      resolve(!stdout.trim().startsWith('error:'));
    });
  });
}

export async function writeToAppleMusic(song: ISong): Promise<{ success: boolean; message: string }> {
  const targetIds = [...new Set((song.appleMusicIds || []).filter(Boolean))];
  if (targetIds.length === 0) {
    return { success: false, message: 'No Apple Music IDs' };
  }

  const escaped = {
    title: escapeAppleScript(song.title),
    artist: escapeAppleScript(song.artist),
    album: escapeAppleScript(song.album || ''),
    genre: escapeAppleScript((song.genres || []).join(', ')),
    grouping: escapeAppleScript((song.grouping || []).join(', ')),
    bpm: String(song.bpm ?? ''),
    rating: song.rating !== undefined ? String(Math.round(song.rating * 20)) : '',
    year: String(song.year ?? ''),
  };
  const songKey = song.key?.trim() ? escapeAppleScript(song.key.trim()) : '';
  const isAIFF = song.sources?.some(s => s.format === 'aiff') ?? false;

  // Build comment AppleScript block:
  // 1. Strip existing musicalKey=... (take everything before first " musicalKey=",
  //    or before "musicalKey=" at start)
  // 2. If AIFF track and "AIFF" isn't first token, prepend "AIFF "
  // 3. If key is non-empty, append " musicalKey=KEY"
  let commentBlock = `
    set currentComment to comment of t
    set AppleScript's text item delimiters to " musicalKey="
    set commentParts to text items of currentComment
    set AppleScript's text item delimiters to ""
    if (number of items in commentParts) > 1 then
      set cleanComment to item 1 of commentParts
    else if currentComment starts with "musicalKey=" then
      set cleanComment to ""
    else
      set cleanComment to currentComment
    end if
    set newComment to cleanComment`;
  if (isAIFF) {
    commentBlock += `
    if newComment does not start with "AIFF" then
      if newComment is "" then
        set newComment to "AIFF"
      else
        set newComment to "AIFF " & newComment
      end if
    end if`;
  }
  if (songKey) {
    commentBlock += `
    if newComment is "" then
      set newComment to "musicalKey=${songKey}"
    else
      set newComment to newComment & " musicalKey=${songKey}"
    end if`;
  }
  commentBlock += `
    set comment of t to newComment`;

  let successCount = 0;
  const errors: string[] = [];

  for (const pid of targetIds) {
    const ok = await writeToSingle(escapeAppleScript(pid), escaped, commentBlock);
    if (ok) {
      successCount++;
    } else {
      errors.push(pid);
    }
  }

  const allOk = successCount === targetIds.length;
  return {
    success: allOk,
    message: allOk
      ? `Written to ${targetIds.length} track${targetIds.length > 1 ? 's' : ''}`
      : `Written to ${successCount}/${targetIds.length} tracks. Failed: ${errors.join(', ')}`,
  };
}
