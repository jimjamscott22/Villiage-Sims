import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildAtlas } from './build';
import { rasterizeGrid } from './grid';
import { ART_DIR } from './paths';
import { encodePng } from './png';
import { PANEL } from './sprites/ui';

function main(): void {
  const atlas = buildAtlas();
  mkdirSync(ART_DIR, { recursive: true });

  for (const sheet of atlas.sheets) {
    const png = encodePng(sheet.width, sheet.height, sheet.rgba);
    writeFileSync(join(ART_DIR, `${sheet.name}.png`), png);
    console.log(`${sheet.name}.png  ${sheet.width}x${sheet.height}`);
  }

  // CSS border-image cannot crop an atlas cell, so emit the 9-slice frame alone.
  const panel = rasterizeGrid(PANEL);
  writeFileSync(join(ART_DIR, 'panel.png'), encodePng(panel.width, panel.height, panel.rgba));
  console.log(`panel.png  ${panel.width}x${panel.height}`);

  writeFileSync(join(ART_DIR, 'atlas.json'), `${JSON.stringify(atlas.manifest, null, 2)}\n`);
  console.log(`atlas.json  ${Object.keys(atlas.manifest.cells).length} cells`);
}

main();
