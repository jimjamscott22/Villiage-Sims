import type { TerrainSnapshot } from '../state/types';

const COLORS = ['#7aa35a', '#66904f'];

export function drawTerrain(ctx: CanvasRenderingContext2D, terrain: TerrainSnapshot): void {
  for (let index = 0; index < terrain.tiles.length; index += 1) {
    const x = index % terrain.width;
    const y = Math.floor(index / terrain.width);
    ctx.fillStyle = COLORS[terrain.tiles[index]] ?? '#ff00ff';
    ctx.fillRect(x * terrain.tileSize, y * terrain.tileSize, terrain.tileSize, terrain.tileSize);
  }
}
