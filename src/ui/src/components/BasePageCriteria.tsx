import { Fragment } from 'react';

interface BasePageCriteriaProps {
  artists?: string[];
  genres?: { name: string; mode: 'and' | 'or' }[];
  onRemoveGenre?: (genre: string) => void;
}

export default function BasePageCriteria({
  artists,
  genres,
  onRemoveGenre,
}: BasePageCriteriaProps) {
  const hasArtists = artists && artists.length > 0;
  const hasGenres = genres && genres.length > 0;

  if (!hasArtists && !hasGenres) return null;

  return (
    <div className="PageCriteria">
      {hasArtists && artists.map((a) => (
        <h2 key={a} className="GenreTag GenreTag-heading" style={{ fontSize: '2.5em' }}>
          {a}
        </h2>
      ))}
      {hasGenres && genres.map((g, i) => (
        <Fragment key={g.name}>
          {i > 0 && g.mode === 'or' && <span className="or-separator">or</span>}
          <span
            className={`genre-pill${g.mode === 'or' ? ' genre-pill--or' : ' genre-pill--and'}`}
            onClick={() => onRemoveGenre?.(g.name)}
            title={`Remove ${g.name}`}
          >
            {g.name}
          </span>
        </Fragment>
      ))}
    </div>
  );
}
