import './GenreTag.scss';
import { Link } from 'react-router-dom';
import { Plus, Minus } from 'lucide-react';

interface GenreTagWithCountProps {
  tagText: string;
  tagCount: number;
  isHeading?: boolean;
  onInclude?: (genre: string) => void;
  onExclude?: (genre: string) => void;
}

export default function GenreTagWithCount({
  tagText,
  tagCount,
  isHeading = false,
  onInclude,
  onExclude,
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

  const hasButtons = !!(onInclude || onExclude);

  return (
    <span className={`GenreTag-pill${hasButtons ? ' GenreTag-pill--with-buttons' : ''}`} style={style}>
      {onExclude && (
        <button
          className="GenreTag-pill-btn GenreTag-pill-btn-left"
          onClick={(e) => { e.stopPropagation(); onExclude(tagText); }}
          title="Exclude"
        >
          <Minus size={10} />
        </button>
      )}
      <Link
        to={`/genre/${encodeURIComponent(tagText)}`}
        className="GenreTag-pill-label"
      >
        {tagText}
        {tagCount > 1 && <span className="GenreTag-count">{tagCount}</span>}
      </Link>
      {onInclude && (
        <button
          className="GenreTag-pill-btn GenreTag-pill-btn-right"
          onClick={(e) => { e.stopPropagation(); onInclude(tagText); }}
          title="Add to include (AND)"
        >
          <Plus size={10} />
        </button>
      )}
    </span>
  );
}
