import { describe, expect, it } from 'vitest';
import { findPath, terrainPassable } from './pathfind';

describe('findPath', () => {
  it('routes around a wall', () => {
    const wall = new Set(['2,0', '2,1', '2,2', '2,3']);
    const passable = (x: number, y: number) => !wall.has(`${x},${y}`);
    const path = findPath([0, 0], [4, 0], 5, 5, passable);
    expect(path).not.toBeNull();
    expect(path!.at(-1)).toEqual([4, 0]);
    expect(path!.some(([x, y]) => wall.has(`${x},${y}`))).toBe(false);
  });

  it('returns null when goal is enclosed', () => {
    const blocked = new Set(['1,0', '0,1', '1,1']);
    const passable = (x: number, y: number) => !blocked.has(`${x},${y}`);
    expect(findPath([0, 0], [2, 0], 3, 3, passable)).toBeNull();
  });

  it('forbids diagonal corner cutting', () => {
    const blocked = new Set(['0,0', '1,1']);
    const passable = (x: number, y: number) => !blocked.has(`${x},${y}`);
    expect(findPath([0, 1], [1, 0], 2, 2, passable)).toBeNull();
  });

  it('matches terrain passability', () => {
    expect(terrainPassable(0)).toBe(false);
    expect(terrainPassable(1)).toBe(false);
    expect(terrainPassable(2)).toBe(true);
    expect(terrainPassable(3)).toBe(true);
    expect(terrainPassable(4)).toBe(true);
    expect(terrainPassable(5)).toBe(false);
    expect(terrainPassable(6)).toBe(false);
  });
});
