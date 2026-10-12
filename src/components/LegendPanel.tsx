import { useMemo, useState } from "react";
import { contrastInk } from "../lib/color";
import type { Floss } from "../lib/dmc";
import { stitchesPerSkein } from "../lib/stats";
import { SYMBOLS, SYMBOL_FONT } from "../lib/symbols";
import type { PaletteEntry, Pattern, Project, User } from "../lib/types";
import FlossPicker from "./FlossPicker";
import { Icon, Modal, Segmented } from "./ui";

export interface PaletteOps {
  highlight: number | null;
  setHighlight: (i: number | null) => void;
  active: number | null;
  setActive: (i: number) => void;
  swap: (i: number, f: Floss) => void;
  setSymbol: (i: number, s: string) => void;
  merge: (from: number, into: number) => void;
  removeToFabric: (i: number) => void;
  addColor: (f: Floss) => void;
  markColor: (i: number, done: boolean) => void;
}

export default function LegendPanel({
  project,
  pattern,
  counts,
  doneCounts,
  user,
  ops,
}: {
  project: Project;
  pattern: Pattern;
  counts: number[];
  doneCounts: number[];
  user: User;
  ops: PaletteOps;
}) {
  const [sort, setSort] = useState<"usage" | "code" | "symbol">("usage");
  const [menu, setMenu] = useState<number | null>(null);
  const [picker, setPicker] = useState<{ kind: "swap"; index: number } | { kind: "add" } | null>(null);
  const [symbolFor, setSymbolFor] = useState<number | null>(null);
  const [mergeFor, setMergeFor] = useState<number | null>(null);
  const per = stitchesPerSkein(project.settings.fabricCount, project.settings.strands);
  const owned = useMemo(() => new Set(user.stash), [user.stash]);

  const order = useMemo(() => {
    const idx = pattern.palette.map((_, i) => i);
    if (sort === "usage") idx.sort((a, b) => counts[b] - counts[a]);
    if (sort === "code") idx.sort((a, b) => codeKey(pattern.palette[a].code) - codeKey(pattern.palette[b].code));
    if (sort === "symbol") idx.sort((a, b) => symKey(pattern.palette[a].symbol) - symKey(pattern.palette[b].symbol));
    return idx;
  }, [pattern.palette, counts, sort]);

  const total = counts.reduce((a, b) => a + b, 0);
  const totalSkeins = counts.reduce((a, n) => a + (n > 0 ? Math.ceil(n / per) : 0), 0);
  const missing = pattern.palette.filter((e) => !owned.has(e.code)).length;

  return (
    <div className="panel-section legend">
      <div className="legend-summary">
        <div><strong>{pattern.palette.length}</strong><span>colors</span></div>
        <div><strong>{total.toLocaleString()}</strong><span>stitches</span></div>
        <div><strong>{totalSkeins}</strong><span>skeins</span></div>
      </div>
      {user.stash.length > 0 && (
        <p className="muted tiny">{missing === 0 ? "✓ You own every color in this pattern." : `${missing} color${missing === 1 ? "" : "s"} not in your stash (marked ◌).`}</p>
      )}
      <div className="row between">
        <Segmented value={sort} onChange={setSort} options={[{ value: "usage", label: "Usage" }, { value: "code", label: "DMC #" }, { value: "symbol", label: "Symbol" }]} />
        <button className="btn sm" onClick={() => setPicker({ kind: "add" })} title="Add a floss color for painting">
          <Icon name="plus" /> Add
        </button>
      </div>
      <p className="muted tiny">Click a color to paint with it; click the eye to highlight it on the chart.</p>

      <ul className="legend-list">
        {order.map((i) => {
          const e = pattern.palette[i];
          const n = counts[i];
          const done = doneCounts[i];
          const pct = n ? (done / n) * 100 : 0;
          return (
            <li key={i} className={(ops.active === i ? "active " : "") + (ops.highlight === i ? "hl" : "")}>
              <button className="legend-main" onClick={() => ops.setActive(i)} title="Paint with this color">
                <span className="legend-sym" style={{ background: `rgb(${e.r},${e.g},${e.b})`, color: contrastInk(e.r, e.g, e.b), fontFamily: SYMBOL_FONT }}>
                  {e.symbol}
                </span>
                <span className="legend-text">
                  <span className="legend-code">
                    DMC {e.code} {user.stash.length > 0 && !owned.has(e.code) && <span title="Not in your stash">◌</span>}
                  </span>
                  <span className="legend-name">{e.name}</span>
                  {done > 0 && (
                    <span className="mini-progress"><span style={{ width: `${pct}%` }} /></span>
                  )}
                </span>
                <span className="legend-count">
                  {n.toLocaleString()}
                  <span>{n ? Math.ceil(n / per) : 0} sk</span>
                </span>
              </button>
              <button className={"icon-btn" + (ops.highlight === i ? " on" : "")} title="Highlight on chart" onClick={() => ops.setHighlight(ops.highlight === i ? null : i)}>
                <Icon name="eye" />
              </button>
              <button className="icon-btn" title="More" onClick={() => setMenu(menu === i ? null : i)}>⋯</button>
              {menu === i && (
                <div className="menu" onMouseLeave={() => setMenu(null)}>
                  <button onClick={() => { setPicker({ kind: "swap", index: i }); setMenu(null); }}>Swap for another floss…</button>
                  <button onClick={() => { setSymbolFor(i); setMenu(null); }}>Change symbol…</button>
                  <button onClick={() => { setMergeFor(i); setMenu(null); }} disabled={pattern.palette.length < 2}>Merge into another color…</button>
                  <button onClick={() => { ops.markColor(i, true); setMenu(null); }}>Mark all stitched</button>
                  <button onClick={() => { ops.markColor(i, false); setMenu(null); }}>Clear stitched marks</button>
                  <button className="danger" onClick={() => { ops.removeToFabric(i); setMenu(null); }}>Don't stitch (leave fabric)</button>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {picker && (
        <FlossPicker
          title={picker.kind === "add" ? "Add a floss color" : `Swap DMC ${pattern.palette[picker.index].code}`}
          near={picker.kind === "swap" ? pattern.palette[picker.index] : undefined}
          exclude={pattern.palette.map((p) => p.code)}
          stash={user.stash}
          onClose={() => setPicker(null)}
          onPick={(f) => {
            if (picker.kind === "add") ops.addColor(f);
            else ops.swap(picker.index, f);
            setPicker(null);
          }}
        />
      )}

      {symbolFor !== null && (
        <Modal title={`Symbol for DMC ${pattern.palette[symbolFor].code}`} onClose={() => setSymbolFor(null)}>
          <div className="symbol-grid">
            {SYMBOLS.map((s) => {
              const usedBy = pattern.palette.findIndex((p) => p.symbol === s);
              return (
                <button
                  key={s}
                  style={{ fontFamily: SYMBOL_FONT }}
                  className={usedBy === symbolFor ? "on" : usedBy >= 0 ? "used" : ""}
                  title={usedBy >= 0 && usedBy !== symbolFor ? `Used by DMC ${pattern.palette[usedBy].code} — will swap` : ""}
                  onClick={() => {
                    ops.setSymbol(symbolFor, s);
                    setSymbolFor(null);
                  }}
                >
                  {s}
                </button>
              );
            })}
          </div>
        </Modal>
      )}

      {mergeFor !== null && (
        <Modal title={`Merge DMC ${pattern.palette[mergeFor].code} into…`} onClose={() => setMergeFor(null)}>
          <p className="muted small">Every {pattern.palette[mergeFor].name} stitch will become the color you choose.</p>
          <div className="merge-list">
            {nearestOrder(pattern.palette, mergeFor).map((j) => {
              const e = pattern.palette[j];
              return (
                <button key={j} onClick={() => { ops.merge(mergeFor, j); setMergeFor(null); }}>
                  <span className="legend-sym" style={{ background: `rgb(${e.r},${e.g},${e.b})`, color: contrastInk(e.r, e.g, e.b), fontFamily: SYMBOL_FONT }}>{e.symbol}</span>
                  DMC {e.code} — {e.name}
                  <span className="muted">{counts[j].toLocaleString()}</span>
                </button>
              );
            })}
          </div>
        </Modal>
      )}
    </div>
  );
}

function codeKey(code: string): number {
  const n = parseInt(code.replace(/\D/g, ""), 10);
  return Number.isFinite(n) ? n : -1;
}

function symKey(s: string): number {
  const i = SYMBOLS.indexOf(s);
  return i < 0 ? 9999 : i;
}

function nearestOrder(pal: PaletteEntry[], from: number): number[] {
  const a = pal[from];
  return pal
    .map((_, j) => j)
    .filter((j) => j !== from)
    .sort((x, y) => dist(a, pal[x]) - dist(a, pal[y]));
}

function dist(a: PaletteEntry, b: PaletteEntry) {
  return (a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2;
}
