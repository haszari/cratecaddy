import { exec } from 'child_process';
import { ISong } from '../models/Song.js';

function escapeAppleScript(str: string): string {
  return str.replace(/"/g, '\\"').replace(/\n/g, ' ');
}

export async function writeToAppleMusic(song: ISong): Promise<{ success: boolean; message: string }> {
  if (!song.appleMusicId) {
    return { success: false, message: 'No appleMusicId — cannot identify track in Apple Music' };
  }

  const title = escapeAppleScript(song.title);
  const artist = escapeAppleScript(song.artist);
  const album = escapeAppleScript(song.album || '');
  const genre = escapeAppleScript((song.genres || []).join(', '));
  const grouping = escapeAppleScript((song.grouping || []).join(', '));
  const bpm = song.bpm ?? '';
  const rating = song.rating !== undefined ? Math.round(song.rating * 20) : '';
  const year = song.year ?? '';
  const appleMusicId = escapeAppleScript(song.appleMusicId);
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

  const script = `tell application "Music"
  try
    set t to (first track of library playlist 1 whose persistent ID is "${appleMusicId}")
    set name of t to "${title}"
    set artist of t to "${artist}"
    if "${album}" is not "" then set album of t to "${album}"
    if "${genre}" is not "" then set genre of t to "${genre}"
    if "${grouping}" is not "" then set grouping of t to "${grouping}"
    if "${bpm}" is not "" then set bpm of t to ${bpm}
    if "${rating}" is not "" then set rating of t to ${rating}
    if "${year}" is not "" then set year of t to ${year}
    ${commentBlock}
    return "ok"
  on error errMsg
    return "error: " & errMsg
  end try
end tell`;

  return new Promise((resolve) => {
    exec(`osascript -e '${script.replace(/'/g, "'\\''")}'`, { timeout: 15000 }, (error, stdout, stderr) => {
      if (error) {
        resolve({ success: false, message: `AppleScript error: ${error.message}` });
        return;
      }
      const output = stdout.trim();
      if (output.startsWith('error:')) {
        resolve({ success: false, message: output });
        return;
      }
      resolve({ success: true, message: 'Saved to Apple Music' });
    });
  });
}
