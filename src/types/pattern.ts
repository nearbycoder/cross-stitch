import type { DMCThread } from './dmc';

export interface PatternCell {
  x: number;
  y: number;
  color: DMCThread;
  symbol: string;
}

export interface Pattern {
  width: number;
  height: number;
  cells: PatternCell[][];
  palette: DMCThread[];
  metadata: PatternMetadata;
}

export interface PatternMetadata {
  originalWidth: number;
  originalHeight: number;
  colorCount: number;
  createdAt: Date;
}

export interface ProcessingSettings {
  maxColors: number;
  gridWidth: number;
  gridHeight: number;
  maintainAspectRatio: boolean;
  colorlessMode: boolean;
}

export interface RenderOptions {
  cellSize: number;
  showGrid: boolean;
  showSymbols: boolean;
  showColors: boolean;
  emphasizeEveryNthLine?: number;
}

export interface ExportOptions {
  cellSize?: number;
  includeColors?: boolean;
  includeSymbols?: boolean;
  includeLegend?: boolean;
}
