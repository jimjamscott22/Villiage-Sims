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
