import type { Pattern, StoredPattern } from "./types";

export function bytesToBase64(bytes: Uint8Array): string {
  let out = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    out += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(out);
}

export function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function encodePattern(p: Pattern): StoredPattern {
  return {
    width: p.width,
    height: p.height,
    palette: p.palette,
    cells: bytesToBase64(new Uint8Array(p.cells.buffer, p.cells.byteOffset, p.cells.byteLength)),
  };
}

export function decodePattern(s: StoredPattern): Pattern {
  const bytes = base64ToBytes(s.cells);
  const cells = new Uint16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 2);
  return { width: s.width, height: s.height, palette: s.palette, cells: new Uint16Array(cells) };
}

export function encodeBits(bits: Uint8Array): string {
  return bytesToBase64(bits);
}

export function decodeBits(b64: string, cellCount: number): Uint8Array {
  const size = Math.ceil(cellCount / 8);
  if (!b64) return new Uint8Array(size);
  const bytes = base64ToBytes(b64);
  if (bytes.length !== size) return new Uint8Array(size);
  return bytes;
}

export const getBit = (bits: Uint8Array, i: number) => (bits[i >> 3] >> (i & 7)) & 1;
export const setBit = (bits: Uint8Array, i: number, on: boolean) => {
  if (on) bits[i >> 3] |= 1 << (i & 7);
  else bits[i >> 3] &= ~(1 << (i & 7));
};
