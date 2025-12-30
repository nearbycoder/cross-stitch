import type { RGBColor } from './color';

export interface DMCThread {
  code: string;
  name: string;
  rgb: RGBColor;
  hex: string;
  symbol?: string;
}

export interface DMCColorData {
  code: string;
  name: string;
  hex: string;
  rgb: RGBColor;
}
