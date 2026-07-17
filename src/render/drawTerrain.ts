import type { TerrainSnapshot } from '../state/types';

/** Colors indexed by Terrain enum byte values. */
const COLORS = [
  '#1b3a5a', // DeepWater
  '#3d7ea6', // ShallowWater
  '#c2b280', // Sand
  '#5f8f45', // Grass
  '#2f6b38', // Forest
  '#7a7a7a', // Rock
  '#d8d8d8', // Mountain
];

export function drawTerrain(ctx: CanvasRenderingContext2D, terrain: TerrainSnapshot): void {
  for (let index = 0; index < terrain.tiles.length; index += 1) {
    const x = index % terrain.width;
    const y = Math.floor(index / terrain.width);
    ctx.fillStyle = COLORS[terrain.tiles[index]] ?? '#ff00ff';
    ctx.fillRect(x * terrain.tileSize, y * terrain.tileSize, terrain.tileSize, terrain.tileSize);
  }
}
