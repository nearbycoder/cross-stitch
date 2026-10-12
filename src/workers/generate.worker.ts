import { generatePattern, type GenerateInput } from "../lib/generate";

self.onmessage = (e: MessageEvent<{ id: number; input: GenerateInput }>) => {
  const { id, input } = e.data;
  try {
    let last = 0;
    const result = generatePattern(input, (stage, pct) => {
      const now = performance.now();
      if (now - last > 60 || pct >= 1) {
        last = now;
        self.postMessage({ id, type: "progress", stage, pct });
      }
    });
    self.postMessage({ id, type: "done", result }, { transfer: [result.cells.buffer] });
  } catch (err) {
    self.postMessage({ id, type: "error", message: err instanceof Error ? err.message : String(err) });
  }
};
