import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DEBUG_MISSING, THEME } from './palette';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..');
const THEME_DIR = join(SRC, 'theme');

/** Hex values allowed outside the palette. */
const WHITELIST = new Set([DEBUG_MISSING]);
const ALLOWED_HEX = new Set<string>([...Object.values(THEME), ...WHITELIST].map((hex) => hex.toLowerCase()));
const ALLOWED_RGB = new Set(
  [...ALLOWED_HEX].map((hex) =>
    [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16)).join(','),
  ),
);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return path === THEME_DIR ? [] : sourceFiles(path);
    if (!/\.(ts|tsx|css)$/.test(name) || /\.test\.tsx?$/.test(name)) return [];
    return [path];
  });
}

function expandHex(digits: string): string {
  const d = digits.toLowerCase();
  return d.length === 3 ? `#${d[0]}${d[0]}${d[1]}${d[1]}${d[2]}${d[2]}` : `#${d}`;
}

// `#rrggbb` / `#rgb`, also URL-encoded as `%23` inside data: URIs. Not after `&` (HTML entities).
const HEX = /(?<!&)(?:#|%23)([0-9a-fA-F]{6}|[0-9a-fA-F]{3})(?![0-9a-zA-Z_])/g;
const RGB = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/g;

/** Off-palette colour literals in `text`, as `line: literal`. */
export function offPaletteColors(text: string): string[] {
  const found: string[] = [];
  text.split('\n').forEach((line, index) => {
    for (const match of line.matchAll(HEX)) {
      if (!ALLOWED_HEX.has(expandHex(match[1]))) found.push(`${index + 1}: ${match[0]}`);
    }
    for (const match of line.matchAll(RGB)) {
      const key = [match[1], match[2], match[3]].map(Number).join(',');
      if (!ALLOWED_RGB.has(key)) found.push(`${index + 1}: ${match[0]}`);
    }
  });
  return found;
}

describe('off-palette guard', () => {
  it('finds no off-palette colour literals in src', () => {
    const violations = sourceFiles(SRC).flatMap((file) =>
      offPaletteColors(readFileSync(file, 'utf8')).map((hit) => `${relative(SRC, file)}:${hit}`),
    );
    expect(violations).toEqual([]);
  });

  it('flags off-palette hex and rgb literals', () => {
    expect(offPaletteColors("ctx.fillStyle = '#123456';")).toEqual(["1: #123456"]);
    expect(offPaletteColors('color: #abc;')).toEqual(['1: #abc']);
    expect(offPaletteColors("fill: 'rgba(80, 200, 120, 0.35)'")).toEqual(['1: rgba(80, 200, 120']);
    expect(offPaletteColors("flood-color='%23123456'")).toEqual(['1: %23123456']);
  });

  it('accepts palette members, the whitelist and non-colour hashes', () => {
    expect(offPaletteColors(`'${THEME.highlight}' '${THEME.uiBg.toUpperCase()}' '${DEBUG_MISSING}'`)).toEqual([]);
    expect(offPaletteColors('rgba(23, 33, 27, 0.5) #root &#123; `#${id}`')).toEqual([]);
  });
});
