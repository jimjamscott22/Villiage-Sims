export interface AtlasCell {
  sheet: string;
  x: number;
  y: number;
  /** Width of a single frame. */
  w: number;
  h: number;
  /** Pixels of sprite above the footprint. Absent means zero. */
  anchorY?: number;
  /** Frame count; frames are laid out horizontally. Absent means one. */
  frames?: number;
}

export interface AtlasManifest {
  sheets: Record<string, string>;
  cells: Record<string, AtlasCell>;
}

export interface Atlas {
  manifest: AtlasManifest;
  images: Record<string, HTMLImageElement>;
}

/** Native art is 16px; the world uses 32px tiles, so art draws at 2x. */
export const ART_SCALE = 2;

export function frameCount(cell: AtlasCell): number {
  return cell.frames ?? 1;
}

/** Source rect for one frame. Frame indices wrap; negatives clamp to the first frame. */
export function cellRect(cell: AtlasCell, frame: number): [number, number, number, number] {
  const count = frameCount(cell);
  const index = frame < 0 ? 0 : frame % count;
  return [cell.x + index * cell.w, cell.y, cell.w, cell.h];
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load ${src}`));
    image.src = src;
  });
}

/**
 * Load the manifest and every sheet it declares.
 * Resolves `null` on any failure so the caller can fall back to flat-color drawing.
 */
export async function loadAtlas(base = '/art/'): Promise<Atlas | null> {
  try {
    const response = await fetch(`${base}atlas.json`);
    if (!response.ok) return null;
    const manifest = (await response.json()) as AtlasManifest;
    const names = Object.keys(manifest.sheets);
    const images = await Promise.all(names.map((name) => loadImage(`${base}${manifest.sheets[name]}`)));
    return {
      manifest,
      images: Object.fromEntries(names.map((name, index) => [name, images[index]])),
    };
  } catch {
    return null;
  }
}

/** Draw one atlas cell at world position (dx, dy). Unknown keys are skipped. */
export function drawCell(
  ctx: CanvasRenderingContext2D,
  atlas: Atlas,
  key: string,
  dx: number,
  dy: number,
  frame = 0,
  scale = ART_SCALE,
): void {
  const cell = atlas.manifest.cells[key];
  if (!cell) return;
  const image = atlas.images[cell.sheet];
  if (!image) return;
  const [sx, sy, sw, sh] = cellRect(cell, frame);
  ctx.drawImage(image, sx, sy, sw, sh, dx, dy, sw * scale, sh * scale);
}
