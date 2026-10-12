import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { drawRulers, renderRegion, type ViewMode } from "../lib/render";
import type { Pattern } from "../lib/types";

export type Tool = "pan" | "paint" | "fill" | "erase" | "pick" | "stitch";

export interface CanvasHandle {
  fit: () => void;
  zoomBy: (factor: number) => void;
  zoomTo: (scale: number) => void;
  getScale: () => number;
}

interface Props {
  pattern: Pattern;
  version: number; // bump to force redraw after in-place edits
  stitched: Uint8Array;
  mode: ViewMode;
  showGrid: boolean;
  showStitched: boolean;
  fabricColor: string;
  highlight: number | null;
  tool: Tool;
  onCellAction: (phase: "down" | "move" | "up", x: number, y: number, e: { shift: boolean; alt: boolean }) => void;
  onHover: (cell: { x: number; y: number } | null) => void;
  onScaleChange?: (scale: number) => void;
}

const RULER = 28;
const MIN_SCALE = 0.5;
const MAX_SCALE = 64;

const PatternCanvas = forwardRef<CanvasHandle, Props>(function PatternCanvas(props, ref) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const view = useRef({ scale: 8, tx: 0, ty: 0 });
  const size = useRef({ w: 0, h: 0 });
  const hover = useRef<{ x: number; y: number } | null>(null);
  const frame = useRef(0);
  const propsRef = useRef(props);
  propsRef.current = props;
  const [spaceDown, setSpaceDown] = useState(false);
  const [panning, setPanning] = useState(false);
  const fitted = useRef(false);

  const draw = useCallback(() => {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const p = propsRef.current;
      const { pattern } = p;
      const dpr = window.devicePixelRatio || 1;
      const { w, h } = size.current;
      const ctx = canvas.getContext("2d")!;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = "#e9e5de";
      ctx.fillRect(0, 0, w, h);

      const { scale: s, tx, ty } = view.current;
      const x0 = Math.max(0, Math.floor(-tx / s));
      const y0 = Math.max(0, Math.floor(-ty / s));
      const x1 = Math.min(pattern.width, Math.ceil((w - RULER - tx) / s));
      const y1 = Math.min(pattern.height, Math.ceil((h - RULER - ty) / s));
      const region = { x: x0, y: y0, w: Math.max(0, x1 - x0), h: Math.max(0, y1 - y0) };
      const ox = RULER + tx + x0 * s;
      const oy = RULER + ty + y0 * s;

      ctx.save();
      ctx.beginPath();
      ctx.rect(RULER, RULER, w - RULER, h - RULER);
      ctx.clip();
      // Drop shadow under the fabric
      ctx.fillStyle = "rgba(0,0,0,0.12)";
      ctx.fillRect(RULER + tx + 3, RULER + ty + 4, pattern.width * s, pattern.height * s);
      if (region.w > 0 && region.h > 0) {
        renderRegion(ctx, pattern, region, ox, oy, {
          mode: p.mode,
          cell: s,
          showGrid: p.showGrid,
          fabricColor: p.fabricColor,
          highlight: p.highlight,
          stitched: p.stitched,
          showStitched: p.showStitched,
        });
      }
      const hv = hover.current;
      if (hv && p.tool !== "pan") {
        ctx.strokeStyle = "#b4413a";
        ctx.lineWidth = 2;
        ctx.strokeRect(RULER + tx + hv.x * s + 1, RULER + ty + hv.y * s + 1, s - 2, s - 2);
      }
      ctx.restore();

      ctx.fillStyle = "#f6f3ee";
      ctx.fillRect(0, 0, w, RULER);
      ctx.fillRect(0, 0, RULER, h);
      if (region.w > 0 && region.h > 0) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(RULER, 0, w - RULER, RULER);
        ctx.rect(0, RULER, RULER, h - RULER);
        ctx.clip();
        drawRulers(ctx, pattern, region, ox, oy, s, RULER, { hover: hv, bandX: RULER, bandY: RULER });
        ctx.restore();
      }
      ctx.strokeStyle = "#d6d0c4";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, RULER - 0.5);
      ctx.lineTo(w, RULER - 0.5);
      ctx.moveTo(RULER - 0.5, 0);
      ctx.lineTo(RULER - 0.5, h);
      ctx.stroke();
    });
  }, []);

  const clampView = () => {
    const { pattern } = propsRef.current;
    const v = view.current;
    const { w, h } = size.current;
    const pw = pattern.width * v.scale;
    const ph = pattern.height * v.scale;
    const aw = w - RULER;
    const ah = h - RULER;
    const margin = 80;
    v.tx = pw < aw ? Math.min(Math.max(v.tx, -pw + margin), aw - margin) : Math.min(margin, Math.max(v.tx, aw - pw - margin));
    v.ty = ph < ah ? Math.min(Math.max(v.ty, -ph + margin), ah - margin) : Math.min(margin, Math.max(v.ty, ah - ph - margin));
  };

  const setScale = useCallback(
    (next: number, cx?: number, cy?: number) => {
      const v = view.current;
      const s = Math.min(MAX_SCALE, Math.max(MIN_SCALE, next));
      const ax = cx ?? (size.current.w - RULER) / 2;
      const ay = cy ?? (size.current.h - RULER) / 2;
      // Keep the cell under the anchor point fixed.
      v.tx = ax - ((ax - v.tx) * s) / v.scale;
      v.ty = ay - ((ay - v.ty) * s) / v.scale;
      v.scale = s;
      clampView();
      propsRef.current.onScaleChange?.(s);
      draw();
    },
    [draw],
  );

  const fit = useCallback(() => {
    const { pattern } = propsRef.current;
    const { w, h } = size.current;
    if (!w || !h) return;
    const aw = w - RULER - 32;
    const ah = h - RULER - 32;
    const s = Math.min(MAX_SCALE, Math.max(MIN_SCALE, Math.min(aw / pattern.width, ah / pattern.height)));
    view.current = {
      scale: s,
      tx: (w - RULER - pattern.width * s) / 2,
      ty: (h - RULER - pattern.height * s) / 2,
    };
    propsRef.current.onScaleChange?.(s);
    draw();
  }, [draw]);

  useImperativeHandle(
    ref,
    () => ({
      fit,
      zoomBy: (f) => setScale(view.current.scale * f),
      zoomTo: (s) => setScale(s),
      getScale: () => view.current.scale,
    }),
    [fit, setScale],
  );

  // Resize handling
  useEffect(() => {
    const wrap = wrapRef.current!;
    const ro = new ResizeObserver(() => {
      const r = wrap.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      size.current = { w: r.width, h: r.height };
      const c = canvasRef.current!;
      c.width = Math.round(r.width * dpr);
      c.height = Math.round(r.height * dpr);
      c.style.width = r.width + "px";
      c.style.height = r.height + "px";
      if (!fitted.current && r.width > 0) {
        fitted.current = true;
        fit();
      } else draw();
    });
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [draw, fit]);

  // Refit when dimensions change (new generation with a different size).
  const dims = `${props.pattern.width}x${props.pattern.height}`;
  useEffect(() => {
    if (fitted.current) fit();
  }, [dims, fit]);

  useEffect(() => {
    draw();
  }, [draw, props.pattern, props.version, props.mode, props.showGrid, props.showStitched, props.fabricColor, props.highlight, props.tool, props.stitched]);

  // Space to temporarily pan
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === "Space" && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        setSpaceDown(true);
      }
    };
    const up = (e: KeyboardEvent) => e.code === "Space" && setSpaceDown(false);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  // Wheel: zoom (Ctrl/pinch or mouse wheel); Shift+wheel or trackpad two-finger pans.
  useEffect(() => {
    const c = canvasRef.current!;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = c.getBoundingClientRect();
      const cx = e.clientX - r.left - RULER;
      const cy = e.clientY - r.top - RULER;
      const isPinch = e.ctrlKey || e.metaKey;
      const looksLikeTrackpadPan = !isPinch && e.deltaMode === 0 && (Math.abs(e.deltaX) > 0.5 || (Math.abs(e.deltaY) < 40 && !Number.isInteger(e.deltaY)));
      if (e.shiftKey || looksLikeTrackpadPan) {
        view.current.tx -= e.shiftKey && !e.deltaX ? e.deltaY : e.deltaX;
        view.current.ty -= e.shiftKey && !e.deltaX ? 0 : e.deltaY;
        clampView();
        draw();
        return;
      }
      const factor = Math.exp(-e.deltaY * (isPinch ? 0.01 : 0.0018));
      setScale(view.current.scale * factor, cx, cy);
    };
    c.addEventListener("wheel", onWheel, { passive: false });
    return () => c.removeEventListener("wheel", onWheel);
  }, [draw, setScale]);

  // Pointer interaction
  const drag = useRef<{ mode: "pan" | "tool"; lastX: number; lastY: number; lastCell: { x: number; y: number } | null } | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; scale: number } | null>(null);

  const cellAt = (clientX: number, clientY: number) => {
    const r = canvasRef.current!.getBoundingClientRect();
    const { scale, tx, ty } = view.current;
    const x = Math.floor((clientX - r.left - RULER - tx) / scale);
    const y = Math.floor((clientY - r.top - RULER - ty) / scale);
    const { pattern } = propsRef.current;
    if (x < 0 || y < 0 || x >= pattern.width || y >= pattern.height) return null;
    return { x, y };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    const c = canvasRef.current!;
    c.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      // Two-finger pinch zoom on touch screens
      const [a, b] = [...pointers.current.values()];
      pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), scale: view.current.scale };
      if (drag.current?.mode === "tool" && drag.current.lastCell) {
        propsRef.current.onCellAction("up", drag.current.lastCell.x, drag.current.lastCell.y, { shift: false, alt: false });
      }
      drag.current = { mode: "pan", lastX: (a.x + b.x) / 2, lastY: (a.y + b.y) / 2, lastCell: null };
      return;
    }
    const panMode = propsRef.current.tool === "pan" || spaceDown || e.button === 1 || e.button === 2;
    if (panMode) {
      drag.current = { mode: "pan", lastX: e.clientX, lastY: e.clientY, lastCell: null };
      setPanning(true);
      return;
    }
    if (e.button !== 0) return;
    const cell = cellAt(e.clientX, e.clientY);
    drag.current = { mode: "tool", lastX: e.clientX, lastY: e.clientY, lastCell: cell };
    if (cell) propsRef.current.onCellAction("down", cell.x, cell.y, { shift: e.shiftKey, alt: e.altKey });
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const d = drag.current;
    if (pinch.current && pointers.current.size === 2 && d) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      view.current.tx += mx - d.lastX;
      view.current.ty += my - d.lastY;
      d.lastX = mx;
      d.lastY = my;
      const r = canvasRef.current!.getBoundingClientRect();
      setScale((pinch.current.scale * dist) / pinch.current.dist, mx - r.left - RULER, my - r.top - RULER);
      return;
    }
    const cell = cellAt(e.clientX, e.clientY);
    const prev = hover.current;
    if (cell?.x !== prev?.x || cell?.y !== prev?.y) {
      hover.current = cell;
      propsRef.current.onHover(cell);
      draw();
    }
    if (!d) return;
    if (d.mode === "pan") {
      view.current.tx += e.clientX - d.lastX;
      view.current.ty += e.clientY - d.lastY;
      d.lastX = e.clientX;
      d.lastY = e.clientY;
      clampView();
      draw();
      return;
    }
    if (!cell) return;
    if (d.lastCell && cell.x === d.lastCell.x && cell.y === d.lastCell.y) return;
    // Interpolate so fast strokes don't skip cells.
    const from = d.lastCell ?? cell;
    for (const pt of line(from.x, from.y, cell.x, cell.y)) {
      if (d.lastCell && pt.x === from.x && pt.y === from.y) continue;
      propsRef.current.onCellAction("move", pt.x, pt.y, { shift: e.shiftKey, alt: e.altKey });
    }
    d.lastCell = cell;
  };

  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    const d = drag.current;
    if (d?.mode === "tool") {
      const cell = d.lastCell;
      propsRef.current.onCellAction("up", cell?.x ?? -1, cell?.y ?? -1, { shift: e.shiftKey, alt: e.altKey });
    }
    if (pointers.current.size === 0) {
      drag.current = null;
      setPanning(false);
    }
  };

  const cursor =
    panning ? "grabbing" : spaceDown || props.tool === "pan" ? "grab" : props.tool === "pick" ? "copy" : props.tool === "stitch" ? "cell" : "crosshair";

  return (
    <div ref={wrapRef} className="canvas-wrap">
      <canvas
        ref={canvasRef}
        style={{ cursor, touchAction: "none" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={() => {
          if (hover.current) {
            hover.current = null;
            propsRef.current.onHover(null);
            draw();
          }
        }}
        onContextMenu={(e) => e.preventDefault()}
      />
    </div>
  );
});

export default PatternCanvas;

function* line(x0: number, y0: number, x1: number, y1: number) {
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    yield { x: x0, y: y0 };
    if (x0 === x1 && y0 === y1) return;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y0 += sy;
    }
  }
}
