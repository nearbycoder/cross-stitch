export const EMPTY = 0xffff;

export type DitherMode = "none" | "floyd-steinberg" | "atkinson" | "ordered";
export type ColorMetric = "ciede2000" | "cie76";

export interface Crop {
  x: number; // normalized 0..1
  y: number;
  w: number;
  h: number;
}

export interface PatternSettings {
  width: number; // stitches
  height: number; // stitches
  lockAspect: boolean;
  maxColors: number;
  fabricCount: number; // stitches per inch
  strands: number;
  fabricColor: string; // hex
  dither: DitherMode;
  ditherStrength: number; // 0..1
  metric: ColorMetric;
  brightness: number; // -100..100
  contrast: number; // -100..100
  saturation: number; // -100..100
  sharpen: number; // 0..100
  confetti: number; // 0..3 cleanup passes for isolated stitches
  minStitches: number; // colors with fewer stitches are merged away
  stashOnly: boolean; // restrict to floss the user owns
  transparentAsEmpty: boolean;
  crop: Crop;
}

export interface PaletteEntry {
  code: string;
  name: string;
  r: number;
  g: number;
  b: number;
  symbol: string;
}

export interface Pattern {
  width: number;
  height: number;
  palette: PaletteEntry[];
  cells: Uint16Array; // palette index per cell, EMPTY = unstitched fabric
}

export interface StoredPattern {
  width: number;
  height: number;
  palette: PaletteEntry[];
  cells: string; // base64 Uint16Array
}

export interface Project {
  id: string;
  ownerId: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  source: string; // data URL (downscaled)
  sourceWidth: number;
  sourceHeight: number;
  thumbnail: string;
  settings: PatternSettings;
  pattern: StoredPattern | null;
  stitched: string; // base64 bitset
  edited: boolean; // manual edits since last generation
  notes: string;
}

export interface User {
  id: string;
  username: string;
  displayName: string;
  salt: string;
  passwordHash: string;
  createdAt: number;
  stash: string[]; // DMC codes owned
  prefs: UserPrefs;
}

export interface UserPrefs {
  defaultFabricCount: number;
  defaultMaxColors: number;
  defaultWidth: number;
  units: "in" | "cm";
}

export const DEFAULT_PREFS: UserPrefs = {
  defaultFabricCount: 14,
  defaultMaxColors: 30,
  defaultWidth: 120,
  units: "in",
};

export const FABRIC_COLORS: { name: string; hex: string }[] = [
  { name: "White Aida", hex: "#fbfaf6" },
  { name: "Antique White", hex: "#f3ead8" },
  { name: "Ecru", hex: "#e8dcc0" },
  { name: "Light Blue", hex: "#d6e4ee" },
  { name: "Light Pink", hex: "#f4dde0" },
  { name: "Sage", hex: "#c9d3bd" },
  { name: "Grey", hex: "#a9aaa8" },
  { name: "Navy", hex: "#1f2a44" },
  { name: "Black", hex: "#1a1a1a" },
];

export const FABRIC_COUNTS = [11, 14, 16, 18, 20, 22, 25, 28, 32];
