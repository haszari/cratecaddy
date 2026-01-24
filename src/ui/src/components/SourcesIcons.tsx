import { Cloud, Gem } from 'lucide-react';

interface ISource {
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

interface SourcesIconsProps {
  sources: ISource[];
}

export function SourcesIcons({ sources }: SourcesIconsProps) {
  // Show cloud icon if ALL sources are Apple Music streaming (no local files)
  const isAllCloud = sources.length > 0 && sources.every(s => 
    s.sourceMetadata?.isAppleMusic === true && !s.filePath
  );

  // Show gem icon if ANY source has lossless format (lowercase matching, support AIF/AIFF)
  const hasLossless = sources.some(s => {
    if (!s.fileType) return false;
    const fileType = s.fileType.toLowerCase();
    return fileType.includes('aiff') || fileType.includes('aif') || 
           fileType.includes('wav') || fileType.includes('flac') || 
           fileType.includes('alac');
  });

  // Get specific lossless format for tooltip
  const getLosslessFormat = () => {
    const losslessSource = sources.find(s => {
      if (!s.fileType) return false;
      const fileType = s.fileType.toLowerCase();
      return fileType.includes('aiff') || fileType.includes('aif') || 
             fileType.includes('wav') || fileType.includes('flac') || 
             fileType.includes('alac');
    });
    
    if (!losslessSource?.fileType) return '';
    
    const fileType = losslessSource.fileType.toLowerCase();
    if (fileType.includes('aiff') || fileType.includes('aif')) return 'AIFF';
    if (fileType.includes('wav')) return 'WAV';
    if (fileType.includes('flac')) return 'FLAC';
    if (fileType.includes('alac')) return 'ALAC';
    return '';
  };

  return (
    <div className="sources-icons">
      {isAllCloud && (
        <div 
          className="icon-wrapper"
          title="Cloud only - Apple Music"
        >
          <Cloud 
            size={16} 
            className="cloud-icon" 
            aria-label="Cloud only - Apple Music"
          />
        </div>
      )}
      {hasLossless && (
        <div 
          className="icon-wrapper"
          title={`Lossless available - ${getLosslessFormat()}`}
        >
          <Gem 
            size={16} 
            className="lossless-icon" 
            aria-label={`Lossless available - ${getLosslessFormat()}`}
          />
        </div>
      )}
    </div>
  );
}
