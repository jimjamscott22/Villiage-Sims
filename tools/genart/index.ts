import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DESKTOP_PNGS, rasterForIconSize, renderAppIcon } from './app-icon';
import { buildAtlas } from './build';
import { rasterizeGrid } from './grid';
import { APP_ICON_PATH, ART_DIR, ICONS_DIR } from './paths';
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

  const icon = renderAppIcon();
  writeFileSync(APP_ICON_PATH, encodePng(icon.width, icon.height, icon.rgba));
  console.log(`app-icon.png  ${icon.width}x${icon.height}`);

  mkdirSync(ICONS_DIR, { recursive: true });
  for (const { file, size } of DESKTOP_PNGS) {
    const raster = rasterForIconSize(size);
    writeFileSync(join(ICONS_DIR, file), encodePng(raster.width, raster.height, raster.rgba));
    console.log(`${file}  ${raster.width}x${raster.height}`);
  }
}

main();
