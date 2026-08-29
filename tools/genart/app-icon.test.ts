import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const appIconPath = new URL('../../src-tauri/icons/icon.png', import.meta.url);

describe('Tauri app icon', () => {
  it('is an 8-bit RGBA PNG', () => {
    const png = readFileSync(appIconPath);

    expect(png.subarray(12, 16).toString('ascii')).toBe('IHDR');
    expect(png[24]).toBe(8);
    expect(png[25]).toBe(6);
  });
});
