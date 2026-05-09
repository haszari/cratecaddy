import GenreTagWithCount from './GenreTag';
import type { TagInfo } from '../types';

interface GenreTagCloudProps {
  tags: Record<string, TagInfo>;
  onInclude?: (genre: string) => void;
  onExclude?: (genre: string) => void;
}

export function GenreTagCloud({ tags, onInclude, onExclude }: GenreTagCloudProps) {
  const sortedTagKeys = Object.keys(tags).sort((a, b) => {
    return a.localeCompare(b);
  });

  return (
    <div className="TagCloud">
      {sortedTagKeys.map((tag) => (
        <GenreTagWithCount
          key={tag}
          tagText={tag}
          tagCount={tags[tag].count}
          onInclude={onInclude}
          onExclude={onExclude}
        />
      ))}
    </div>
  );
}
