import { recommendedStrands, fabricNeeded, finishedSize } from "../lib/stats";
import { FABRIC_COLORS, FABRIC_COUNTS, type PatternSettings, type Project, type User } from "../lib/types";
import { Field, Segmented, Slider } from "./ui";

const SIZE_PRESETS = [
  { label: "S", width: 60 },
  { label: "M", width: 100 },
  { label: "L", width: 150 },
  { label: "XL", width: 200 },
  { label: "XXL", width: 300 },
];

export default function SettingsPanel({
  project,
  user,
  update,
}: {
  project: Project;
  user: User;
  update: (patch: Partial<PatternSettings>) => void;
}) {
  const s = project.settings;
  const aspect = (s.crop.h * project.sourceHeight) / (s.crop.w * project.sourceWidth);
  const units = user.prefs.units;
  const fmt = (v: number) => (units === "cm" ? `${(v * 2.54).toFixed(1)}cm` : `${v.toFixed(1)}″`);
  const size = finishedSize(s.width, s.height, s.fabricCount);
  const cut = fabricNeeded(s.width, s.height, s.fabricCount);

  const setWidth = (w: number) => {
    w = clampInt(w, 10, 500);
    update(s.lockAspect ? { width: w, height: clampInt(Math.round(w * aspect), 10, 500) } : { width: w });
  };
  const setHeight = (h: number) => {
    h = clampInt(h, 10, 500);
    update(s.lockAspect ? { height: h, width: clampInt(Math.round(h / aspect), 10, 500) } : { height: h });
  };

  return (
    <div className="panel-section">
      <h4>Pattern size</h4>
      <div className="chips">
        {SIZE_PRESETS.map((p) => (
          <button key={p.label} className={"chip" + (s.width === p.width ? " on" : "")} onClick={() => setWidth(p.width)} title={`${p.width} stitches wide`}>
            {p.label}
          </button>
        ))}
      </div>
      <div className="row gap">
        <Field label="Width">
          <NumberInput value={s.width} onCommit={setWidth} />
        </Field>
        <button
          className={"lock" + (s.lockAspect ? " on" : "")}
          title={s.lockAspect ? "Aspect ratio locked" : "Aspect ratio unlocked"}
          onClick={() => {
            const lock = !s.lockAspect;
            update(lock ? { lockAspect: lock, height: clampInt(Math.round(s.width * aspect), 10, 500) } : { lockAspect: lock });
          }}
        >
          {s.lockAspect ? "🔒" : "🔓"}
        </button>
        <Field label="Height">
          <NumberInput value={s.height} onCommit={setHeight} />
        </Field>
      </div>
      <p className="muted tiny">
        {(s.width * s.height).toLocaleString()} squares · finished {fmt(size.w)} × {fmt(size.h)} · cut fabric {fmt(cut.w)} × {fmt(cut.h)}
      </p>

      <div className="row gap">
        <Field label="Fabric count">
          <select value={s.fabricCount} onChange={(e) => {
            const fc = Number(e.target.value);
            update({ fabricCount: fc, strands: recommendedStrands(fc) });
          }}>
            {FABRIC_COUNTS.map((c) => (
              <option key={c} value={c}>
                {c}-count {c >= 25 ? "(linen/evenweave)" : "Aida"}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Strands">
          <select value={s.strands} onChange={(e) => update({ strands: Number(e.target.value) })}>
            {[1, 2, 3, 4].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </Field>
      </div>

      <h4>Fabric color</h4>
      <div className="fabric-swatches">
        {FABRIC_COLORS.map((f) => (
          <button
            key={f.hex}
            className={"fabric" + (s.fabricColor === f.hex ? " on" : "")}
            style={{ background: f.hex }}
            title={f.name}
            onClick={() => update({ fabricColor: f.hex })}
          />
        ))}
        <input type="color" value={s.fabricColor} onChange={(e) => update({ fabricColor: e.target.value })} title="Custom fabric color" />
      </div>

      <h4>Colors</h4>
      <Slider label="Maximum colors" value={s.maxColors} min={2} max={120} onChange={(v) => update({ maxColors: v })} />
      <label className="check">
        <input
          type="checkbox"
          checked={s.stashOnly}
          disabled={user.stash.length === 0}
          onChange={(e) => update({ stashOnly: e.target.checked })}
        />
        Only use floss in my stash
        <span className="muted tiny">
          {user.stash.length ? `(${user.stash.length} colors)` : <>(<a href="#/account">add floss to your stash</a> first)</>}
        </span>
      </label>
      <Field label="Color matching" hint="CIEDE2000 matches how eyes perceive color; CIE76 is faster and punchier.">
        <Segmented
          value={s.metric}
          onChange={(metric) => update({ metric })}
          options={[
            { value: "ciede2000", label: "Perceptual (ΔE2000)" },
            { value: "cie76", label: "Simple (ΔE76)" },
          ]}
        />
      </Field>

      <h4>Dithering</h4>
      <Segmented
        value={s.dither}
        onChange={(dither) => update({ dither })}
        options={[
          { value: "none", label: "None", title: "Solid color areas — easiest to stitch" },
          { value: "floyd-steinberg", label: "Smooth", title: "Floyd–Steinberg error diffusion — best for photos" },
          { value: "atkinson", label: "Crisp", title: "Atkinson — keeps highlights & contrast" },
          { value: "ordered", label: "Pattern", title: "Ordered Bayer dithering — regular texture" },
        ]}
      />
      {s.dither !== "none" && (
        <Slider label="Dither strength" value={Math.round(s.ditherStrength * 100)} min={5} max={100} onChange={(v) => update({ ditherStrength: v / 100 })} format={(v) => `${v}%`} />
      )}

      <h4>Cleanup</h4>
      <Slider
        label="Remove stray stitches"
        value={s.confetti}
        min={0}
        max={3}
        onChange={(v) => update({ confetti: v })}
        format={(v) => ["Off", "Light", "Medium", "Strong"][v]}
      />
      <Slider
        label="Merge colors used fewer than"
        value={s.minStitches}
        min={0}
        max={100}
        onChange={(v) => update({ minStitches: v })}
        format={(v) => (v <= 1 ? "Off" : `${v} stitches`)}
      />
      <p className="muted tiny">Isolated single stitches (“confetti”) are slow to stitch. Cleanup merges them into surrounding colors.</p>
    </div>
  );
}

function clampInt(v: number, lo: number, hi: number) {
  return Number.isFinite(v) ? Math.max(lo, Math.min(hi, Math.round(v))) : lo;
}

function NumberInput({ value, onCommit }: { value: number; onCommit: (v: number) => void }) {
  return (
    <input
      key={value}
      type="number"
      min={10}
      max={500}
      defaultValue={value}
      onBlur={(e) => Number(e.target.value) !== value && onCommit(Number(e.target.value))}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
    />
  );
}
