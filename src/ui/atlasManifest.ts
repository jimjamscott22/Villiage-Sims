import type { AtlasManifest } from '../render/atlas';

let manifest: AtlasManifest = { sheets: {}, cells: {} };
const sheetSizes: Record<string, { width: number; height: number }> = {};

/** Current atlas manifest. Empty until `loadUiAtlasManifest` resolves. */
export function getAtlasManifest(): AtlasManifest {
  return manifest;
}

/**
 * Natural pixel size of a loaded sheet image (e.g. `ui`, `entities`).
 * Undefined until `loadUiAtlasManifest` resolves — CSS `background-position`
 * for these sheets is authored assuming the image renders at its native
 * resolution scaled up by a fixed factor, so callers need this to set a
 * matching `background-size`; without it the browser falls back to the
 * sheet's raw pixel size and every position offset lands on the wrong cell.
 */
export function getSheetSize(sheet: string): { width: number; height: number } | undefined {
  return sheetSizes[sheet];
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load ${src}`));
    image.src = src;
  });
}

async function preloadSheetSizes(base: string): Promise<void> {
  const entries = Object.entries(manifest.sheets);
  await Promise.all(
    entries.map(async ([name, file]) => {
      try {
        const image = await loadImage(`${base}${file}`);
        sheetSizes[name] = { width: image.naturalWidth, height: image.naturalHeight };
      } catch {
        // Leave this sheet's size unset; its icons/text just won't render.
      }
    }),
  );
}

/** Fetch and cache the atlas manifest served from public/art/, and preload sheet sizes. */
export async function loadUiAtlasManifest(base = '/art/'): Promise<void> {
  try {
    const response = await fetch(`${base}atlas.json`);
    if (response.ok) {
      manifest = (await response.json()) as AtlasManifest;
      await preloadSheetSizes(base);
    }
  } catch {
    // Leave the empty manifest; icons/thumbnails just won't render.
  }
}
