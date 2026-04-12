import GenreTagWithCount from './GenreTag';
import type { TagInfo } from '../types';

interface GenreTagCloudProps {
  tags: Record<string, TagInfo>;
}

export function GenreTagCloud({ tags }: GenreTagCloudProps) {
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
        />
      ))}
    </div>
  );
}
