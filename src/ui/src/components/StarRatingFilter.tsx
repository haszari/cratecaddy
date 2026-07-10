import { useCallback } from 'react';
import './StarRatingFilter.scss';

interface StarRatingFilterProps {
  ratingGte?: number;
  ratingLte?: number;
  onChange?: (gte?: number, lte?: number) => void;
  readOnly?: boolean;
}

const STAR_SIZES = [14, 15.5, 17, 18.5, 20];

export default function StarRatingFilter({ ratingGte, ratingLte, onChange, readOnly }: StarRatingFilterProps) {
  const hasFilter = ratingGte !== undefined || ratingLte !== undefined;

  const handleClick = useCallback(
    (n: number) => {
      if (!onChange || readOnly) return;
      if (!hasFilter) {
        onChange(n, n);
      } else if (ratingGte === ratingLte && ratingGte === n) {
        onChange(undefined, undefined);
      } else if (ratingGte !== undefined && n === ratingGte) {
        onChange(ratingGte + 1, ratingLte);
      } else if (ratingLte !== undefined && n === ratingLte) {
        onChange(ratingGte, ratingLte - 1);
      } else if (ratingGte !== undefined && ratingLte !== undefined && n > ratingGte && n < ratingLte) {
        onChange(n + 1, ratingLte);
      } else if (ratingGte !== undefined && n < ratingGte) {
        onChange(n, ratingLte);
      } else if (ratingLte !== undefined && n > ratingLte) {
        onChange(ratingGte, n);
      }
    },
    [onChange, readOnly, hasFilter, ratingGte, ratingLte],
  );

  const isOn = (n: number) => {
    if (!hasFilter) return false;
    const gte = ratingGte ?? 1;
    const lte = ratingLte ?? 5;
    return n >= gte && n <= lte;
  };

  if (readOnly) {
    if (!hasFilter) return null;
    return (
      <span className="StarRatingFilter">
        {[1, 2, 3, 4, 5].map((n, i) => (
          <span
            key={n}
            className={`StarRatingFilter-star StarRatingFilter-star--${isOn(n) ? 'on' : 'off'}`}
            style={{ fontSize: STAR_SIZES[i] }}
          >
            {isOn(n) ? '\u2605' : '\u2606'}
          </span>
        ))}
      </span>
    );
  }

  if (!hasFilter) {
    return (
      <span
        className="StarRatingFilter StarRatingFilter-inactive"
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && onChange?.(3, 3)}
      >
        {[1, 2, 3, 4, 5].map((n, i) => (
          <span
            key={n}
            className="StarRatingFilter-star StarRatingFilter-star--off"
            style={{ fontSize: STAR_SIZES[i] }}
            onClick={() => onChange?.(n, n)}
          >
            {'\u2606'}
          </span>
        ))}
      </span>
    );
  }

  return (
    <span className="StarRatingFilter">
      {[1, 2, 3, 4, 5].map((n, i) => (
        <span
          key={n}
          className={`StarRatingFilter-star StarRatingFilter-star--${isOn(n) ? 'on' : 'off'}`}
          style={{ fontSize: STAR_SIZES[i] }}
          onClick={() => handleClick(n)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && handleClick(n)}
          title={isOn(n) ? `Exclude ${n}-star` : `Include ${n}-star`}
        >
          {isOn(n) ? '\u2605' : '\u2606'}
        </span>
      ))}
    </span>
  );
}
