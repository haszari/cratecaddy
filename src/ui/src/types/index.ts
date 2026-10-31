export type SourceFormat = 'aiff' | 'wav' | 'alac' | 'aac' | 'mp3' | 'applemusicstream';

export interface ISource {
  sourceType: 'applemusic' | 'rekordbox' | 'djaypro' | 'local' | 'manual';
  format?: SourceFormat;
  filePath?: string;
  /** Derived at Snapshot time: a local file, as opposed to a streaming source. */
  isLocal?: boolean;
  fileSize?: number;
  bitRate?: number;
  fileType?: string;
  sourceMetadata?: {
    isAppleMusic?: boolean;
    fileType?: string;
    [key: string]: unknown;
  };
  lastImportDate?: Date;
}

export interface Song {
  _id?: string;
  title: string;
  artist: string;
  album: string;
  genres: string[];
  bpm?: number;
  rating?: number;
  keyCamelot?: number;
  year?: number;
  grouping?: string[];
  canonicalAppleMusicId?: string;
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
