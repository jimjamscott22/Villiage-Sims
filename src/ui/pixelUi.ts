import type { CSSProperties } from 'react';
import type { AtlasCell } from '../render/atlas';
import { getAtlasManifest, getSheetSize } from './atlasManifest';

export const UI_SHEET_URL = '/art/ui.png';
export const PANEL_SLICE = 6;

export function uiCell(key: string): AtlasCell | undefined {
  const cell = getAtlasManifest().cells[key];
  if (!cell || cell.sheet !== 'ui') return undefined;
  return cell;
}

/** CSS background-position to show one atlas cell at native scale. */
export function cellBgPosition(cell: AtlasCell, scale = 2): string {
  return `${-cell.x * scale}px ${-cell.y * scale}px`;
}

/**
 * CSS background-size matching a sheet scaled up by `scale`. `cellBgPosition`
 * offsets assume the whole sheet renders at this size — without it the
 * browser shows the sheet at its native (1x) pixel size and every position
 * offset lands on the wrong cell, or off the edge entirely.
 */
export function sheetBgSize(sheet: string, scale = 2): string | undefined {
  const size = getSheetSize(sheet);
  if (!size) return undefined;
  return `${size.width * scale}px ${size.height * scale}px`;
}

/** Inline style for a fixed-size icon from the ui sheet. */
export function uiIconStyle(key: string, scale = 2): CSSProperties | undefined {
  const cell = uiCell(key);
  if (!cell) return undefined;
  return {
    width: cell.w * scale,
    height: cell.h * scale,
    backgroundImage: `url(${UI_SHEET_URL})`,
    backgroundPosition: cellBgPosition(cell, scale),
    backgroundSize: sheetBgSize('ui', scale),
    backgroundRepeat: 'no-repeat',
    imageRendering: 'pixelated',
  };
}

export function fontStripOrigin(): { x: number; y: number } {
  const cell = uiCell('font.strip');
  return cell ? { x: cell.x, y: cell.y } : { x: 0, y: 18 };
}

export function barNotchVars(): Record<string, string> {
  const fill = uiCell('ui.bar.notch');
  const empty = uiCell('ui.bar.notch.empty');
  const size = sheetBgSize('ui', 2);
  if (!fill || !empty || !size) return {};
  return {
    '--bar-fill': cellBgPosition(fill, 2),
    '--bar-empty': cellBgPosition(empty, 2),
    '--bar-size': size,
  };
}
