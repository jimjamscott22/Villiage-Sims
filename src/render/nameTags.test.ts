import { describe, expect, it } from 'vitest';
import { Camera } from './camera';
import { MIN_TAG_ZOOM, nameTagPlacements, staggerTag } from './nameTags';

describe('nameTagPlacements', () => {
  const labels = new Map([
    [1, 'Ada'],
    [2, 'Bram'],
    [3, 'Cato'],
  ]);

  it('anchors tags just below each villager in screen space', () => {
    const camera = new Camera(0, 0, 2);
    const tags = nameTagPlacements([{ id: 1, x: 50, y: 40 }], labels, camera, 800, 600, null);
    expect(tags).toEqual([{ id: 1, text: 'Ada', sx: 100, sy: 94, selected: false }]);
  });

  it('skips unlabelled and far off-screen villagers', () => {
    const camera = new Camera(0, 0, 1);
    const tags = nameTagPlacements(
      [
        { id: 1, x: 10, y: 10 },
        { id: 9, x: 20, y: 20 },
        { id: 2, x: 5000, y: 10 },
      ],
      labels,
      camera,
      800,
      600,
      null,
    );
    expect(tags.map((tag) => tag.id)).toEqual([1]);
  });

  it('keeps only the selected tag when zoomed far out, and paints it last', () => {
    const villagers = [
      { id: 1, x: 10, y: 10 },
      { id: 2, x: 12, y: 10 },
      { id: 3, x: 14, y: 10 },
    ];
    const far = nameTagPlacements(villagers, labels, new Camera(0, 0, MIN_TAG_ZOOM / 2), 800, 600, 2);
    expect(far.map((tag) => tag.id)).toEqual([2]);
    const near = nameTagPlacements(villagers, labels, new Camera(0, 0, 1), 800, 600, 2);
    expect(near.map((tag) => tag.id)).toEqual([1, 3, 2]);
    expect(near[2].selected).toBe(true);
  });
});

describe('staggerTag', () => {
  const rect = { left: 0, top: 0, width: 40, height: 14 };

  it('leaves a non-overlapping tag in place', () => {
    expect(staggerTag(rect, [{ left: 50, top: 0, width: 40, height: 14 }])).toEqual(rect);
  });

  it('pushes an overlapping tag down below its neighbour', () => {
    expect(staggerTag(rect, [{ left: 20, top: 0, width: 40, height: 14 }]).top).toBe(15);
  });

  it('stops after a bounded number of rows', () => {
    const stack = Array.from({ length: 10 }, (_, i) => ({ left: 0, top: i * 15, width: 40, height: 14 }));
    expect(staggerTag(rect, stack).top).toBe(45);
  });
});
