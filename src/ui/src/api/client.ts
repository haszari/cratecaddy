import type { Song } from '../types';

const API_URL = import.meta.env.VITE_API_URL;

export async function fetchSongs(): Promise<Song[]> {
  const response = await fetch(`${API_URL}/api/songs`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch songs: ${response.statusText}`);
  }
  
  return response.json();
}
