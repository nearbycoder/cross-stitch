/**
 * Symbol library for cross stitch patterns
 * These symbols should be visually distinct from each other
 */

// Basic shapes (1-10 colors)
export const BASIC_SYMBOLS = [
  '●', // Filled circle
  '■', // Filled square
  '▲', // Filled triangle
  '♦', // Filled diamond
  '★', // Filled star
  '+', // Plus
  '×', // Cross
  '○', // Empty circle
  '□', // Empty square
  '△', // Empty triangle
];

// Uppercase letters (11-36 colors)
export const LETTER_SYMBOLS = [
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J',
  'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T',
  'U', 'V', 'W', 'X', 'Y', 'Z',
];

// Numbers (37-46 colors)
export const NUMBER_SYMBOLS = [
  '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
];

// Additional symbols for very large palettes (47+ colors)
export const EXTENDED_SYMBOLS = [
  '◆', // Diamond outline
  '▼', // Down triangle
  '◀', // Left triangle
  '▶', // Right triangle
  '☆', // Star outline
  '⬟', // Hexagon
  '◯', // Large circle
  '▪', // Small square
  '▴', // Small triangle
  '⬢', // Hexagon outline
  '⊕', // Circled plus
  '⊗', // Circled times
  '⊙', // Circled dot
  '◐', // Half-filled circle
  '◑', // Half-filled circle (other)
];

/**
 * Get all available symbols in order of preference
 */
export function getAllSymbols(): string[] {
  return [
    ...BASIC_SYMBOLS,
    ...LETTER_SYMBOLS,
    ...NUMBER_SYMBOLS,
    ...EXTENDED_SYMBOLS,
  ];
}

/**
 * Get the total number of available symbols
 */
export function getSymbolCount(): number {
  return getAllSymbols().length;
}
