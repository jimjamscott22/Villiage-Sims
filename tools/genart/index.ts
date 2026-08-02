import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildAtlas } from './build';
import { ART_DIR } from './paths';
import { encodePng } from './png';

function main(): void {
  const atlas = buildAtlas();
  mkdirSync(ART_DIR, { recursive: true });

  for (const sheet of atlas.sheets) {
    const png = encodePng(sheet.width, sheet.height, sheet.rgba);
    writeFileSync(join(ART_DIR, `${sheet.name}.png`), png);
    console.log(`${sheet.name}.png  ${sheet.width}x${sheet.height}`);
  }

  writeFileSync(join(ART_DIR, 'atlas.json'), `${JSON.stringify(atlas.manifest, null, 2)}\n`);
  console.log(`atlas.json  ${Object.keys(atlas.manifest.cells).length} cells`);
}

main();
