import type { TerrainSnapshot } from '../state/types';
import { DEBUG_MISSING, THEME } from '../theme/palette';

/** Flat fallback colours (used when the atlas fails to load), indexed by Terrain enum byte. */
export const TERRAIN_FALLBACK_COLORS: readonly string[] = [
  THEME.seaDeep, // DeepWater
  THEME.seaShallow, // ShallowWater
  THEME.sandMid, // Sand
  THEME.vegMid, // Grass
  THEME.vegDark, // Forest
  THEME.stoneMid, // Rock
  THEME.stonePale, // Mountain
];

export function drawTerrain(ctx: CanvasRenderingContext2D, terrain: TerrainSnapshot): void {
  for (let index = 0; index < terrain.tiles.length; index += 1) {
    const x = index % terrain.width;
    const y = Math.floor(index / terrain.width);
    ctx.fillStyle = TERRAIN_FALLBACK_COLORS[terrain.tiles[index]] ?? DEBUG_MISSING;
    ctx.fillRect(x * terrain.tileSize, y * terrain.tileSize, terrain.tileSize, terrain.tileSize);
  }
}
