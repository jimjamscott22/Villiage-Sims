import { THEME } from '../theme/palette';
import type { Atlas } from './atlas';
import type { Ambience } from './ambience';

/** Apply the same two palette-colour layers to terrain and sprite pixels. */
export function paintAmbience(ctx: CanvasRenderingContext2D, ambience: Ambience, width: number, height: number): void {
  ctx.save();
  for (const [color, alpha] of [[ambience.color, ambience.alpha], [THEME.terraLight, ambience.warmAlpha]] as const) {
    if (alpha <= 0) continue;
    ctx.fillStyle = color;
    ctx.globalAlpha = alpha;
    ctx.fillRect(0, 0, width, height);
  }
  ctx.restore();
}

/** One cached tint, rebuilt only when the clock changes, never one allocation per sprite. */
export class AmbienceAtlas {
  private source: Atlas | null = null;
  private key = '';
  private tinted: Atlas | null = null;

  for(atlas: Atlas, ambience: Ambience): Atlas {
    if (ambience.alpha === 0 && ambience.warmAlpha === 0) return atlas;
    const key = `${ambience.color}:${ambience.alpha}:${ambience.warmAlpha}`;
    if (atlas === this.source && key === this.key && this.tinted) return this.tinted;
    const images: Atlas['images'] = {};
    for (const [name, image] of Object.entries(atlas.images)) {
      if (name === 'ui' || name === 'tiles') { images[name] = image; continue; }
      const previous = this.tinted?.images[name];
      const canvas = previous instanceof HTMLCanvasElement ? previous : document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return atlas;
      ctx.drawImage(image, 0, 0);
      ctx.globalCompositeOperation = 'source-atop';
      paintAmbience(ctx, ambience, canvas.width, canvas.height);
      ctx.globalCompositeOperation = 'source-over';
      images[name] = canvas;
    }
    this.source = atlas;
    this.key = key;
    this.tinted = { manifest: atlas.manifest, images };
    return this.tinted;
  }
}
