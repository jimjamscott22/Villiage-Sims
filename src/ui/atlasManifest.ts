import type { AtlasManifest } from '../render/atlas';

let manifest: AtlasManifest = { sheets: {}, cells: {} };

/** Current atlas manifest. Empty until `loadUiAtlasManifest` resolves. */
export function getAtlasManifest(): AtlasManifest {
  return manifest;
}

/** Fetch and cache the atlas manifest served from public/art/. */
export async function loadUiAtlasManifest(base = '/art/'): Promise<void> {
  try {
    const response = await fetch(`${base}atlas.json`);
    if (response.ok) manifest = (await response.json()) as AtlasManifest;
  } catch {
    // Leave the empty manifest; icons/thumbnails just won't render.
  }
}
