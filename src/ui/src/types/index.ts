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
  genres: string[];
  bpm?: number;
  rating?: number;
  key?: string;
  sources: ISource[];
}

export interface TagInfo {
  count: number;
}
