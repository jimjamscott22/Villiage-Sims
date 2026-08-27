import type { CSSProperties } from 'react';
import type { AtlasCell } from '../render/atlas';
import { getAtlasManifest } from './atlasManifest';

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

/** Inline style for a fixed-size icon from the ui sheet. */
export function uiIconStyle(key: string, scale = 2): CSSProperties | undefined {
  const cell = uiCell(key);
  if (!cell) return undefined;
  return {
    width: cell.w * scale,
    height: cell.h * scale,
    backgroundImage: `url(${UI_SHEET_URL})`,
    backgroundPosition: cellBgPosition(cell, scale),
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
  if (!fill || !empty) return {};
  return {
    '--bar-fill': cellBgPosition(fill, 2),
    '--bar-empty': cellBgPosition(empty, 2),
  };
}
