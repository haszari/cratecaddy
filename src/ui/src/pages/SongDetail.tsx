import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import './SongDetail.scss';

interface Song {
  _id: string;
  title: string;
  artist: string;
  genres: string[];
  tokens?: {
    artist: string;
    title: string;
    variations?: {
      type: string;
      variation: string;
    }[];
    variationType?: string;
    duration?: number;
  };
}

const SongDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [song, setSong] = useState<Song | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSong = async () => {
      try {
        const API_URL = import.meta.env.VITE_API_URL;
        const response = await fetch(`${API_URL}/api/songs/${id}`);
        if (!response.ok) {
          throw new Error(`Failed to fetch song: ${response.status} ${response.statusText}`);
        }

        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          throw new Error('Invalid response format: Expected JSON');
        }

        const data = await response.json();
        setSong(data);
      } catch (err) {
        console.error('Error fetching song:', err);
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };

    fetchSong();
  }, [id]);

  const computeTokens = async () => {
    try {
      const API_URL = import.meta.env.VITE_API_URL;
      const response = await fetch(`${API_URL}/api/songs/${id}/compute-tokens`, {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error('Failed to compute tokens');
      }
      const updatedSong = await response.json();
      setSong(updatedSong);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!song) return <div>Song not found</div>;

  return (
    <div className="song-detail">
      <h1>{song.title}</h1>
      <p><strong>Artist:</strong> {song.artist}</p>
      <p><strong>Genres:</strong> {song.genres.join(', ')}</p>
      {song.tokens && (
        <div>
          <h2>Tokens</h2>
          <p><strong>Artist:</strong> {song.tokens.artist}</p>
          <p><strong>Title:</strong> {song.tokens.title}</p>
          {song.tokens.variations && song.tokens.variations.length > 0 && (
            <div>
              <h3>Variations</h3>
              <ul>
                {song.tokens.variations.map((v, index) => (
                  <li key={index}><strong>Type:</strong> {v.type}, <strong>Variation:</strong> {v.variation}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
      <button onClick={computeTokens}>Compute Tokens</button>
    </div>
  );
};

export default SongDetail;