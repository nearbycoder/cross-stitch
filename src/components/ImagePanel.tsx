import { useRef } from "react";
import type { Crop, PatternSettings, Project } from "../lib/types";
import { Segmented, Slider } from "./ui";

const ASPECTS: { label: string; value: number | null }[] = [
  { label: "Free", value: null },
  { label: "Original", value: -1 },
  { label: "1:1", value: 1 },
  { label: "4:5", value: 4 / 5 },
  { label: "3:4", value: 3 / 4 },
  { label: "5:7", value: 5 / 7 },
  { label: "16:9", value: 16 / 9 },
];

export default function ImagePanel({
  project,
  update,
  onReplaceImage,
}: {
  project: Project;
  update: (patch: Partial<PatternSettings>) => void;
  onReplaceImage: (f: File) => void;
}) {
  const s = project.settings;
  const fileRef = useRef<HTMLInputElement>(null);
  const imgAspect = project.sourceWidth / project.sourceHeight;

  const applyAspect = (a: number | null) => {
    if (a === null) return;
    if (a === -1) return update({ crop: { x: 0, y: 0, w: 1, h: 1 } });
    // Largest centered crop with the requested aspect (in pixel space).
    let w = 1;
    let h = imgAspect / a;
    if (h > 1) {
      h = 1;
      w = a / imgAspect;
    }
    update({ crop: { x: (1 - w) / 2, y: (1 - h) / 2, w, h } });
  };

  return (
    <div className="panel-section">
      <h4>Crop</h4>
      <CropBox src={project.source} crop={s.crop} onChange={(crop) => update({ crop })} />
      <div className="chips">
        {ASPECTS.map((a) => (
          <button key={a.label} className="chip" onClick={() => applyAspect(a.value)}>
            {a.label}
          </button>
        ))}
      </div>
      <p className="muted tiny">Drag the box to move it, drag corners to resize.</p>

      <h4>Adjustments</h4>
      <Slider label="Brightness" value={s.brightness} min={-100} max={100} onChange={(v) => update({ brightness: v })} format={signed} />
      <Slider label="Contrast" value={s.contrast} min={-100} max={100} onChange={(v) => update({ contrast: v })} format={signed} />
      <Slider label="Saturation" value={s.saturation} min={-100} max={100} onChange={(v) => update({ saturation: v })} format={signed} />
      <Slider label="Sharpen" value={s.sharpen} min={0} max={100} onChange={(v) => update({ sharpen: v })} />
      <button
        className="btn ghost sm"
        onClick={() => update({ brightness: 0, contrast: 0, saturation: 0, sharpen: 0 })}
        disabled={!s.brightness && !s.contrast && !s.saturation && !s.sharpen}
      >
        Reset adjustments
      </button>

      <h4>Transparency</h4>
      <Segmented
        value={s.transparentAsEmpty ? "empty" : "white"}
        onChange={(v) => update({ transparentAsEmpty: v === "empty" })}
        options={[
          { value: "empty", label: "Leave unstitched" },
          { value: "white", label: "Treat as white" },
        ]}
      />

      <h4>Source image</h4>
      <p className="muted tiny">
        {project.sourceWidth} × {project.sourceHeight}px
      </p>
      <button className="btn sm" onClick={() => fileRef.current?.click()}>
        Replace image…
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) onReplaceImage(f);
        }}
      />
    </div>
  );
}

const signed = (v: number) => (v > 0 ? `+${v}` : String(v));

function CropBox({ src, crop, onChange }: { src: string; crop: Crop; onChange: (c: Crop) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ kind: string; sx: number; sy: number; start: Crop } | null>(null);

  const start = (kind: string) => (e: React.PointerEvent) => {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { kind, sx: e.clientX, sy: e.clientY, start: { ...crop } };
  };

  const move = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const dx = (e.clientX - d.sx) / r.width;
    const dy = (e.clientY - d.sy) / r.height;
    const c = { ...d.start };
    const min = 0.04;
    if (d.kind === "move") {
      c.x = clamp(c.x + dx, 0, 1 - c.w);
      c.y = clamp(c.y + dy, 0, 1 - c.h);
    } else {
      if (d.kind.includes("w")) {
        const nx = clamp(c.x + dx, 0, c.x + c.w - min);
        c.w += c.x - nx;
        c.x = nx;
      }
      if (d.kind.includes("e")) c.w = clamp(c.w + dx, min, 1 - c.x);
      if (d.kind.includes("n")) {
        const ny = clamp(c.y + dy, 0, c.y + c.h - min);
        c.h += c.y - ny;
        c.y = ny;
      }
      if (d.kind.includes("s")) c.h = clamp(c.h + dy, min, 1 - c.y);
    }
    onChange(c);
  };

  return (
    <div className="cropper" ref={ref} onPointerMove={move} onPointerUp={() => (drag.current = null)}>
      <img src={src} alt="Source" draggable={false} />
      <div
        className="crop-rect"
        style={{ left: `${crop.x * 100}%`, top: `${crop.y * 100}%`, width: `${crop.w * 100}%`, height: `${crop.h * 100}%` }}
        onPointerDown={start("move")}
      >
        {["nw", "ne", "sw", "se"].map((h) => (
          <span key={h} className={`handle ${h}`} onPointerDown={start(h)} />
        ))}
      </div>
    </div>
  );
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}
