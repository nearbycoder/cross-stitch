// Chart symbols, ordered so the most legible, distinct glyphs are assigned first.
export const SYMBOLS: string[] = [
  "■", "●", "▲", "◆", "★", "✚", "✖", "♥",
  "□", "○", "△", "◇", "☆", "♠", "♣", "♦",
  "▼", "◀", "▶", "◐", "◑", "◒", "◓", "⊕",
  "⊗", "⊙", "⊞", "⊠", "◎", "◉", "▣", "▤",
  "▥", "▦", "▧", "▨", "▩", "⬟", "⬢", "⬡",
  "A", "B", "C", "D", "E", "F", "G", "H",
  "J", "K", "L", "M", "N", "P", "R", "S",
  "T", "U", "V", "W", "X", "Y", "Z", "2",
  "3", "4", "5", "6", "7", "8", "9", "#",
  "%", "&", "@", "+", "=", "?", "!", "/",
  "\\", "<", ">", "~", "a", "b", "d", "e",
  "f", "g", "h", "k", "m", "n", "q", "r",
  "t", "w", "y", "Ω", "Σ", "Φ", "Ψ", "Δ",
  "Λ", "Π", "Θ", "Ξ", "λ", "μ", "π", "σ",
  "φ", "ψ", "β", "δ", "ε", "ζ", "η", "θ",
];

export const SYMBOL_FONT =
  '"DejaVu Sans", "Segoe UI Symbol", "Apple Symbols", "Arial Unicode MS", "Noto Sans Symbols 2", "Noto Sans", sans-serif';

export function nextFreeSymbol(used: Iterable<string>): string {
  const taken = new Set(used);
  for (const s of SYMBOLS) if (!taken.has(s)) return s;
  // Fallback for very large palettes: two-character codes.
  for (let i = 0; ; i++) {
    const s = String.fromCharCode(65 + (i % 26)) + String.fromCharCode(97 + Math.floor(i / 26));
    if (!taken.has(s)) return s;
  }
}
