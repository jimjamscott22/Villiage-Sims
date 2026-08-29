import type { AtlasCell } from '../render/atlas';
import { getAtlasManifest } from './atlasManifest';
import { sheetBgSize } from './pixelUi';

const ENTITIES_URL = '/art/entities.png';

interface AtlasThumbProps {
  cellKey: string;
  scale?: number;
  className?: string;
  desaturate?: boolean;
}

/** Render one entity atlas cell as a CSS background thumbnail. */
export function AtlasThumb({ cellKey, scale = 2, className = '', desaturate = false }: AtlasThumbProps) {
  const cell: AtlasCell | undefined = getAtlasManifest().cells[cellKey];
  if (!cell) return <span className={`inline-block ${className}`} aria-hidden />;

  const w = cell.w * scale;
  const h = (cell.h - (cell.anchorY ?? 0)) * scale;

  return (
    <span
      aria-hidden
      className={`inline-block shrink-0 bg-no-repeat ${className} ${desaturate ? 'opacity-50 grayscale' : ''}`}
      style={{
        width: w,
        height: h,
        backgroundImage: `url(${ENTITIES_URL})`,
        backgroundPosition: `${-cell.x * scale}px ${-(cell.y + (cell.anchorY ?? 0)) * scale}px`,
        backgroundSize: sheetBgSize('entities', scale),
        imageRendering: 'pixelated',
      }}
    />
  );
}
