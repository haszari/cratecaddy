export interface ISource {
  sourceType: 'applemusic' | 'rekordbox' | 'djaypro' | 'local';
  filePath?: string;
  fileSize?: number;
  bitRate?: number;
  fileType?: string;
  sourceMetadata?: {
    isAppleMusic?: boolean;
    [key: string]: unknown;
  };
  lastImportDate: Date;
}

export interface Song {
  _id?: string;
  title: string;
  artist: string;
  album: string;
  genres: string[];
  bpm?: number;
  rating?: number;
  key?: string;
  year?: number;
  grouping?: string[];
  appleMusicId?: string;
  favorite?: 'starred' | 'normal' | 'disliked';
  sources: ISource[];
}

export interface TagInfo {
  count: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  shuffleSeed?: string;
}
