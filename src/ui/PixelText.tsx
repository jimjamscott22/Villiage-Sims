import {
  FONT_SCALE,
  GLYPH_HEIGHT,
  GLYPH_WIDTH,
  glyphBackgroundPosition,
  normalizePixelText,
} from './font';
import { fontStripOrigin, sheetBgSize, UI_SHEET_URL } from './pixelUi';

interface PixelTextProps {
  text: string;
  className?: string;
}

export function PixelText({ text, className = '' }: PixelTextProps) {
  const normalized = normalizePixelText(text);
  const origin = fontStripOrigin();
  const backgroundSize = sheetBgSize('ui', FONT_SCALE);

  return (
    <span
      className={`inline-flex items-baseline ${className}`}
      aria-label={text}
      data-testid="pixel-text"
    >
      {normalized.split('').map((char, index) => {
        const pos = glyphBackgroundPosition(char);
        const bgX = -(origin.x * FONT_SCALE) + pos.x;
        const bgY = -(origin.y * FONT_SCALE) + pos.y;
        return (
          <span
            key={`${char}-${index}`}
            aria-hidden
            className="inline-block shrink-0 bg-no-repeat"
            style={{
              width: GLYPH_WIDTH * FONT_SCALE,
              height: GLYPH_HEIGHT * FONT_SCALE,
              backgroundImage: `url(${UI_SHEET_URL})`,
              backgroundPosition: `${bgX}px ${bgY}px`,
              backgroundSize,
              imageRendering: 'pixelated',
            }}
          />
        );
      })}
    </span>
  );
}
