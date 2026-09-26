/**
 * Headless smoke with video: force move, focus camera, record a short clip.
 */
import { chromium } from 'playwright-core';
import { createRequire } from 'node:module';
import fs from 'node:fs';

const require = createRequire(import.meta.url);
const chromePath =
  process.env.CHROME_PATH
  || require('playwright-core').chromium.executablePath();

const url = 'http://127.0.0.1:5173/?test=1';
const videoDir = '/tmp/intent-video';
fs.rmSync(videoDir, { recursive: true, force: true });
fs.mkdirSync(videoDir, { recursive: true });

const browser = await chromium.launch({
  executablePath: chromePath,
  headless: true,
  args: ['--no-sandbox'],
});
const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  recordVideo: { dir: videoDir, size: { width: 1280, height: 800 } },
});
const page = await context.newPage();
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForFunction(() => typeof window.render_game_to_text === 'function', null, {
  timeout: 15000,
});

const result = await page.evaluate(async () => {
  const transport = window.__villageTransport;
  const world = transport.world;
  const tileSize = world.terrain.tileSize;
  const id = world.snapshot().villagers[0]?.id ?? 1;
  const start = world.snapshot().villagers.find((v) => v.id === id);
  const sx = Math.floor(start.x / tileSize);
  const sy = Math.floor(start.y / tileSize);

  let dest = null;
  for (let r = 6; r <= 24 && !dest; r += 1) {
    for (const [dx, dy] of [[r, 0], [-r, 0], [0, r], [0, -r], [r, r]]) {
      const x = sx + dx;
      const y = sy + dy;
      try {
        await transport.moveVillagerTo(x, y, id);
        const view = world.snapshot().villagers.find((v) => v.id === id);
        if (view?.state === 1 && view.destination) {
          dest = { x, y, view };
          break;
        }
      } catch {
        // inaccessible
      }
    }
  }

  for (let i = 0; i < 8; i += 1) {
    await window.advanceTime(100);
    const mid = world.snapshot().villagers.find((v) => v.id === id);
    if (mid?.destination && window.__focusWorld) {
      const [tx, ty] = mid.destination;
      window.__focusWorld((mid.x + (tx + 0.5) * tileSize) / 2, (mid.y + (ty + 0.5) * tileSize) / 2);
    }
  }
  await window.advanceTime(0);
  return JSON.parse(window.render_game_to_text()).intent;
});

await page.screenshot({ path: '/opt/cursor/artifacts/intent-overlay-demo.png' });
await page.waitForTimeout(1500);
await context.close();
await browser.close();

const videos = fs.readdirSync(videoDir).filter((f) => f.endsWith('.webm'));
if (!videos.length || !result?.showLine) {
  console.error('FAIL', result, videos);
  process.exit(1);
}
const src = `${videoDir}/${videos[0]}`;
const dest = '/opt/cursor/artifacts/intent-overlay-demo.webm';
fs.copyFileSync(src, dest);
console.log(JSON.stringify({ intent: result, video: dest }, null, 2));
