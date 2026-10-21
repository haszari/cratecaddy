import { Cloud, Gem } from 'lucide-react';
import type { ISource } from '../types';

interface SourcesIconsProps {
  sources: ISource[];
}

export function SourcesIcons({ sources }: SourcesIconsProps) {
  const isLocalFile = sources.length > 0 && sources.some(s => {
    // Snapshots carry a derived flag; API responses are detected from format/path.
    if (s.isLocal === true) return true;
    if (s.format && s.format !== 'applemusicstream') return true;
    if (s.filePath?.startsWith('file://')) return true;
    return false;
  });

  const cloudMode = !isLocalFile && sources.some(s => s.format === 'applemusicstream')
    ? sources.some(s => s.sourceMetadata?.fileType === 'Apple Music AAC audio file')
      ? 'streaming'
      : 'uploaded'
    : null;

  // Show gem icon if ANY source has lossless format
  const hasLossless = sources.some(s => {
    if (s.format === 'alac' || s.format === 'aiff' || s.format === 'wav') return true;
    const ft = s.sourceMetadata?.fileType || s.fileType || '';
    return ft.toLowerCase().includes('flac');
  });

  // Get specific lossless format for tooltip
  const getLosslessFormat = () => {
    const src = sources.find(s => {
      if (s.format === 'alac' || s.format === 'aiff' || s.format === 'wav') return true;
      const ft = s.sourceMetadata?.fileType || s.fileType || '';
      return ft.toLowerCase().includes('flac');
    });
    if (!src) return '';
    if (src.format === 'aiff') return 'AIFF';
    if (src.format === 'wav') return 'WAV';
    if (src.format === 'alac') return 'ALAC';
    const ft = (src.sourceMetadata?.fileType || src.fileType || '').toLowerCase();
    if (ft.includes('flac')) return 'FLAC';
    return '';
  };

  return (
    <div className="sources-icons">
      {cloudMode && (
        <div 
          className={`icon-wrapper${cloudMode === 'streaming' ? ' cloud--filled' : ' cloud--outline'}`}
          title={cloudMode === 'streaming' ? 'Streaming collection' : 'Own file, uploaded'}
        >
          <Cloud 
            size={16} 
            fill={cloudMode === 'streaming' ? 'currentColor' : 'none'}
            aria-label={cloudMode === 'streaming' ? 'Streaming collection' : 'Own file, uploaded'}
          />
        </div>
      )}
      {hasLossless && (
        <div 
          className="icon-wrapper"
          title={`Lossless format available - ${getLosslessFormat()}`}
        >
          <Gem 
            size={16} 
            aria-label={`Lossless format available - ${getLosslessFormat()}`}
          />
        </div>
      )}
    </div>
  );
}
