import { exec } from 'child_process';
import { ISong } from '../models/Song.js';

function escapeAppleScript(str: string): string {
  return str.replace(/"/g, '\\"').replace(/\n/g, ' ');
}

export async function exportToAppleMusic(song: ISong): Promise<{ success: boolean; message: string }> {
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

  let lovedScript = '';
  if (song.favorite === 'starred') lovedScript = 'set loved of t to true';
  else if (song.favorite === 'disliked') lovedScript = 'set disliked of t to true';
  else lovedScript = 'set loved of t to false; set disliked of t to false';

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
    ${lovedScript}
    set comment of t to (comment of t) & "musicalKey=${song.key || ''}"
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
      resolve({ success: true, message: 'Exported to Apple Music' });
    });
  });
}
