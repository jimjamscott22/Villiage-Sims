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
