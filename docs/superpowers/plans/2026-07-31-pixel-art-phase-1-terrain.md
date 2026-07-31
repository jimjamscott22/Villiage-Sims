# Pixel Art Phase 1 — Pipeline & Terrain Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the art generator and replace VillageSim's flat-color terrain with a procedurally generated pixel tilemap — dithered tile variants, irregular edge fringes, and an animated shoreline — while entities keep drawing as flat shapes.

**Architecture:** A Node script under `tools/genart/` rasterizes terrain art into an RGBA buffer, packs it into one sheet, and writes `public/art/tiles.png` + `atlas.json`, all committed. At runtime `src/render/atlas.ts` loads the sheet and `src/render/tilemap.ts` bakes the terrain into the existing offscreen canvas. The shoreline foam animates, so it is drawn per-frame on the entity layer rather than baked. If the atlas fails to load, the existing `drawTerrain` flat-color path runs instead and the game stays playable.

**Tech Stack:** TypeScript, Node built-in `zlib` (PNG encoding — no image library), Vite 8, Vitest 4, Canvas 2D.

**Spec:** `docs/superpowers/specs/2026-07-31-pixel-art-ui-redesign-design.md`

## Global Constraints

- **No new runtime dependencies.** The only dependency added anywhere is the devDependency `tsx`, needed because `engines` allows Node `^20.19.0`, which predates `--experimental-strip-types`.
- **Tests run in a plain Node environment.** No jsdom or happy-dom is installed. No test may reference `document`, `window`, `Image`, `HTMLCanvasElement` or `CanvasRenderingContext2D`. Pure logic must be separated from canvas calls so it can be tested.
- **`verbatimModuleSyntax: true`** — type-only imports must be written `import type { X } from '...'`.
- **`noUnusedLocals` and `noUnusedParameters` are on.** Unused variables fail `npm run build`.
- **Do not change `build.target` in `vite.config.ts`.** It is deliberately `es2020`; see `AGENTS.md`.
- **Only the 29 palette colors may appear in art.** `tools/genart/palette.ts` is the single source of truth and the rasterizer throws on anything else.
- **Determinism.** Tile variant selection and all art jitter derive from a fixed integer hash of `(x, y, salt)`. The same world always bakes identically.
- **World constants:** tile size is 32 world px; native art is 16×16, so art scales exactly 2×. The default world is 128×128 tiles.
- **Terrain enum order is fixed** by the Rust side: `0 DeepWater, 1 ShallowWater, 2 Sand, 3 Grass, 4 Forest, 5 Rock, 6 Mountain`.
- **Commit after every task.** Verification commands: `npm test`, `npm run build`.

## Deviations from the spec

Four, each deliberate.

**1. The drift test compares decoded pixels, not raw bytes.** The spec says `art.test.ts` byte-compares committed PNGs. That is not safe: `zlib.deflateSync` output varies with the zlib version bundled in Node, so a byte comparison would fail spuriously across Node versions. Comparing decoded RGBA is what the check actually cares about. `decodePng` exists for this.

**2. Phase 1 art is procedural, not hand-authored pixel grids.** The spec describes sprites as declarative `{ size, palette, rows }` data. That is right for objects with intent — buildings, villagers, icons — and it arrives in Phase 2. Phase 1's 88 cells are dithered material fields and jittered edge shapes, which are better expressed as material recipes and shape functions: they are unit-testable, they cannot drift out of palette, and 88 near-identical literal grids would be unreviewable. `tools/genart/sprites/terrain.ts` is therefore code, while `sprites/buildings.ts` and friends will be data.

**3. Dirty-tile re-baking is out of scope.** The spec says a dirty tile re-bakes itself and its 8 neighbours. Nothing in the codebase produces dirty tiles today — `TickSnapshot` in `src/state/types.ts` has no `dirtyTiles` field and `Canvas.tsx` never patches terrain after load. Building the re-bake path now would mean writing an unreachable code path with no way to test it. When terrain mutation lands, `planTile` and `shorelineTiles` are already the right pure functions to call per tile.

**4. The atlas cell shape is defined twice.** `AtlasCellDef` in `tools/genart/build.ts` and `AtlasCell` in `src/render/atlas.ts` describe the same JSON. They are kept separate because `tools/` and `src/` compile under different tsconfigs — Node types and no DOM on one side, DOM on the other — and importing across that boundary would drag Node types into the browser build. The committed-manifest test in `src/render/atlas.test.ts` is what holds the two in agreement: it parses the real generated file through the runtime types.

## File structure

**Create**

| File | Responsibility |
|---|---|
| `tools/genart/png.ts` | `encodePng` / `decodePng` over `node:zlib`. Knows nothing about sprites. |
| `tools/genart/palette.ts` | The 29 named colors, hex→RGBA, palette membership assertion. |
| `tools/genart/hash.ts` | The deterministic `hash01(x, y, salt)` used by both generator and renderer. |
| `tools/genart/raster.ts` | `Raster` — a mutable RGBA buffer with `set`/`blit`. No art knowledge. |
| `tools/genart/sprites/terrain.ts` | Material recipes; `makeBaseTile`, `makeFringe`, `makeFoam`. |
| `tools/genart/pack.ts` | Shelf packer: cell sizes in, positions + sheet height out. |
| `tools/genart/build.ts` | `buildAtlas()` — assembles sheets + manifest **in memory**. No file I/O, so tests can call it. |
| `tools/genart/index.ts` | Thin CLI: calls `buildAtlas()`, writes files. |
| `tools/genart/genart.test.ts` | Drift test: regenerate and compare decoded pixels to committed output. |
| `tsconfig.tools.json` | Typechecks `tools/` with Node types and no DOM. |
| `src/render/atlas.ts` | Manifest types, `cellRect` (pure), `loadAtlas`, `drawCell`. |
| `src/render/atlas.test.ts` | `cellRect` framing math; committed manifest covers every terrain. |
| `src/render/tilemap.ts` | Pure tile planning + shoreline detection, plus the `bakeTerrain` painter. |
| `src/render/tilemap.test.ts` | Fringe selection, variant stability, shoreline detection. |
| `public/art/tiles.png`, `public/art/atlas.json` | Generated, committed. |

**Modify**

| File | Change |
|---|---|
| `package.json` | Add `art` script and the `tsx` devDependency. |
| `tsconfig.json` | Reference `tsconfig.tools.json`. |
| `src/render/Canvas.tsx:285-316` | Load atlas, bake via tilemap or fall back to `drawTerrain`. |
| `src/render/Canvas.tsx:216-278` | Draw viewport-culled animated foam after the terrain blit. |
| `src/render/Canvas.tsx:322-345` | Add `art: { loaded, cells }` to `render_game_to_text`. |

**Unchanged:** `src/render/drawTerrain.ts` stays exactly as it is — it is the fallback path, not dead code.

---

### Task 1: PNG encoder and decoder

**Files:**
- Create: `tools/genart/png.ts`
- Test: `tools/genart/png.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `encodePng(width: number, height: number, rgba: Uint8Array): Uint8Array` and `decodePng(bytes: Uint8Array): { width: number; height: number; rgba: Uint8Array }`. Both use 8-bit RGBA, filter type 0, a single IDAT chunk.

- [ ] **Step 1: Write the failing test**

Create `tools/genart/png.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { decodePng, encodePng } from './png';

const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

describe('encodePng', () => {
  it('writes the PNG signature', () => {
    const png = encodePng(1, 1, new Uint8Array([255, 0, 0, 255]));
    expect(Array.from(png.subarray(0, 8))).toEqual(SIGNATURE);
  });

  it('round-trips pixel data through decodePng', () => {
    const rgba = new Uint8Array([
      255, 0, 0, 255, 0, 255, 0, 255,
      0, 0, 255, 255, 255, 255, 255, 0,
    ]);
    const decoded = decodePng(encodePng(2, 2, rgba));
    expect(decoded.width).toBe(2);
    expect(decoded.height).toBe(2);
    expect(Array.from(decoded.rgba)).toEqual(Array.from(rgba));
  });

  it('is deterministic for identical input', () => {
    const rgba = new Uint8Array(4 * 16).fill(120);
    expect(Array.from(encodePng(4, 4, rgba))).toEqual(Array.from(encodePng(4, 4, rgba)));
  });

  it('rejects a buffer whose length does not match the dimensions', () => {
    expect(() => encodePng(2, 2, new Uint8Array(4))).toThrow(/expected 16 bytes/);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tools/genart/png.test.ts`
Expected: FAIL — cannot resolve `./png`.

- [ ] **Step 3: Write the implementation**

Create `tools/genart/png.ts`:

```ts
import { deflateSync, inflateSync } from 'node:zlib';

const SIGNATURE = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = Uint8Array.from([...type].map((ch) => ch.charCodeAt(0)));
  const body = concat([typeBytes, data]);
  const out = new Uint8Array(body.length + 8);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  out.set(body, 4);
  view.setUint32(out.length - 4, crc32(body));
  return out;
}

/** Encode 8-bit RGBA pixels as a PNG. Filter type 0 on every row, one IDAT. */
export function encodePng(width: number, height: number, rgba: Uint8Array): Uint8Array {
  const expected = width * height * 4;
  if (rgba.length !== expected) {
    throw new Error(`encodePng: expected ${expected} bytes, received ${rgba.length}`);
  }
  const stride = width * 4;
  const raw = new Uint8Array((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0;
    raw.set(rgba.subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1);
  }

  const ihdr = new Uint8Array(13);
  const view = new DataView(ihdr.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: truecolour with alpha

  return concat([
    SIGNATURE,
    chunk('IHDR', ihdr),
    chunk('IDAT', new Uint8Array(deflateSync(raw, { level: 9 }))),
    chunk('IEND', new Uint8Array(0)),
  ]);
}

/** Decode a PNG produced by `encodePng`. Only 8-bit RGBA with filter 0 is supported. */
export function decodePng(bytes: Uint8Array): { width: number; height: number; rgba: Uint8Array } {
  for (let i = 0; i < SIGNATURE.length; i += 1) {
    if (bytes[i] !== SIGNATURE[i]) throw new Error('decodePng: not a PNG');
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 8;
  let width = 0;
  let height = 0;
  const idatParts: Uint8Array[] = [];

  while (offset < bytes.length) {
    const length = view.getUint32(offset);
    const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
    const data = bytes.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = view.getUint32(offset + 8);
      height = view.getUint32(offset + 12);
      if (data[8] !== 8 || data[9] !== 6) throw new Error('decodePng: expected 8-bit RGBA');
    } else if (type === 'IDAT') {
      idatParts.push(data);
    } else if (type === 'IEND') {
      break;
    }
    offset += length + 12;
  }

  const raw = new Uint8Array(inflateSync(concat(idatParts)));
  const stride = width * 4;
  const rgba = new Uint8Array(stride * height);
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)];
    if (filter !== 0) throw new Error(`decodePng: unsupported filter ${filter}`);
    rgba.set(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)), y * stride);
  }
  return { width, height, rgba };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tools/genart/png.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add tools/genart/png.ts tools/genart/png.test.ts
git commit -m "feat(art): add PNG encoder and decoder over node:zlib"
```

---

### Task 2: Palette and deterministic hash

**Files:**
- Create: `tools/genart/palette.ts`, `tools/genart/hash.ts`
- Test: `tools/genart/palette.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `PALETTE: Record<PaletteName, string>` — 29 entries.
  - `type PaletteName = keyof typeof PALETTE`
  - `toRgba(name: PaletteName): [number, number, number, number]`
  - `assertPaletteHex(hex: string): PaletteName` — throws if the hex is not a palette member.
  - `hash01(x: number, y: number, salt: number): number` in `[0, 1)`.

- [ ] **Step 1: Write the failing test**

Create `tools/genart/palette.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { hash01 } from './hash';
import { PALETTE, assertPaletteHex, toRgba } from './palette';

describe('PALETTE', () => {
  it('holds exactly the 29 specified colors', () => {
    expect(Object.keys(PALETTE)).toHaveLength(29);
  });

  it('has no duplicate hex values', () => {
    const values = Object.values(PALETTE);
    expect(new Set(values).size).toBe(values.length);
  });

  it('converts hex to RGBA', () => {
    expect(toRgba('whitewash')).toEqual([242, 236, 224, 255]);
    expect(toRgba('ink')).toEqual([43, 35, 32, 255]);
  });
});

describe('assertPaletteHex', () => {
  it('returns the palette name for a member color', () => {
    expect(assertPaletteHex('#2fa0a8')).toBe('seaShallow');
  });

  it('throws for a color outside the palette', () => {
    expect(() => assertPaletteHex('#ff00ff')).toThrow(/not in the palette/);
  });
});

describe('hash01', () => {
  it('is stable for the same inputs', () => {
    expect(hash01(7, 11, 3)).toBe(hash01(7, 11, 3));
  });

  it('stays within [0, 1)', () => {
    for (let x = 0; x < 40; x += 1) {
      for (let y = 0; y < 40; y += 1) {
        const value = hash01(x, y, 1);
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThan(1);
      }
    }
  });

  it('decorrelates neighbouring coordinates', () => {
    const samples = [hash01(0, 0, 0), hash01(1, 0, 0), hash01(0, 1, 0), hash01(1, 1, 0)];
    expect(new Set(samples).size).toBe(4);
  });

  it('spreads roughly uniformly across quarters', () => {
    const buckets = [0, 0, 0, 0];
    for (let x = 0; x < 100; x += 1) {
      for (let y = 0; y < 100; y += 1) buckets[Math.floor(hash01(x, y, 5) * 4)] += 1;
    }
    for (const count of buckets) expect(count).toBeGreaterThan(1800);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tools/genart/palette.test.ts`
Expected: FAIL — cannot resolve `./hash` and `./palette`.

- [ ] **Step 3: Write the implementations**

Create `tools/genart/hash.ts`:

```ts
/** Deterministic hash in [0, 1). Drives tile variants and all art jitter. */
export function hash01(x: number, y: number, salt: number): number {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(salt | 0, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
```

Create `tools/genart/palette.ts`:

```ts
/** The complete VillageSim art palette. No color outside this table may appear in art. */
export const PALETTE = {
  // sea
  seaDeepest: '#0e3f52',
  seaDeep: '#12556b',
  seaMid: '#1f7f92',
  seaShallow: '#2fa0a8',
  foam: '#a8e0dc',
  // sand and stone ground
  sandShadow: '#8a7455',
  sandMid: '#c9b483',
  sandLight: '#e0cfa0',
  sandPale: '#f2e8c8',
  // vegetation
  vegDarkest: '#2a4430',
  vegDark: '#3d5f39',
  vegMid: '#5c7a3e',
  vegLight: '#8fa249',
  vegPale: '#b5bb6a',
  // architecture
  stoneShadow: '#6b5f4e',
  stoneMid: '#9c8b70',
  stoneLight: '#b8a68c',
  stonePale: '#dcd2bd',
  whitewash: '#f2ece0',
  // terracotta
  terraDeep: '#7a3320',
  terraDark: '#a54428',
  terraMid: '#c05a34',
  terraLight: '#e08a5a',
  // accents
  shutter: '#3f6f8f',
  wheat: '#d9a531',
  ink: '#2b2320',
  // ui
  uiPanel: '#1b3038',
  uiRaised: '#26454f',
  uiRecess: '#14242a',
} as const;

export type PaletteName = keyof typeof PALETTE;

export type Rgba = [number, number, number, number];

export function toRgba(name: PaletteName): Rgba {
  const hex = PALETTE[name];
  return [
    Number.parseInt(hex.slice(1, 3), 16),
    Number.parseInt(hex.slice(3, 5), 16),
    Number.parseInt(hex.slice(5, 7), 16),
    255,
  ];
}

const BY_HEX = new Map<string, PaletteName>(
  (Object.keys(PALETTE) as PaletteName[]).map((name) => [PALETTE[name], name]),
);

/** Guard used by sprite authoring: reject any color that is not a palette member. */
export function assertPaletteHex(hex: string): PaletteName {
  const name = BY_HEX.get(hex.toLowerCase());
  if (!name) throw new Error(`Color ${hex} is not in the palette`);
  return name;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tools/genart/palette.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add tools/genart/hash.ts tools/genart/palette.ts tools/genart/palette.test.ts
git commit -m "feat(art): add 29-color palette and deterministic hash"
```

---

### Task 3: Raster buffer

**Files:**
- Create: `tools/genart/raster.ts`
- Test: `tools/genart/raster.test.ts`

**Interfaces:**
- Consumes: `Rgba` from `./palette`.
- Produces: `class Raster` with `readonly width`, `readonly height`, `readonly rgba: Uint8Array`, `set(x, y, color: Rgba): void` (silently ignores out-of-bounds), `get(x, y): Rgba`, and `blit(source: Raster, dx: number, dy: number): void`.

- [ ] **Step 1: Write the failing test**

Create `tools/genart/raster.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { Raster } from './raster';
import type { Rgba } from './palette';

const RED: Rgba = [255, 0, 0, 255];
const BLUE: Rgba = [0, 0, 255, 255];

describe('Raster', () => {
  it('starts fully transparent', () => {
    const raster = new Raster(2, 2);
    expect(Array.from(raster.rgba)).toEqual(new Array(16).fill(0));
  });

  it('sets and reads a pixel', () => {
    const raster = new Raster(3, 3);
    raster.set(1, 2, RED);
    expect(raster.get(1, 2)).toEqual(RED);
  });

  it('ignores out-of-bounds writes instead of corrupting neighbours', () => {
    const raster = new Raster(2, 2);
    raster.set(-1, 0, RED);
    raster.set(2, 0, RED);
    raster.set(0, 5, RED);
    expect(Array.from(raster.rgba)).toEqual(new Array(16).fill(0));
  });

  it('blits a source raster at an offset', () => {
    const source = new Raster(1, 1);
    source.set(0, 0, BLUE);
    const target = new Raster(3, 3);
    target.blit(source, 2, 1);
    expect(target.get(2, 1)).toEqual(BLUE);
    expect(target.get(0, 0)).toEqual([0, 0, 0, 0]);
  });

  it('skips fully transparent source pixels when blitting', () => {
    const source = new Raster(2, 1);
    source.set(1, 0, BLUE);
    const target = new Raster(2, 1);
    target.set(0, 0, RED);
    target.blit(source, 0, 0);
    expect(target.get(0, 0)).toEqual(RED);
    expect(target.get(1, 0)).toEqual(BLUE);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tools/genart/raster.test.ts`
Expected: FAIL — cannot resolve `./raster`.

- [ ] **Step 3: Write the implementation**

Create `tools/genart/raster.ts`:

```ts
import type { Rgba } from './palette';

/** A mutable RGBA pixel buffer. Knows nothing about sprites or the palette. */
export class Raster {
  readonly width: number;
  readonly height: number;
  readonly rgba: Uint8Array;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.rgba = new Uint8Array(width * height * 4);
  }

  private inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  set(x: number, y: number, color: Rgba): void {
    if (!this.inBounds(x, y)) return;
    const index = (y * this.width + x) * 4;
    this.rgba[index] = color[0];
    this.rgba[index + 1] = color[1];
    this.rgba[index + 2] = color[2];
    this.rgba[index + 3] = color[3];
  }

  get(x: number, y: number): Rgba {
    const index = (y * this.width + x) * 4;
    return [this.rgba[index], this.rgba[index + 1], this.rgba[index + 2], this.rgba[index + 3]];
  }

  /** Copy `source` in at (dx, dy). Fully transparent source pixels are skipped. */
  blit(source: Raster, dx: number, dy: number): void {
    for (let y = 0; y < source.height; y += 1) {
      for (let x = 0; x < source.width; x += 1) {
        const pixel = source.get(x, y);
        if (pixel[3] === 0) continue;
        this.set(dx + x, dy + y, pixel);
      }
    }
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tools/genart/raster.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add tools/genart/raster.ts tools/genart/raster.test.ts
git commit -m "feat(art): add Raster RGBA pixel buffer"
```

---

### Task 4: Terrain base tiles

**Files:**
- Create: `tools/genart/sprites/terrain.ts`
- Test: `tools/genart/sprites/terrain.test.ts`

**Interfaces:**
- Consumes: `Raster`, `toRgba`, `PaletteName`, `hash01`.
- Produces:
  - `export const TILE = 16`
  - `export const VARIANTS = 4`
  - `type BaseTerrain = 'deepWater' | 'shallowWater' | 'sand' | 'grass' | 'rock'`
  - `export const BASE_TERRAINS: readonly BaseTerrain[]`
  - `makeBaseTile(terrain: BaseTerrain, variant: number): Raster`

A base tile is a flat field of the material's base color, dithered with shade and highlight speckles. The speckle pattern is hashed from pixel coordinates and the variant index, so the four variants of a terrain differ but each is stable.

- [ ] **Step 1: Write the failing test**

Create `tools/genart/sprites/terrain.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { PALETTE } from '../palette';
import { BASE_TERRAINS, TILE, VARIANTS, makeBaseTile } from './terrain';

const PALETTE_RGB = new Set(
  Object.values(PALETTE).map((hex) =>
    [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16)).join(','),
  ),
);

function pixels(raster: { width: number; height: number; get: (x: number, y: number) => number[] }) {
  const out: number[][] = [];
  for (let y = 0; y < raster.height; y += 1) {
    for (let x = 0; x < raster.width; x += 1) out.push(raster.get(x, y));
  }
  return out;
}

describe('makeBaseTile', () => {
  it('produces a 16x16 fully opaque tile', () => {
    const tile = makeBaseTile('grass', 0);
    expect(tile.width).toBe(TILE);
    expect(tile.height).toBe(TILE);
    expect(pixels(tile).every((p) => p[3] === 255)).toBe(true);
  });

  it('uses only palette colors', () => {
    for (const terrain of BASE_TERRAINS) {
      for (let variant = 0; variant < VARIANTS; variant += 1) {
        for (const p of pixels(makeBaseTile(terrain, variant))) {
          expect(PALETTE_RGB.has(`${p[0]},${p[1]},${p[2]}`)).toBe(true);
        }
      }
    }
  });

  it('is deterministic', () => {
    expect(Array.from(makeBaseTile('sand', 2).rgba)).toEqual(Array.from(makeBaseTile('sand', 2).rgba));
  });

  it('produces four distinguishable variants per terrain', () => {
    for (const terrain of BASE_TERRAINS) {
      const seen = new Set<string>();
      for (let variant = 0; variant < VARIANTS; variant += 1) {
        seen.add(Array.from(makeBaseTile(terrain, variant).rgba).join(','));
      }
      expect(seen.size).toBe(VARIANTS);
    }
  });

  it('gives each terrain a visually distinct dominant color', () => {
    const dominants = BASE_TERRAINS.map((terrain) => {
      const counts = new Map<string, number>();
      for (const p of pixels(makeBaseTile(terrain, 0))) {
        const key = `${p[0]},${p[1]},${p[2]}`;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
      return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
    });
    expect(new Set(dominants).size).toBe(BASE_TERRAINS.length);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tools/genart/sprites/terrain.test.ts`
Expected: FAIL — cannot resolve `./terrain`.

- [ ] **Step 3: Write the implementation**

Create `tools/genart/sprites/terrain.ts`:

```ts
import { hash01 } from '../hash';
import type { PaletteName } from '../palette';
import { toRgba } from '../palette';
import { Raster } from '../raster';

export const TILE = 16;
export const VARIANTS = 4;

export type BaseTerrain = 'deepWater' | 'shallowWater' | 'sand' | 'grass' | 'rock';

export const BASE_TERRAINS: readonly BaseTerrain[] = [
  'deepWater',
  'shallowWater',
  'sand',
  'grass',
  'rock',
];

interface Material {
  base: PaletteName;
  shade: PaletteName;
  hilite: PaletteName;
  /** Fraction of pixels darkened. Highlights use 60% of this. */
  speckle: number;
  /** Distinguishes terrains in the hash so two materials never share a pattern. */
  salt: number;
}

export const MATERIALS: Record<BaseTerrain, Material> = {
  deepWater: { base: 'seaDeep', shade: 'seaDeepest', hilite: 'seaMid', speckle: 0.1, salt: 11 },
  shallowWater: { base: 'seaShallow', shade: 'seaMid', hilite: 'foam', speckle: 0.07, salt: 23 },
  sand: { base: 'sandLight', shade: 'sandMid', hilite: 'sandPale', speckle: 0.14, salt: 37 },
  grass: { base: 'vegLight', shade: 'vegMid', hilite: 'vegPale', speckle: 0.18, salt: 53 },
  rock: { base: 'stoneLight', shade: 'stoneShadow', hilite: 'stonePale', speckle: 0.16, salt: 71 },
};

/** A flat material field, dithered so the tilemap does not read as flat color. */
export function makeBaseTile(terrain: BaseTerrain, variant: number): Raster {
  const material = MATERIALS[terrain];
  const tile = new Raster(TILE, TILE);
  const base = toRgba(material.base);
  const shade = toRgba(material.shade);
  const hilite = toRgba(material.hilite);
  const salt = material.salt + variant * 101;

  for (let y = 0; y < TILE; y += 1) {
    for (let x = 0; x < TILE; x += 1) {
      const value = hash01(x, y, salt);
      if (value < material.speckle) tile.set(x, y, shade);
      else if (value > 1 - material.speckle * 0.6) tile.set(x, y, hilite);
      else tile.set(x, y, base);
    }
  }
  return tile;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tools/genart/sprites/terrain.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add tools/genart/sprites/terrain.ts tools/genart/sprites/terrain.test.ts
git commit -m "feat(art): generate dithered terrain base tiles"
```

---

### Task 5: Edge fringes and animated foam

**Files:**
- Modify: `tools/genart/sprites/terrain.ts`
- Modify: `tools/genart/sprites/terrain.test.ts`

**Interfaces:**
- Produces:
  - `export const EDGES: readonly Edge[]` where `type Edge = 'n' | 'e' | 's' | 'w' | 'nwOut' | 'neOut' | 'seOut' | 'swOut' | 'nwIn' | 'neIn' | 'seIn' | 'swIn'` (12 entries).
  - `export const FOAM_EDGES: readonly Edge[]` — the 8 side and outer-corner edges only.
  - `export const FOAM_FRAMES = 3`
  - `makeFringe(terrain: BaseTerrain, edge: Edge): Raster`
  - `makeFoam(edge: Edge, frame: number): Raster`

A fringe is the *higher* terrain spilling a few jittered pixels onto the *lower* neighbouring tile, with its outermost row in the shade color to form a lip. Outer corners are filled where either adjacent side would reach; inner corners only where both would. Foam is the same shape logic in the `foam` color, one to three pixels deep, re-jittered per frame.

- [ ] **Step 1: Write the failing test**

Append to `tools/genart/sprites/terrain.test.ts`:

```ts
import { EDGES, FOAM_EDGES, FOAM_FRAMES, makeFoam, makeFringe } from './terrain';

function opaqueCount(raster: ReturnType<typeof makeFringe>): number {
  let count = 0;
  for (let y = 0; y < raster.height; y += 1) {
    for (let x = 0; x < raster.width; x += 1) if (raster.get(x, y)[3] === 255) count += 1;
  }
  return count;
}

function rowHasPixels(raster: ReturnType<typeof makeFringe>, y: number): boolean {
  for (let x = 0; x < raster.width; x += 1) if (raster.get(x, y)[3] === 255) return true;
  return false;
}

function columnHasPixels(raster: ReturnType<typeof makeFringe>, x: number): boolean {
  for (let y = 0; y < raster.height; y += 1) if (raster.get(x, y)[3] === 255) return true;
  return false;
}

describe('EDGES', () => {
  it('covers four sides, four outer corners and four inner corners', () => {
    expect(EDGES).toHaveLength(12);
    expect(new Set(EDGES).size).toBe(12);
  });
});

describe('makeFringe', () => {
  it('leaves most of the tile transparent', () => {
    const fringe = makeFringe('grass', 'n');
    expect(opaqueCount(fringe)).toBeGreaterThan(0);
    expect(opaqueCount(fringe)).toBeLessThan(TILE * TILE * 0.5);
  });

  it('puts a north fringe against the top edge and nowhere near the bottom', () => {
    const fringe = makeFringe('grass', 'n');
    expect(rowHasPixels(fringe, 0)).toBe(true);
    expect(rowHasPixels(fringe, TILE - 1)).toBe(false);
  });

  it('puts a west fringe against the left edge and nowhere near the right', () => {
    const fringe = makeFringe('sand', 'w');
    expect(columnHasPixels(fringe, 0)).toBe(true);
    expect(columnHasPixels(fringe, TILE - 1)).toBe(false);
  });

  it('makes outer corners larger than inner corners', () => {
    expect(opaqueCount(makeFringe('rock', 'nwOut'))).toBeGreaterThan(
      opaqueCount(makeFringe('rock', 'nwIn')),
    );
  });

  it('is deterministic across every terrain and edge', () => {
    for (const terrain of BASE_TERRAINS) {
      for (const edge of EDGES) {
        expect(Array.from(makeFringe(terrain, edge).rgba)).toEqual(
          Array.from(makeFringe(terrain, edge).rgba),
        );
      }
    }
  });

  it('uses only palette colors', () => {
    for (const p of pixels(makeFringe('grass', 'nwOut'))) {
      if (p[3] === 0) continue;
      expect(PALETTE_RGB.has(`${p[0]},${p[1]},${p[2]}`)).toBe(true);
    }
  });
});

describe('makeFoam', () => {
  it('only covers side and outer-corner edges', () => {
    expect(FOAM_EDGES).toHaveLength(8);
    expect(FOAM_EDGES.every((edge) => !edge.endsWith('In'))).toBe(true);
  });

  it('differs between frames so the shoreline shimmers', () => {
    const seen = new Set<string>();
    for (let frame = 0; frame < FOAM_FRAMES; frame += 1) {
      seen.add(Array.from(makeFoam('n', frame).rgba).join(','));
    }
    expect(seen.size).toBe(FOAM_FRAMES);
  });

  it('is thinner than the matching fringe', () => {
    expect(opaqueCount(makeFoam('n', 0))).toBeLessThan(opaqueCount(makeFringe('sand', 'n')));
  });

  it('is deterministic', () => {
    expect(Array.from(makeFoam('e', 1).rgba)).toEqual(Array.from(makeFoam('e', 1).rgba));
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tools/genart/sprites/terrain.test.ts`
Expected: FAIL — `EDGES`, `makeFringe`, `makeFoam` are not exported.

- [ ] **Step 3: Write the implementation**

Append to `tools/genart/sprites/terrain.ts`:

```ts
export type Edge =
  | 'n' | 'e' | 's' | 'w'
  | 'nwOut' | 'neOut' | 'seOut' | 'swOut'
  | 'nwIn' | 'neIn' | 'seIn' | 'swIn';

export const EDGES: readonly Edge[] = [
  'n', 'e', 's', 'w',
  'nwOut', 'neOut', 'seOut', 'swOut',
  'nwIn', 'neIn', 'seIn', 'swIn',
];

export const FOAM_EDGES: readonly Edge[] = ['n', 'e', 's', 'w', 'nwOut', 'neOut', 'seOut', 'swOut'];

export const FOAM_FRAMES = 3;

/** Distance from each of the four tile borders, in pixels. */
function borderDistance(x: number, y: number) {
  return { north: y, east: TILE - 1 - x, south: TILE - 1 - y, west: x };
}

/**
 * Depth of the fringe at a position along a border, in pixels.
 * `along` is the coordinate running parallel to the border, so the jitter
 * varies across the edge and the boundary reads as irregular rather than ruled.
 */
function depthAt(along: number, salt: number, min: number, range: number): number {
  return min + Math.floor(hash01(along, 0, salt) * range);
}

/**
 * How each edge shape combines the four border reaches.
 * Keyed by `Edge`, so omitting a shape is a compile error rather than a silent
 * fall-through. Unused parameters are underscore-prefixed to satisfy
 * `noUnusedParameters`.
 */
const EDGE_SHAPES: Record<Edge, (n: boolean, e: boolean, s: boolean, w: boolean) => boolean> = {
  n: (n) => n,
  e: (_n, e) => e,
  s: (_n, _e, s) => s,
  w: (_n, _e, _s, w) => w,
  // Outer: the higher terrain wraps the corner, so either side reaching is enough.
  nwOut: (n, _e, _s, w) => n || w,
  neOut: (n, e) => n || e,
  seOut: (_n, e, s) => s || e,
  swOut: (_n, _e, s, w) => s || w,
  // Inner: only the diagonal neighbour is higher, so just a nub where both reach.
  nwIn: (n, _e, _s, w) => n && w,
  neIn: (n, e) => n && e,
  seIn: (_n, e, s) => s && e,
  swIn: (_n, _e, s, w) => s && w,
};

/** Is this pixel inside the given edge shape? */
function inEdge(edge: Edge, x: number, y: number, salt: number, min: number, range: number): boolean {
  const d = borderDistance(x, y);
  return EDGE_SHAPES[edge](
    d.north < depthAt(x, salt, min, range),
    d.east < depthAt(y, salt + 1, min, range),
    d.south < depthAt(x, salt + 2, min, range),
    d.west < depthAt(y, salt + 3, min, range),
  );
}

/** Is this pixel on the outermost row of the shape — the lip that catches shadow? */
function isLip(edge: Edge, x: number, y: number, salt: number, min: number, range: number): boolean {
  if (!inEdge(edge, x, y, salt, min, range)) return false;
  const neighbours: Array<[number, number]> = [[x, y - 1], [x, y + 1], [x - 1, y], [x + 1, y]];
  return neighbours.some(([nx, ny]) => {
    if (nx < 0 || ny < 0 || nx >= TILE || ny >= TILE) return false;
    return !inEdge(edge, nx, ny, salt, min, range);
  });
}

const FRINGE_MIN = 3;
const FRINGE_RANGE = 3;

/** The higher terrain spilling onto a lower neighbour, with a shaded lip. */
export function makeFringe(terrain: BaseTerrain, edge: Edge): Raster {
  const material = MATERIALS[terrain];
  const raster = new Raster(TILE, TILE);
  const base = toRgba(material.base);
  const shade = toRgba(material.shade);
  const salt = material.salt * 7 + 13;

  for (let y = 0; y < TILE; y += 1) {
    for (let x = 0; x < TILE; x += 1) {
      if (!inEdge(edge, x, y, salt, FRINGE_MIN, FRINGE_RANGE)) continue;
      raster.set(x, y, isLip(edge, x, y, salt, FRINGE_MIN, FRINGE_RANGE) ? shade : base);
    }
  }
  return raster;
}

const FOAM_MIN = 1;
const FOAM_RANGE = 2;

/** A thin shimmering band on the water side of a shoreline. */
export function makeFoam(edge: Edge, frame: number): Raster {
  const raster = new Raster(TILE, TILE);
  const bright = toRgba('foam');
  const soft = toRgba('seaShallow');
  const salt = 907 + frame * 131;

  for (let y = 0; y < TILE; y += 1) {
    for (let x = 0; x < TILE; x += 1) {
      if (!inEdge(edge, x, y, salt, FOAM_MIN, FOAM_RANGE)) continue;
      raster.set(x, y, isLip(edge, x, y, salt, FOAM_MIN, FOAM_RANGE) ? bright : soft);
    }
  }
  return raster;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tools/genart/sprites/terrain.test.ts`
Expected: PASS, 15 tests.

- [ ] **Step 5: Commit**

```bash
git add tools/genart/sprites/terrain.ts tools/genart/sprites/terrain.test.ts
git commit -m "feat(art): generate terrain edge fringes and animated foam"
```

---

### Task 6: Shelf packer

**Files:**
- Create: `tools/genart/pack.ts`
- Test: `tools/genart/pack.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `interface PackItem { key: string; width: number; height: number; }`
  - `interface PackedCell { key: string; x: number; y: number; width: number; height: number; }`
  - `pack(items: PackItem[], sheetWidth: number): { cells: PackedCell[]; height: number }`

Items are sorted by height descending, then laid out in shelves. The returned height is rounded up to the next power of two so the sheet stays GPU-friendly.

- [ ] **Step 1: Write the failing test**

Create `tools/genart/pack.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { pack } from './pack';

const square = (key: string, size = 16) => ({ key, width: size, height: size });

describe('pack', () => {
  it('places every item exactly once', () => {
    const items = Array.from({ length: 30 }, (_, i) => square(`t${i}`));
    const { cells } = pack(items, 256);
    expect(cells).toHaveLength(30);
    expect(new Set(cells.map((c) => c.key)).size).toBe(30);
  });

  it('keeps every cell inside the sheet bounds', () => {
    const { cells, height } = pack(Array.from({ length: 40 }, (_, i) => square(`t${i}`)), 128);
    for (const cell of cells) {
      expect(cell.x).toBeGreaterThanOrEqual(0);
      expect(cell.y).toBeGreaterThanOrEqual(0);
      expect(cell.x + cell.width).toBeLessThanOrEqual(128);
      expect(cell.y + cell.height).toBeLessThanOrEqual(height);
    }
  });

  it('never overlaps two cells', () => {
    const items = [square('a', 48), square('b', 16), square('c', 32), square('d', 16), square('e', 64)];
    const { cells } = pack(items, 96);
    for (let i = 0; i < cells.length; i += 1) {
      for (let j = i + 1; j < cells.length; j += 1) {
        const a = cells[i];
        const b = cells[j];
        const disjoint =
          a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y;
        expect(disjoint).toBe(true);
      }
    }
  });

  it('returns a power-of-two height', () => {
    const { height } = pack(Array.from({ length: 20 }, (_, i) => square(`t${i}`)), 64);
    expect(Number.isInteger(Math.log2(height))).toBe(true);
  });

  it('is deterministic', () => {
    const items = Array.from({ length: 25 }, (_, i) => square(`t${i}`, 16 + (i % 3) * 8));
    expect(pack(items, 128)).toEqual(pack(items, 128));
  });

  it('throws when an item is wider than the sheet', () => {
    expect(() => pack([square('huge', 300)], 256)).toThrow(/wider than the sheet/);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tools/genart/pack.test.ts`
Expected: FAIL — cannot resolve `./pack`.

- [ ] **Step 3: Write the implementation**

Create `tools/genart/pack.ts`:

```ts
export interface PackItem {
  key: string;
  width: number;
  height: number;
}

export interface PackedCell {
  key: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Shelf-pack items into a fixed-width sheet. Deterministic for a given input. */
export function pack(items: PackItem[], sheetWidth: number): { cells: PackedCell[]; height: number } {
  for (const item of items) {
    if (item.width > sheetWidth) {
      throw new Error(`Item ${item.key} (${item.width}px) is wider than the sheet (${sheetWidth}px)`);
    }
  }

  // Tallest first keeps shelves tight; the key tie-break keeps the order total.
  const ordered = [...items].sort((a, b) => b.height - a.height || a.key.localeCompare(b.key));

  const cells: PackedCell[] = [];
  let shelfY = 0;
  let shelfHeight = 0;
  let cursorX = 0;

  for (const item of ordered) {
    if (cursorX + item.width > sheetWidth) {
      shelfY += shelfHeight;
      shelfHeight = 0;
      cursorX = 0;
    }
    cells.push({ key: item.key, x: cursorX, y: shelfY, width: item.width, height: item.height });
    cursorX += item.width;
    shelfHeight = Math.max(shelfHeight, item.height);
  }

  const used = shelfY + shelfHeight;
  const height = used === 0 ? 1 : 2 ** Math.ceil(Math.log2(used));
  return { cells, height };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tools/genart/pack.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add tools/genart/pack.ts tools/genart/pack.test.ts
git commit -m "feat(art): add deterministic shelf packer"
```

---

### Task 7: Atlas assembly

**Files:**
- Create: `tools/genart/build.ts`
- Test: `tools/genart/build.test.ts`

**Interfaces:**
- Consumes: `Raster`, `pack`, `makeBaseTile`, `makeFringe`, `makeFoam`, `BASE_TERRAINS`, `EDGES`, `FOAM_EDGES`, `FOAM_FRAMES`, `TILE`, `VARIANTS`.
- Produces:
  - `interface AtlasCellDef { sheet: string; x: number; y: number; w: number; h: number; anchorY?: number; frames?: number; }`
  - `interface AtlasManifest { sheets: Record<string, string>; cells: Record<string, AtlasCellDef>; }`
  - `interface BuiltSheet { name: string; width: number; height: number; rgba: Uint8Array; }`
  - `interface BuiltAtlas { sheets: BuiltSheet[]; manifest: AtlasManifest; }`
  - `export const SHEET_WIDTH = 256`
  - `buildAtlas(): BuiltAtlas`

Cell keys follow three patterns: `terrain.<name>.<variant>`, `fringe.<name>.<edge>`, `foam.<edge>`. Multi-frame cells are packed side by side, so a foam cell reserves `w * frames` pixels of width while `w` in the manifest stays one frame wide.

- [ ] **Step 1: Write the failing test**

Create `tools/genart/build.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { SHEET_WIDTH, buildAtlas } from './build';
import { BASE_TERRAINS, EDGES, FOAM_EDGES, FOAM_FRAMES, TILE, VARIANTS } from './sprites/terrain';

describe('buildAtlas', () => {
  const atlas = buildAtlas();

  it('emits a single tiles sheet', () => {
    expect(atlas.sheets).toHaveLength(1);
    expect(atlas.sheets[0].name).toBe('tiles');
    expect(atlas.manifest.sheets).toEqual({ tiles: 'tiles.png' });
  });

  it('sizes the sheet buffer to its declared dimensions', () => {
    const sheet = atlas.sheets[0];
    expect(sheet.width).toBe(SHEET_WIDTH);
    expect(sheet.rgba).toHaveLength(sheet.width * sheet.height * 4);
  });

  it('emits a cell for every terrain variant', () => {
    for (const terrain of BASE_TERRAINS) {
      for (let variant = 0; variant < VARIANTS; variant += 1) {
        expect(atlas.manifest.cells[`terrain.${terrain}.${variant}`]).toBeDefined();
      }
    }
  });

  it('emits a fringe cell for every terrain and edge', () => {
    for (const terrain of BASE_TERRAINS) {
      for (const edge of EDGES) {
        expect(atlas.manifest.cells[`fringe.${terrain}.${edge}`]).toBeDefined();
      }
    }
  });

  it('emits a multi-frame foam cell for every foam edge', () => {
    for (const edge of FOAM_EDGES) {
      const cell = atlas.manifest.cells[`foam.${edge}`];
      expect(cell).toBeDefined();
      expect(cell.frames).toBe(FOAM_FRAMES);
      expect(cell.w).toBe(TILE);
    }
  });

  it('emits exactly the expected number of cells', () => {
    const expected =
      BASE_TERRAINS.length * VARIANTS + BASE_TERRAINS.length * EDGES.length + FOAM_EDGES.length;
    expect(Object.keys(atlas.manifest.cells)).toHaveLength(expected);
  });

  it('keeps every cell, including all its frames, inside the sheet', () => {
    const sheet = atlas.sheets[0];
    for (const [key, cell] of Object.entries(atlas.manifest.cells)) {
      const span = cell.w * (cell.frames ?? 1);
      expect(cell.x + span, key).toBeLessThanOrEqual(sheet.width);
      expect(cell.y + cell.h, key).toBeLessThanOrEqual(sheet.height);
    }
  });

  it('is deterministic', () => {
    const again = buildAtlas();
    expect(again.manifest).toEqual(atlas.manifest);
    expect(Array.from(again.sheets[0].rgba)).toEqual(Array.from(atlas.sheets[0].rgba));
  });

  it('writes actual pixels into the sheet', () => {
    expect(atlas.sheets[0].rgba.some((byte) => byte !== 0)).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tools/genart/build.test.ts`
Expected: FAIL — cannot resolve `./build`.

- [ ] **Step 3: Write the implementation**

Create `tools/genart/build.ts`:

```ts
import type { PackItem } from './pack';
import { pack } from './pack';
import { Raster } from './raster';
import {
  BASE_TERRAINS,
  EDGES,
  FOAM_EDGES,
  FOAM_FRAMES,
  VARIANTS,
  makeBaseTile,
  makeFoam,
  makeFringe,
} from './sprites/terrain';

export const SHEET_WIDTH = 256;

export interface AtlasCellDef {
  sheet: string;
  x: number;
  y: number;
  /** Width of a single frame. */
  w: number;
  h: number;
  /** Pixels of sprite above the footprint. Absent means zero. */
  anchorY?: number;
  /** Frame count; frames are laid out horizontally. Absent means one. */
  frames?: number;
}

export interface AtlasManifest {
  sheets: Record<string, string>;
  cells: Record<string, AtlasCellDef>;
}

export interface BuiltSheet {
  name: string;
  width: number;
  height: number;
  rgba: Uint8Array;
}

export interface BuiltAtlas {
  sheets: BuiltSheet[];
  manifest: AtlasManifest;
}

interface Source {
  key: string;
  frames: Raster[];
}

function terrainSources(): Source[] {
  const sources: Source[] = [];

  for (const terrain of BASE_TERRAINS) {
    for (let variant = 0; variant < VARIANTS; variant += 1) {
      sources.push({ key: `terrain.${terrain}.${variant}`, frames: [makeBaseTile(terrain, variant)] });
    }
  }

  for (const terrain of BASE_TERRAINS) {
    for (const edge of EDGES) {
      sources.push({ key: `fringe.${terrain}.${edge}`, frames: [makeFringe(terrain, edge)] });
    }
  }

  for (const edge of FOAM_EDGES) {
    const frames = Array.from({ length: FOAM_FRAMES }, (_, frame) => makeFoam(edge, frame));
    sources.push({ key: `foam.${edge}`, frames });
  }

  return sources;
}

/** Rasterize every sprite, pack it into one sheet, and describe it in a manifest. */
export function buildAtlas(): BuiltAtlas {
  const sources = terrainSources();

  const items: PackItem[] = sources.map((source) => ({
    key: source.key,
    width: source.frames[0].width * source.frames.length,
    height: source.frames[0].height,
  }));

  const { cells, height } = pack(items, SHEET_WIDTH);
  const sheet = new Raster(SHEET_WIDTH, height);
  const byKey = new Map(sources.map((source) => [source.key, source]));
  const manifestCells: Record<string, AtlasCellDef> = {};

  for (const cell of cells) {
    const source = byKey.get(cell.key);
    if (!source) throw new Error(`Packed cell ${cell.key} has no source`);
    source.frames.forEach((frame, index) => {
      sheet.blit(frame, cell.x + index * frame.width, cell.y);
    });
    const def: AtlasCellDef = {
      sheet: 'tiles',
      x: cell.x,
      y: cell.y,
      w: source.frames[0].width,
      h: source.frames[0].height,
    };
    if (source.frames.length > 1) def.frames = source.frames.length;
    manifestCells[cell.key] = def;
  }

  // Sort keys so the committed manifest has a stable, reviewable order.
  const sortedCells: Record<string, AtlasCellDef> = {};
  for (const key of Object.keys(manifestCells).sort()) sortedCells[key] = manifestCells[key];

  return {
    sheets: [{ name: 'tiles', width: SHEET_WIDTH, height, rgba: sheet.rgba }],
    manifest: { sheets: { tiles: 'tiles.png' }, cells: sortedCells },
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tools/genart/build.test.ts`
Expected: PASS, 9 tests. The expected cell count is `5*4 + 5*12 + 8 = 88`.

- [ ] **Step 5: Commit**

```bash
git add tools/genart/build.ts tools/genart/build.test.ts
git commit -m "feat(art): assemble terrain atlas sheet and manifest"
```

---

### Task 8: Generator CLI, committed output, and drift test

**Files:**
- Create: `tools/genart/paths.ts`, `tools/genart/index.ts`, `tools/genart/genart.test.ts`, `tsconfig.tools.json`
- Create (generated): `public/art/tiles.png`, `public/art/atlas.json`
- Modify: `package.json`, `tsconfig.json`

**Interfaces:**
- Consumes: `buildAtlas`, `encodePng`, `decodePng`.
- Produces: `npm run art` writes `public/art/`. `export const ART_DIR` from `index.ts` for the drift test to locate output.

- [ ] **Step 1: Add the tsx devDependency and the art script**

Modify `package.json` — add to `scripts`:

```json
"art": "tsx tools/genart/index.ts"
```

Then install:

```bash
npm install --save-dev tsx@^4.19.0
```

- [ ] **Step 2: Add the tools tsconfig**

Create `tsconfig.tools.json`:

```json
{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.tools.tsbuildinfo",
    "target": "ES2023",
    "lib": ["ES2023"],
    "module": "ESNext",
    "types": ["node"],
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "moduleDetection": "force",
    "noEmit": true,
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["tools"]
}
```

Modify `tsconfig.json` to reference it:

```json
{
  "files": [],
  "references": [{ "path": "./tsconfig.app.json" }, { "path": "./tsconfig.tools.json" }]
}
```

- [ ] **Step 3: Write the output path module and the CLI**

`ART_DIR` lives in its own module. If it lived in `index.ts`, the drift test would have to
import `index.ts` — which runs `main()`, regenerating the very files the test is meant to
compare against, so the test would pass unconditionally.

Create `tools/genart/paths.ts`:

```ts
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Where generated art is written. Imported by the CLI and the drift test. */
export const ART_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'public', 'art');
```

Create `tools/genart/index.ts`:

```ts
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
```

- [ ] **Step 4: Generate the art and confirm it is not gitignored**

```bash
npm run art
git check-ignore -v public/art/tiles.png || echo "not ignored - good"
ls -la public/art
```

Expected: `tiles.png` and `atlas.json` exist; `git check-ignore` reports nothing, so the `|| echo` branch prints. If `public/` turns out to be ignored, add `!public/art/` to `.gitignore` — the generated art must be committed.

- [ ] **Step 5: Write the drift test**

Create `tools/genart/genart.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildAtlas } from './build';
import { ART_DIR } from './paths';
import { decodePng } from './png';

// The committed PNG is compared by decoded pixels, not raw bytes: zlib output
// varies with the Node version, so a byte comparison would fail spuriously.
describe('committed art', () => {
  const atlas = buildAtlas();

  it('matches the committed manifest', () => {
    const committed = JSON.parse(readFileSync(join(ART_DIR, 'atlas.json'), 'utf8'));
    expect(committed).toEqual(atlas.manifest);
  });

  it('matches the committed sheet pixels', () => {
    for (const sheet of atlas.sheets) {
      const decoded = decodePng(readFileSync(join(ART_DIR, `${sheet.name}.png`)));
      expect(decoded.width).toBe(sheet.width);
      expect(decoded.height).toBe(sheet.height);
      expect(Array.from(decoded.rgba)).toEqual(Array.from(sheet.rgba));
    }
  });
});
```

This test must import `./paths`, never `./index`. Importing `./index` would execute `main()` and rewrite `public/art/` before the assertions ran, so the test would compare freshly generated output against itself and pass no matter what had drifted.

Confirm the test can actually fail: corrupt the committed art, watch it go red, then restore it.

```bash
npx vitest run tools/genart/genart.test.ts          # PASS
node -e "require('fs').writeFileSync('public/art/atlas.json','{}')"
npx vitest run tools/genart/genart.test.ts          # must FAIL
npm run art
npx vitest run tools/genart/genart.test.ts          # PASS again
```

- [ ] **Step 6: Run the full suite and the typecheck**

Run: `npm test && npm run build`
Expected: all tests PASS, including the two drift tests; `tsc -b` typechecks both `src` and `tools` with no errors.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json tsconfig.json tsconfig.tools.json \
        tools/genart/paths.ts tools/genart/index.ts tools/genart/genart.test.ts public/art
git commit -m "feat(art): add art generator CLI and commit generated terrain atlas"
```

---

### Task 9: Runtime atlas loader

**Files:**
- Create: `src/render/atlas.ts`
- Test: `src/render/atlas.test.ts`

**Interfaces:**
- Consumes: the committed `public/art/atlas.json` shape.
- Produces:
  - `interface AtlasCell { sheet: string; x: number; y: number; w: number; h: number; anchorY?: number; frames?: number; }`
  - `interface AtlasManifest { sheets: Record<string, string>; cells: Record<string, AtlasCell>; }`
  - `interface Atlas { manifest: AtlasManifest; images: Record<string, HTMLImageElement>; }`
  - `cellRect(cell: AtlasCell, frame: number): [number, number, number, number]` — **pure**
  - `frameCount(cell: AtlasCell): number` — **pure**
  - `loadAtlas(base?: string): Promise<Atlas | null>` — resolves `null` on any failure
  - `drawCell(ctx: CanvasRenderingContext2D, atlas: Atlas, key: string, dx: number, dy: number, frame?: number, scale?: number): void`

Only `cellRect` and `frameCount` are tested — the rest touch DOM APIs that the Node test environment does not provide, and are covered by the `art.loaded` field asserted in the Playwright smoke flow.

- [ ] **Step 1: Write the failing test**

Create `src/render/atlas.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { AtlasCell, AtlasManifest } from './atlas';
import { cellRect, frameCount } from './atlas';

const single: AtlasCell = { sheet: 'tiles', x: 32, y: 16, w: 16, h: 16 };
const animated: AtlasCell = { sheet: 'tiles', x: 64, y: 0, w: 16, h: 16, frames: 3 };

describe('frameCount', () => {
  it('defaults to one frame', () => {
    expect(frameCount(single)).toBe(1);
  });

  it('reads the declared frame count', () => {
    expect(frameCount(animated)).toBe(3);
  });
});

describe('cellRect', () => {
  it('returns the cell rect for a single-frame cell', () => {
    expect(cellRect(single, 0)).toEqual([32, 16, 16, 16]);
  });

  it('steps horizontally by one frame width', () => {
    expect(cellRect(animated, 0)).toEqual([64, 0, 16, 16]);
    expect(cellRect(animated, 2)).toEqual([96, 0, 16, 16]);
  });

  it('wraps a frame index past the end', () => {
    expect(cellRect(animated, 3)).toEqual([64, 0, 16, 16]);
    expect(cellRect(animated, 4)).toEqual([80, 0, 16, 16]);
  });

  it('clamps a negative frame index to the first frame', () => {
    expect(cellRect(animated, -1)).toEqual([64, 0, 16, 16]);
  });
});

describe('committed manifest', () => {
  const manifest = JSON.parse(readFileSync('public/art/atlas.json', 'utf8')) as AtlasManifest;

  it('declares the tiles sheet', () => {
    expect(manifest.sheets.tiles).toBe('tiles.png');
  });

  it('covers all five base terrains with four variants each', () => {
    for (const terrain of ['deepWater', 'shallowWater', 'sand', 'grass', 'rock']) {
      for (let variant = 0; variant < 4; variant += 1) {
        expect(manifest.cells[`terrain.${terrain}.${variant}`]).toBeDefined();
      }
    }
  });

  it('gives every cell a positive size', () => {
    for (const [key, cell] of Object.entries(manifest.cells)) {
      expect(cell.w, key).toBeGreaterThan(0);
      expect(cell.h, key).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/render/atlas.test.ts`
Expected: FAIL — cannot resolve `./atlas`.

- [ ] **Step 3: Write the implementation**

Create `src/render/atlas.ts`:

```ts
export interface AtlasCell {
  sheet: string;
  x: number;
  y: number;
  /** Width of a single frame. */
  w: number;
  h: number;
  /** Pixels of sprite above the footprint. Absent means zero. */
  anchorY?: number;
  /** Frame count; frames are laid out horizontally. Absent means one. */
  frames?: number;
}

export interface AtlasManifest {
  sheets: Record<string, string>;
  cells: Record<string, AtlasCell>;
}

export interface Atlas {
  manifest: AtlasManifest;
  images: Record<string, HTMLImageElement>;
}

/** Native art is 16px; the world uses 32px tiles, so art draws at 2x. */
export const ART_SCALE = 2;

export function frameCount(cell: AtlasCell): number {
  return cell.frames ?? 1;
}

/** Source rect for one frame. Frame indices wrap; negatives clamp to the first frame. */
export function cellRect(cell: AtlasCell, frame: number): [number, number, number, number] {
  const count = frameCount(cell);
  const index = frame < 0 ? 0 : frame % count;
  return [cell.x + index * cell.w, cell.y, cell.w, cell.h];
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load ${src}`));
    image.src = src;
  });
}

/**
 * Load the manifest and every sheet it declares.
 * Resolves `null` on any failure so the caller can fall back to flat-color drawing.
 */
export async function loadAtlas(base = '/art/'): Promise<Atlas | null> {
  try {
    const response = await fetch(`${base}atlas.json`);
    if (!response.ok) return null;
    const manifest = (await response.json()) as AtlasManifest;
    const names = Object.keys(manifest.sheets);
    const images = await Promise.all(names.map((name) => loadImage(`${base}${manifest.sheets[name]}`)));
    return {
      manifest,
      images: Object.fromEntries(names.map((name, index) => [name, images[index]])),
    };
  } catch {
    return null;
  }
}

/** Draw one atlas cell at world position (dx, dy). Unknown keys are skipped. */
export function drawCell(
  ctx: CanvasRenderingContext2D,
  atlas: Atlas,
  key: string,
  dx: number,
  dy: number,
  frame = 0,
  scale = ART_SCALE,
): void {
  const cell = atlas.manifest.cells[key];
  if (!cell) return;
  const image = atlas.images[cell.sheet];
  if (!image) return;
  const [sx, sy, sw, sh] = cellRect(cell, frame);
  ctx.drawImage(image, sx, sy, sw, sh, dx, dy, sw * scale, sh * scale);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/render/atlas.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
git add src/render/atlas.ts src/render/atlas.test.ts
git commit -m "feat(render): add runtime atlas loader and cell framing"
```

---

### Task 10: Tile planning and shoreline detection

**Files:**
- Create: `src/render/tilemap.ts`
- Test: `src/render/tilemap.test.ts`

**Interfaces:**
- Consumes: `Atlas`, `drawCell`, `ART_SCALE` from `./atlas`; `TerrainSnapshot` from `../state/types`.
- Produces:
  - `type BaseTerrainName = 'deepWater' | 'shallowWater' | 'sand' | 'grass' | 'rock'`
  - `baseTerrainOf(terrain: number): BaseTerrainName` — Forest maps to grass, Mountain to rock
  - `priorityOf(terrain: number): number`
  - `variantIndex(x: number, y: number): number` in `0..3`
  - `planTile(tiles: ArrayLike<number>, width: number, height: number, x: number, y: number): { base: string; fringes: string[] }`
  - `interface ShorelineTile { x: number; y: number; edges: string[] }`
  - `shorelineTiles(terrain: TerrainSnapshot): ShorelineTile[]`
  - `bakeTerrain(ctx: CanvasRenderingContext2D, atlas: Atlas, terrain: TerrainSnapshot): void`

`bakeTerrain` is the only DOM-touching export and is not unit tested; everything above it is pure.

Out-of-bounds neighbours are treated as *the same terrain as the tile itself*, so map borders do not sprout spurious fringes.

- [ ] **Step 1: Write the failing test**

Create `src/render/tilemap.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { baseTerrainOf, planTile, priorityOf, shorelineTiles, variantIndex } from './tilemap';

const DEEP = 0;
const SHALLOW = 1;
const SAND = 2;
const GRASS = 3;
const FOREST = 4;
const ROCK = 5;
const MOUNTAIN = 6;

/** Build a grid from rows of terrain bytes. */
function grid(rows: number[][]) {
  return { tiles: rows.flat(), width: rows[0].length, height: rows.length };
}

describe('baseTerrainOf', () => {
  it('maps the five base terrains to themselves', () => {
    expect(baseTerrainOf(DEEP)).toBe('deepWater');
    expect(baseTerrainOf(SHALLOW)).toBe('shallowWater');
    expect(baseTerrainOf(SAND)).toBe('sand');
    expect(baseTerrainOf(GRASS)).toBe('grass');
    expect(baseTerrainOf(ROCK)).toBe('rock');
  });

  it('maps forest onto grass and mountain onto rock', () => {
    expect(baseTerrainOf(FOREST)).toBe('grass');
    expect(baseTerrainOf(MOUNTAIN)).toBe('rock');
  });
});

describe('priorityOf', () => {
  it('orders water below sand below grass below rock', () => {
    expect(priorityOf(DEEP)).toBeLessThan(priorityOf(SHALLOW));
    expect(priorityOf(SHALLOW)).toBeLessThan(priorityOf(SAND));
    expect(priorityOf(SAND)).toBeLessThan(priorityOf(GRASS));
    expect(priorityOf(GRASS)).toBeLessThan(priorityOf(ROCK));
  });

  it('gives forest grass priority and mountain rock priority', () => {
    expect(priorityOf(FOREST)).toBe(priorityOf(GRASS));
    expect(priorityOf(MOUNTAIN)).toBe(priorityOf(ROCK));
  });
});

describe('variantIndex', () => {
  it('stays within 0..3', () => {
    for (let x = 0; x < 30; x += 1) {
      for (let y = 0; y < 30; y += 1) {
        const index = variantIndex(x, y);
        expect(index).toBeGreaterThanOrEqual(0);
        expect(index).toBeLessThan(4);
      }
    }
  });

  it('is stable for a coordinate', () => {
    expect(variantIndex(9, 4)).toBe(variantIndex(9, 4));
  });

  it('uses more than one variant across a region', () => {
    const seen = new Set<number>();
    for (let x = 0; x < 20; x += 1) for (let y = 0; y < 20; y += 1) seen.add(variantIndex(x, y));
    expect(seen.size).toBe(4);
  });
});

describe('planTile', () => {
  it('names the base cell from the terrain and variant', () => {
    const g = grid([[GRASS]]);
    const plan = planTile(g.tiles, g.width, g.height, 0, 0);
    expect(plan.base).toBe(`terrain.grass.${variantIndex(0, 0)}`);
  });

  it('adds no fringes on a uniform grid', () => {
    const g = grid([
      [SAND, SAND, SAND],
      [SAND, SAND, SAND],
      [SAND, SAND, SAND],
    ]);
    expect(planTile(g.tiles, g.width, g.height, 1, 1).fringes).toEqual([]);
  });

  it('fringes the higher neighbour onto the lower tile', () => {
    const g = grid([
      [GRASS, GRASS, GRASS],
      [SAND, SAND, SAND],
      [SAND, SAND, SAND],
    ]);
    expect(planTile(g.tiles, g.width, g.height, 1, 1).fringes).toContain('fringe.grass.n');
  });

  it('never fringes a lower neighbour onto a higher tile', () => {
    const g = grid([
      [GRASS, GRASS, GRASS],
      [SAND, SAND, SAND],
      [SAND, SAND, SAND],
    ]);
    expect(planTile(g.tiles, g.width, g.height, 1, 0).fringes).toEqual([]);
  });

  it('uses an outer corner where two adjacent sides are higher', () => {
    const g = grid([
      [GRASS, GRASS, SAND],
      [GRASS, SAND, SAND],
      [SAND, SAND, SAND],
    ]);
    expect(planTile(g.tiles, g.width, g.height, 1, 1).fringes).toContain('fringe.grass.nwOut');
  });

  it('uses an inner corner where only the diagonal is higher', () => {
    const g = grid([
      [GRASS, SAND, SAND],
      [SAND, SAND, SAND],
      [SAND, SAND, SAND],
    ]);
    const plan = planTile(g.tiles, g.width, g.height, 1, 1);
    expect(plan.fringes).toContain('fringe.grass.nwIn');
    expect(plan.fringes).not.toContain('fringe.grass.nwOut');
  });

  it('treats forest as grass when fringing', () => {
    const g = grid([
      [FOREST, FOREST, FOREST],
      [SAND, SAND, SAND],
      [SAND, SAND, SAND],
    ]);
    expect(planTile(g.tiles, g.width, g.height, 1, 1).fringes).toContain('fringe.grass.n');
  });

  it('does not fringe against out-of-bounds neighbours', () => {
    const g = grid([
      [SAND, SAND],
      [SAND, SAND],
    ]);
    expect(planTile(g.tiles, g.width, g.height, 0, 0).fringes).toEqual([]);
  });

  it('orders fringes deterministically when two terrains meet', () => {
    const g = grid([
      [GRASS, GRASS, GRASS],
      [SHALLOW, SAND, ROCK],
      [SAND, SAND, SAND],
    ]);
    const first = planTile(g.tiles, g.width, g.height, 1, 1).fringes;
    const second = planTile(g.tiles, g.width, g.height, 1, 1).fringes;
    expect(first).toEqual(second);
    expect(first.length).toBeGreaterThan(1);
  });
});

describe('shorelineTiles', () => {
  const terrain = (rows: number[][]) => ({
    ...grid(rows),
    tileSize: 32,
  });

  it('finds water tiles that touch land', () => {
    const found = shorelineTiles(terrain([
      [DEEP, SHALLOW, SAND],
      [DEEP, SHALLOW, SAND],
      [DEEP, SHALLOW, SAND],
    ]));
    expect(found.some((tile) => tile.x === 1 && tile.y === 1)).toBe(true);
  });

  it('records the edge facing the land', () => {
    const found = shorelineTiles(terrain([
      [DEEP, DEEP, DEEP],
      [DEEP, SHALLOW, DEEP],
      [DEEP, SAND, DEEP],
    ]));
    const tile = found.find((candidate) => candidate.x === 1 && candidate.y === 1);
    expect(tile?.edges).toContain('foam.s');
  });

  it('ignores land tiles entirely', () => {
    const found = shorelineTiles(terrain([
      [SAND, GRASS],
      [SAND, GRASS],
    ]));
    expect(found).toEqual([]);
  });

  it('ignores open water with no land nearby', () => {
    const found = shorelineTiles(terrain([
      [DEEP, DEEP],
      [DEEP, DEEP],
    ]));
    expect(found).toEqual([]);
  });

  it('adds an outer corner where two sides face land', () => {
    const found = shorelineTiles(terrain([
      [DEEP, SAND, DEEP],
      [SAND, SHALLOW, DEEP],
      [DEEP, DEEP, DEEP],
    ]));
    const tile = found.find((candidate) => candidate.x === 1 && candidate.y === 1);
    expect(tile?.edges).toContain('foam.nwOut');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/render/tilemap.test.ts`
Expected: FAIL — cannot resolve `./tilemap`.

- [ ] **Step 3: Write the implementation**

Create `src/render/tilemap.ts`:

```ts
import type { TerrainSnapshot } from '../state/types';
import type { Atlas } from './atlas';
import { ART_SCALE, drawCell } from './atlas';

export type BaseTerrainName = 'deepWater' | 'shallowWater' | 'sand' | 'grass' | 'rock';

/** Terrain enum from the Rust side: 0 Deep, 1 Shallow, 2 Sand, 3 Grass, 4 Forest, 5 Rock, 6 Mountain. */
const BASE_BY_TERRAIN: BaseTerrainName[] = [
  'deepWater',
  'shallowWater',
  'sand',
  'grass',
  'grass', // Forest draws on grass; the trees are a separate standing prop.
  'rock',
  'rock', // Mountain draws on rock; the peak is a separate standing prop.
];

const PRIORITY: Record<BaseTerrainName, number> = {
  deepWater: 0,
  shallowWater: 1,
  sand: 2,
  grass: 3,
  rock: 4,
};

const VARIANT_COUNT = 4;

export function baseTerrainOf(terrain: number): BaseTerrainName {
  return BASE_BY_TERRAIN[terrain] ?? 'grass';
}

export function priorityOf(terrain: number): number {
  return PRIORITY[baseTerrainOf(terrain)];
}

/**
 * Deterministic hash for variant selection. Intentionally a local copy rather
 * than an import from `tools/genart/hash.ts`: `tools/` and `src/` compile under
 * different tsconfigs. The two copies need not agree — the generator never picks
 * variants, it only emits all four — this one just has to be stable so a tile
 * looks the same on every load and after a save/load round trip.
 */
function hash01(x: number, y: number, salt: number): number {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(salt | 0, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export function variantIndex(x: number, y: number): number {
  return Math.floor(hash01(x, y, 1) * VARIANT_COUNT) % VARIANT_COUNT;
}

const SIDES = [
  { edge: 'n', dx: 0, dy: -1 },
  { edge: 'e', dx: 1, dy: 0 },
  { edge: 's', dx: 0, dy: 1 },
  { edge: 'w', dx: -1, dy: 0 },
] as const;

const CORNERS = [
  { name: 'nw', dx: -1, dy: -1, a: 'n', b: 'w' },
  { name: 'ne', dx: 1, dy: -1, a: 'n', b: 'e' },
  { name: 'se', dx: 1, dy: 1, a: 's', b: 'e' },
  { name: 'sw', dx: -1, dy: 1, a: 's', b: 'w' },
] as const;

export interface TilePlan {
  base: string;
  fringes: string[];
}

/** Plan one tile: its base cell plus every fringe a higher neighbour casts onto it. */
export function planTile(
  tiles: ArrayLike<number>,
  width: number,
  height: number,
  x: number,
  y: number,
): TilePlan {
  const self = tiles[y * width + x];
  const selfPriority = priorityOf(self);

  // Out-of-bounds neighbours read as "same as self" so map borders stay clean.
  const at = (nx: number, ny: number): number =>
    nx < 0 || ny < 0 || nx >= width || ny >= height ? self : tiles[ny * width + nx];

  const higherSides = new Map<string, Set<string>>();
  const add = (terrain: BaseTerrainName, edge: string) => {
    const set = higherSides.get(terrain) ?? new Set<string>();
    set.add(edge);
    higherSides.set(terrain, set);
  };

  for (const side of SIDES) {
    const neighbour = at(x + side.dx, y + side.dy);
    if (priorityOf(neighbour) > selfPriority) add(baseTerrainOf(neighbour), side.edge);
  }

  for (const corner of CORNERS) {
    const neighbour = at(x + corner.dx, y + corner.dy);
    if (priorityOf(neighbour) <= selfPriority) continue;
    const terrain = baseTerrainOf(neighbour);
    const sides = higherSides.get(terrain);
    const hasA = sides?.has(corner.a) ?? false;
    const hasB = sides?.has(corner.b) ?? false;
    // Both adjacent sides higher: the terrain wraps, so fill the corner generously.
    // Only the diagonal higher: a small nub.
    if (hasA && hasB) add(terrain, `${corner.name}Out`);
    else if (!hasA && !hasB) add(terrain, `${corner.name}In`);
  }

  const fringes: string[] = [];
  const terrains = [...higherSides.keys()].sort((a, b) => PRIORITY[a] - PRIORITY[b]);
  for (const terrain of terrains) {
    for (const edge of [...higherSides.get(terrain)!].sort()) {
      fringes.push(`fringe.${terrain}.${edge}`);
    }
  }

  return { base: `terrain.${baseTerrainOf(self)}.${variantIndex(x, y)}`, fringes };
}

export interface ShorelineTile {
  x: number;
  y: number;
  edges: string[];
}

function isWater(terrain: number): boolean {
  const base = baseTerrainOf(terrain);
  return base === 'deepWater' || base === 'shallowWater';
}

/** Water tiles touching land, with the foam edges that face it. Recomputed on dirty tiles. */
export function shorelineTiles(terrain: TerrainSnapshot): ShorelineTile[] {
  const { tiles, width, height } = terrain;
  const out: ShorelineTile[] = [];

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const self = tiles[y * width + x];
      if (!isWater(self)) continue;

      const at = (nx: number, ny: number): number =>
        nx < 0 || ny < 0 || nx >= width || ny >= height ? self : tiles[ny * width + nx];

      const landSides = new Set<string>();
      for (const side of SIDES) {
        if (!isWater(at(x + side.dx, y + side.dy))) landSides.add(side.edge);
      }

      const edges = [...landSides].sort().map((edge) => `foam.${edge}`);
      for (const corner of CORNERS) {
        if (landSides.has(corner.a) && landSides.has(corner.b)) {
          edges.push(`foam.${corner.name}Out`);
        }
      }

      if (edges.length > 0) out.push({ x, y, edges });
    }
  }

  return out;
}

/**
 * Paint the whole terrain into the offscreen world canvas.
 * Foam is deliberately absent: it animates, so the entity layer draws it per frame.
 */
export function bakeTerrain(
  ctx: CanvasRenderingContext2D,
  atlas: Atlas,
  terrain: TerrainSnapshot,
): void {
  const { tiles, width, height, tileSize } = terrain;
  ctx.imageSmoothingEnabled = false;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const plan = planTile(tiles, width, height, x, y);
      const dx = x * tileSize;
      const dy = y * tileSize;
      drawCell(ctx, atlas, plan.base, dx, dy, 0, ART_SCALE);
      for (const fringe of plan.fringes) drawCell(ctx, atlas, fringe, dx, dy, 0, ART_SCALE);
    }
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/render/tilemap.test.ts`
Expected: PASS, 21 tests.

- [ ] **Step 5: Commit**

```bash
git add src/render/tilemap.ts src/render/tilemap.test.ts
git commit -m "feat(render): add tile planning, fringes and shoreline detection"
```

---

### Task 11: Wire the tilemap into the canvas

**Files:**
- Modify: `src/render/Canvas.tsx`

**Interfaces:**
- Consumes: `loadAtlas`, `drawCell`, `ART_SCALE` from `./atlas`; `bakeTerrain`, `shorelineTiles` from `./tilemap`; `drawTerrain` from `./drawTerrain` (fallback).
- Produces: `render_game_to_text()` gains `art: { loaded: boolean; cells: number }`.

Foam animates at one frame per 8 ticks. It is viewport-culled with a one-tile margin, and frozen at frame 0 when the user prefers reduced motion.

- [ ] **Step 1: Add the imports and the per-effect state**

In `src/render/Canvas.tsx`, add to the import block after line 8:

```ts
import type { Atlas } from './atlas';
import { ART_SCALE, drawCell, loadAtlas } from './atlas';
import type { ShorelineTile } from './tilemap';
import { bakeTerrain, shorelineTiles } from './tilemap';
```

Add the animation constant next to `TICK_MS` (line 10):

```ts
const FOAM_TICKS_PER_FRAME = 8;
const FOAM_FRAMES = 3;
```

Declare the new locals inside the main `useEffect`, next to `let terrainLayer` (line 126):

```ts
let atlas: Atlas | null = null;
let shoreline: ShorelineTile[] = [];
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
```

- [ ] **Step 2: Bake through the atlas, falling back to flat color**

Replace the terrain setup inside `initialize` (currently `drawTerrain(terrainContext, terrain);` on line 297) with:

```ts
        atlas = await loadAtlas();
        if (cancelled) return;
        if (atlas) {
          bakeTerrain(terrainContext, atlas, terrain);
          shoreline = shorelineTiles(terrain);
        } else {
          drawTerrain(terrainContext, terrain);
        }
```

Leave the `drawTerrain` import in place — it is the fallback, not dead code.

- [ ] **Step 3: Draw the animated foam**

In `draw`, immediately after `ctx.drawImage(terrainLayer, 0, 0);` (line 237), insert:

```ts
      if (atlas && shoreline.length > 0) {
        const frame = reduceMotion
          ? 0
          : Math.floor(tickRef.current / FOAM_TICKS_PER_FRAME) % FOAM_FRAMES;
        const view = camera.visibleWorldRect(viewWidth, viewHeight);
        const minX = Math.floor(view.x / terrain.tileSize) - 1;
        const minY = Math.floor(view.y / terrain.tileSize) - 1;
        const maxX = Math.ceil((view.x + view.w) / terrain.tileSize) + 1;
        const maxY = Math.ceil((view.y + view.h) / terrain.tileSize) + 1;
        for (const tile of shoreline) {
          if (tile.x < minX || tile.x > maxX || tile.y < minY || tile.y > maxY) continue;
          const dx = tile.x * terrain.tileSize;
          const dy = tile.y * terrain.tileSize;
          for (const edge of tile.edges) drawCell(ctx, atlas, edge, dx, dy, frame, ART_SCALE);
        }
      }
```

- [ ] **Step 4: Report art state to the test hook**

In `window.render_game_to_text`, add to the returned object after the `terrain` field (line 329):

```ts
        art: {
          loaded: atlas != null,
          cells: atlas ? Object.keys(atlas.manifest.cells).length : 0,
        },
```

- [ ] **Step 5: Verify the whole suite and the build**

Run: `npm test && npm run build`
Expected: all tests PASS; `tsc -b` reports no errors.

- [ ] **Step 6: Verify it visually in the browser demo**

```bash
npm run dev
```

Open `http://127.0.0.1:5173/`. Confirm by eye:
- The island is textured rather than flat — grass, sand and rock show speckle.
- Boundaries between terrains are irregular, not straight tile edges.
- The coastline shimmers continuously.
- Buildings, crops and villagers still draw as flat shapes. **That is correct for Phase 1.**
- Panning and zooming stay smooth.

Then confirm the fallback path: temporarily rename `public/art/atlas.json`, reload, and check the map renders in flat colors with no console errors. Restore the file afterwards.

```bash
mv public/art/atlas.json public/art/atlas.json.bak
# reload the browser, confirm flat-color terrain
mv public/art/atlas.json.bak public/art/atlas.json
```

- [ ] **Step 7: Commit**

```bash
git add src/render/Canvas.tsx
git commit -m "feat(render): bake terrain from the atlas with animated shoreline"
```

---

### Task 12: Document the art pipeline

**Files:**
- Modify: `README.md`, `AGENTS.md`, `progress.md`

- [ ] **Step 1: Document the generator in the README**

Add to `README.md` after the "Checks" section:

````markdown
### Art

World and UI art is generated, not hand-drawn as binary assets. Sprite sources live in
`tools/genart/` as declarative pixel data and material recipes; the generator rasterizes
them into sprite sheets:

```bash
npm run art     # regenerate public/art/ from tools/genart/
```

`public/art/tiles.png` and `public/art/atlas.json` are **committed**, so `npm run dev`
works without ever running the generator. A test regenerates the atlas and compares it
to the committed output, so art and source cannot drift apart. If the atlas fails to
load at runtime, the renderer falls back to flat-color drawing and the game stays playable.
````

- [ ] **Step 2: Add the gotchas to AGENTS.md**

Add to the "Non-obvious gotchas" section of `AGENTS.md`:

```markdown
- Art is generated by `npm run art` from `tools/genart/` and **committed** to `public/art/`.
  After changing anything under `tools/genart/`, re-run `npm run art` or `tools/genart/genart.test.ts`
  will fail. The drift test compares decoded pixels, not raw PNG bytes, because `zlib` output
  varies with the Node version.
- Only the 29 colors in `tools/genart/palette.ts` may appear in art; the rasterizer throws otherwise.
- Vitest runs in a **Node** environment — no jsdom is installed. Tests must not touch `document`,
  `window`, `Image` or canvas contexts. Keep pure logic (`planTile`, `cellRect`) separate from
  painters (`bakeTerrain`, `drawCell`) so it stays testable.
- Native art is 16px against a 32px world tile, so everything draws at exactly 2x (`ART_SCALE`).
```

- [ ] **Step 3: Update the progress table**

Add a row to the status table in `progress.md`:

```markdown
| Art — Phase 1 (pipeline + terrain) | Complete | — |
```

And update the "Next up" section to read:

```markdown
## Next up

Finish Milestone 10: autosave rotation, weather, event log, and camera/interaction polish.
Art Phase 2 (entities: buildings, crops, villagers, y-sorting) and Phase 3 (pixel HUD) are
specced in `docs/superpowers/specs/2026-07-31-pixel-art-ui-redesign-design.md`.
```

- [ ] **Step 4: Verify nothing regressed**

Run: `npm test && npm run build`
Expected: all tests PASS; no type errors.

- [ ] **Step 5: Commit**

```bash
git add README.md AGENTS.md progress.md
git commit -m "docs: document the art generation pipeline"
```

---

## Definition of done

- [ ] `npm test` passes, including all new generator, atlas and tilemap tests.
- [ ] `npm run build` typechecks both `src` and `tools` with no errors.
- [ ] `npm run art` regenerates `public/art/` and leaves the working tree clean.
- [ ] `npm run dev` shows a textured island with irregular terrain boundaries and an animated shoreline.
- [ ] Renaming `public/art/atlas.json` degrades to flat-color terrain with no console errors.
- [ ] Entities still draw as flat shapes — Phase 2 has not started.
