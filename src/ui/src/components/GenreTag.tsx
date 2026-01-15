import './GenreTag.scss';
import { Link } from 'react-router-dom';

interface GenreTagWithCountProps {
  tagText: string;
  tagCount: number;
  isHeading?: boolean;
}

export default function GenreTagWithCount({
  tagText,
  tagCount,
  isHeading = false,
}: GenreTagWithCountProps) {
  const popularity = tagCount > 0 ? Math.log(tagCount) : 0;
  const style = {
    fontSize: isHeading ? '2.5em' : 0.5 * (popularity + 1) + 'em',
  };

  if (isHeading) {
    return (
      <h2 className="GenreTag GenreTag-heading" style={style}>
        {tagText}
      </h2>
    );
  }

  return (
    <Link
      to={`/genre/${encodeURIComponent(tagText)}`}
      className="GenreTag-link"
    >
      <div className="GenreTag" style={style}>
        {tagText}
        <span className="GenreTag-count">{tagCount > 1 ? tagCount : ''}</span>
      </div>
    </Link>
  );
}
