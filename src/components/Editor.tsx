import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getProject, putProject } from "../lib/db";
import type { Floss } from "../lib/dmc";
import { decodeBits, decodePattern, encodeBits, encodePattern, getBit, setBit } from "../lib/encoding";
import type { GenerateOutput } from "../lib/generate";
import { loadImage, readImageFile, samplePixels } from "../lib/image";
import { invalidateRaster, thumbnail, type ViewMode } from "../lib/render";
import { colorCounts, estimateHours, fabricNeeded, finishedSize, stitchesPerSkein } from "../lib/stats";
import { nextFreeSymbol } from "../lib/symbols";
import { EMPTY, type PaletteEntry, type Pattern, type PatternSettings, type Project, type User } from "../lib/types";
import ExportModal from "./ExportModal";
import ImagePanel from "./ImagePanel";
import LegendPanel, { type PaletteOps } from "./LegendPanel";
import PatternCanvas, { type CanvasHandle, type Tool } from "./PatternCanvas";
import SettingsPanel from "./SettingsPanel";
import { Icon, Logo } from "./ui";

type Tab = "image" | "pattern" | "colors" | "info";

interface Snapshot {
  cells: Uint16Array;
  palette: PaletteEntry[];
  stitched: Uint8Array;
}

/** Settings that change the generated stitches (fabric/strand changes don't). */
function generationKey(p: Project, stash: string[]): string {
  const { fabricColor: _f, fabricCount: _c, strands: _s, lockAspect: _l, ...rest } = p.settings;
  return JSON.stringify(rest) + "|" + p.source.length + "|" + p.source.slice(-64) + "|" + (p.settings.stashOnly ? stash.join(",") : "");
}

export default function Editor({ id, user }: { id: string; user: User; onUserChange: (u: User) => void }) {
  const [project, setProject] = useState<Project | null | undefined>(undefined);
  const [pattern, setPattern] = useState<Pattern | null>(null);
  const [stitched, setStitched] = useState<Uint8Array>(new Uint8Array(0));
  const [version, setVersion] = useState(0);
  const [gen, setGen] = useState<{ stage: string; pct: number } | null>(null);
  const [genError, setGenError] = useState("");
  const [staleSettings, setStaleSettings] = useState(false);
  const [tab, setTab] = useState<Tab>("pattern");
  const [mode, setMode] = useState<ViewMode>("symbol-color");
  const [showGrid, setShowGrid] = useState(true);
  const [showStitched, setShowStitched] = useState(true);
  const [tool, setTool] = useState<Tool>("pan");
  const [active, setActive] = useState<number | null>(null);
  const [highlight, setHighlight] = useState<number | null>(null);
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const [scale, setScale] = useState(8);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "error">("saved");
  const [showExport, setShowExport] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [toast, setToast] = useState("");
  const [undoSize, setUndoSize] = useState({ undo: 0, redo: 0 });

  const canvasRef = useRef<CanvasHandle>(null);
  const projectRef = useRef<Project | null>(null);
  const patternRef = useRef<Pattern | null>(null);
  const stitchedRef = useRef<Uint8Array>(new Uint8Array(0));
  const undoStack = useRef<Snapshot[]>([]);
  const redoStack = useRef<Snapshot[]>([]);
  const workerRef = useRef<Worker | null>(null);
  const genIdRef = useRef(0);
  const lastKeyRef = useRef<string>("");
  const saveTimer = useRef<number>(0);
  const strokeRef = useRef<{ stitchTarget: boolean; changed: boolean } | null>(null);

  projectRef.current = project ?? null;
  patternRef.current = pattern;
  stitchedRef.current = stitched;

  const flash = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast((t) => (t === msg ? "" : t)), 2400);
  }, []);

  // ---------- persistence ----------
  const saveNow = useCallback(async () => {
    const p = projectRef.current;
    if (!p) return;
    const pat = patternRef.current;
    const next: Project = {
      ...p,
      updatedAt: Date.now(),
      pattern: pat ? encodePattern(pat) : null,
      stitched: pat ? encodeBits(stitchedRef.current) : "",
      thumbnail: pat ? thumbnail(pat, p.settings.fabricColor) : p.thumbnail,
    };
    try {
      await putProject(next);
      setSaveState("saved");
    } catch (err) {
      console.error(err);
      setSaveState("error");
    }
  }, []);

  const scheduleSave = useCallback(() => {
    setSaveState("saving");
    clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(saveNow, 700);
  }, [saveNow]);

  // Flush pending saves when leaving the page.
  useEffect(() => {
    const flush = () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        saveNow();
      }
    };
    window.addEventListener("beforeunload", flush);
    return () => {
      window.removeEventListener("beforeunload", flush);
      flush();
    };
  }, [saveNow]);

  // ---------- load ----------
  useEffect(() => {
    let cancelled = false;
    getProject(id).then((p) => {
      if (cancelled) return;
      if (!p || p.ownerId !== user.id) return setProject(null);
      setProject(p);
      if (p.pattern) {
        const pat = decodePattern(p.pattern);
        setPattern(pat);
        setStitched(decodeBits(p.stitched, pat.cells.length));
        lastKeyRef.current = generationKey(p, user.stash);
        setTab(p.edited || p.stitched ? "colors" : "pattern");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [id, user.id, user.stash]);

  // ---------- generation ----------
  useEffect(() => {
    const w = new Worker(new URL("../workers/generate.worker.ts", import.meta.url), { type: "module" });
    workerRef.current = w;
    w.onmessage = (e: MessageEvent) => {
      const msg = e.data;
      if (msg.id !== genIdRef.current) return;
      if (msg.type === "progress") setGen({ stage: msg.stage, pct: msg.pct });
      else if (msg.type === "error") {
        setGen(null);
        setGenError(msg.message);
      } else if (msg.type === "done") {
        const r = msg.result as GenerateOutput;
        const pat: Pattern = { width: r.width, height: r.height, palette: r.palette, cells: r.cells };
        const prev = patternRef.current;
        let bits = new Uint8Array(Math.ceil(r.cells.length / 8));
        if (prev && prev.width === r.width && prev.height === r.height) {
          // Keep progress for cells that are still stitched.
          bits = new Uint8Array(stitchedRef.current);
          for (let i = 0; i < r.cells.length; i++) if (r.cells[i] === EMPTY) setBit(bits, i, false);
        }
        setPattern(pat);
        setStitched(bits);
        patternRef.current = pat;
        stitchedRef.current = bits;
        setActive(null);
        setHighlight(null);
        setGen(null);
        setGenError("");
        setStaleSettings(false);
        undoStack.current = [];
        redoStack.current = [];
        setUndoSize({ undo: 0, redo: 0 });
        setProject((p) => (p && p.edited ? { ...p, edited: false } : p));
        scheduleSave();
      }
    };
    return () => w.terminate();
  }, [scheduleSave]);

  const runGenerate = useCallback(
    async (p: Project) => {
      const id = ++genIdRef.current;
      lastKeyRef.current = generationKey(p, user.stash);
      setGen({ stage: "Preparing image", pct: 0.02 });
      try {
        const img = await loadImage(p.source);
        if (id !== genIdRef.current) return;
        const s = p.settings;
        const data = samplePixels(img, s.crop, s.width, s.height);
        workerRef.current?.postMessage(
          { id, input: { pixels: data.data, width: s.width, height: s.height, settings: s, stash: user.stash } },
          [data.data.buffer],
        );
      } catch (err) {
        setGen(null);
        setGenError(err instanceof Error ? err.message : String(err));
      }
    },
    [user.stash],
  );

  // Auto-regenerate (debounced) when generation-affecting settings change.
  useEffect(() => {
    if (!project) return;
    const key = generationKey(project, user.stash);
    if (key === lastKeyRef.current && patternRef.current) return;
    if (project.edited && patternRef.current) {
      setStaleSettings(true);
      return;
    }
    const t = window.setTimeout(() => runGenerate(project), patternRef.current ? 320 : 0);
    return () => clearTimeout(t);
  }, [project, user.stash, runGenerate]);

  // ---------- settings ----------
  const updateSettings = useCallback(
    (patch: Partial<PatternSettings>) => {
      setProject((p) => {
        if (!p) return p;
        const s = { ...p.settings, ...patch };
        if (patch.crop && s.lockAspect) {
          const aspect = (s.crop.h * p.sourceHeight) / (s.crop.w * p.sourceWidth);
          s.height = Math.max(10, Math.min(500, Math.round(s.width * aspect)));
        }
        return { ...p, settings: s };
      });
      scheduleSave();
    },
    [scheduleSave],
  );

  const replaceImage = async (f: File) => {
    try {
      const img = await readImageFile(f);
      setProject((p) => {
        if (!p) return p;
        const height = p.settings.lockAspect ? Math.max(10, Math.min(500, Math.round((p.settings.width * img.height) / img.width))) : p.settings.height;
        return {
          ...p,
          source: img.dataUrl,
          sourceWidth: img.width,
          sourceHeight: img.height,
          edited: false,
          settings: { ...p.settings, crop: { x: 0, y: 0, w: 1, h: 1 }, height },
        };
      });
      scheduleSave();
    } catch (err) {
      flash(err instanceof Error ? err.message : String(err));
    }
  };

  // ---------- editing ----------
  const snapshot = (): Snapshot | null => {
    const pat = patternRef.current;
    if (!pat) return null;
    return { cells: new Uint16Array(pat.cells), palette: pat.palette.map((e) => ({ ...e })), stitched: new Uint8Array(stitchedRef.current) };
  };

  const pushUndo = () => {
    const s = snapshot();
    if (!s) return;
    undoStack.current.push(s);
    if (undoStack.current.length > 60) undoStack.current.shift();
    redoStack.current = [];
    setUndoSize({ undo: undoStack.current.length, redo: 0 });
  };

  const restore = (s: Snapshot) => {
    const pat = patternRef.current!;
    const next: Pattern = { ...pat, cells: s.cells, palette: s.palette };
    patternRef.current = next;
    stitchedRef.current = s.stitched;
    setPattern(next);
    setStitched(s.stitched);
    setVersion((v) => v + 1);
    scheduleSave();
  };

  const undo = () => {
    const s = undoStack.current.pop();
    const cur = snapshot();
    if (!s || !cur) return;
    redoStack.current.push(cur);
    restore(s);
    setUndoSize({ undo: undoStack.current.length, redo: redoStack.current.length });
  };

  const redo = () => {
    const s = redoStack.current.pop();
    const cur = snapshot();
    if (!s || !cur) return;
    undoStack.current.push(cur);
    restore(s);
    setUndoSize({ undo: undoStack.current.length, redo: redoStack.current.length });
  };

  const markEdited = () => {
    setProject((p) => (p && !p.edited ? { ...p, edited: true } : p));
  };

  const commitCells = () => {
    const pat = patternRef.current;
    if (pat) invalidateRaster(pat);
    setVersion((v) => v + 1);
    scheduleSave();
  };

  const floodFill = (x: number, y: number, match: (i: number) => boolean, apply: (i: number) => void) => {
    const pat = patternRef.current!;
    const seen = new Uint8Array(pat.cells.length);
    const stack = [y * pat.width + x];
    while (stack.length) {
      const i = stack.pop()!;
      if (seen[i] || !match(i)) continue;
      seen[i] = 1;
      apply(i);
      const cx = i % pat.width;
      const cy = (i / pat.width) | 0;
      if (cx > 0) stack.push(i - 1);
      if (cx < pat.width - 1) stack.push(i + 1);
      if (cy > 0) stack.push(i - pat.width);
      if (cy < pat.height - 1) stack.push(i + pat.width);
    }
  };

  const onCellAction = (phase: "down" | "move" | "up", x: number, y: number, mod: { shift: boolean; alt: boolean }) => {
    const pat = patternRef.current;
    if (!pat) return;
    if (phase === "up") {
      if (strokeRef.current?.changed) commitCells();
      strokeRef.current = null;
      return;
    }
    const i = y * pat.width + x;
    const bits = stitchedRef.current;

    if (tool === "pick") {
      if (phase === "down" && pat.cells[i] !== EMPTY) {
        setActive(pat.cells[i]);
        setTool("paint");
        flash(`Picked DMC ${pat.palette[pat.cells[i]].code}`);
      }
      return;
    }

    if (tool === "stitch") {
      if (pat.cells[i] === EMPTY) return;
      if (phase === "down") {
        pushUndo();
        strokeRef.current = { stitchTarget: !getBit(bits, i), changed: true };
        if (mod.shift) {
          const c = pat.cells[i];
          const target = strokeRef.current.stitchTarget;
          floodFill(x, y, (j) => pat.cells[j] === c, (j) => setBit(bits, j, target));
          setVersion((v) => v + 1);
          return;
        }
      }
      if (!strokeRef.current) return;
      setBit(bits, i, strokeRef.current.stitchTarget);
      setVersion((v) => v + 1);
      return;
    }

    if (tool === "paint" || tool === "erase") {
      const value = tool === "erase" ? EMPTY : active;
      if (value === null) {
        if (phase === "down") flash("Choose a color in the Colors tab first");
        return;
      }
      if (phase === "down") {
        pushUndo();
        strokeRef.current = { stitchTarget: false, changed: false };
        markEdited();
      }
      if (!strokeRef.current) return;
      if (pat.cells[i] !== value) {
        pat.cells[i] = value;
        setBit(bits, i, false);
        strokeRef.current.changed = true;
        invalidateRaster(pat);
        setVersion((v) => v + 1);
      }
      return;
    }

    if (tool === "fill" && phase === "down") {
      if (active === null) return flash("Choose a color in the Colors tab first");
      const from = pat.cells[i];
      if (from === active) return;
      pushUndo();
      markEdited();
      if (mod.shift) {
        // Replace this color everywhere
        for (let j = 0; j < pat.cells.length; j++) if (pat.cells[j] === from) pat.cells[j] = active;
      } else {
        floodFill(x, y, (j) => pat.cells[j] === from, (j) => {
          pat.cells[j] = active;
          setBit(bits, j, false);
        });
      }
      strokeRef.current = { stitchTarget: false, changed: true };
    }
  };

  // Palette operations
  const replacePattern = (next: Pattern) => {
    patternRef.current = next;
    setPattern(next);
    invalidateRaster(next);
    setVersion((v) => v + 1);
    markEdited();
    scheduleSave();
  };

  const removeIndex = (pat: Pattern, idx: number): Pattern => {
    const cells = pat.cells;
    for (let j = 0; j < cells.length; j++) {
      if (cells[j] !== EMPTY && cells[j] > idx) cells[j]--;
    }
    return { ...pat, cells, palette: pat.palette.filter((_, k) => k !== idx) };
  };

  const adjustIndexAfterRemoval = (cur: number | null, removed: number, into: number | null = null) =>
    cur === null ? null : cur === removed ? (into === null ? null : into > removed ? into - 1 : into) : cur > removed ? cur - 1 : cur;

  const ops: PaletteOps = {
    highlight,
    setHighlight,
    active,
    setActive: (i) => {
      setActive(i);
      if (tool === "pan" || tool === "pick" || tool === "stitch") setTool("paint");
    },
    swap: (i, f: Floss) => {
      const pat = patternRef.current!;
      pushUndo();
      const palette = pat.palette.map((e, k) => (k === i ? { ...e, code: f.code, name: f.name, r: f.r, g: f.g, b: f.b } : e));
      replacePattern({ ...pat, palette });
      flash(`Swapped to DMC ${f.code}`);
    },
    setSymbol: (i, s) => {
      const pat = patternRef.current!;
      pushUndo();
      const old = pat.palette[i].symbol;
      const palette = pat.palette.map((e, k) => (k === i ? { ...e, symbol: s } : e.symbol === s ? { ...e, symbol: old } : e));
      replacePattern({ ...pat, palette });
    },
    merge: (from, into) => {
      const pat = patternRef.current!;
      pushUndo();
      for (let j = 0; j < pat.cells.length; j++) if (pat.cells[j] === from) pat.cells[j] = into;
      replacePattern(removeIndex(pat, from));
      setActive((a) => adjustIndexAfterRemoval(a, from, into));
      setHighlight((h) => adjustIndexAfterRemoval(h, from, into));
    },
    removeToFabric: (i) => {
      const pat = patternRef.current!;
      pushUndo();
      const bits = stitchedRef.current;
      for (let j = 0; j < pat.cells.length; j++) {
        if (pat.cells[j] === i) {
          pat.cells[j] = EMPTY;
          setBit(bits, j, false);
        }
      }
      replacePattern(removeIndex(pat, i));
      setActive((a) => adjustIndexAfterRemoval(a, i));
      setHighlight((h) => adjustIndexAfterRemoval(h, i));
    },
    addColor: (f) => {
      const pat = patternRef.current!;
      pushUndo();
      const entry: PaletteEntry = { code: f.code, name: f.name, r: f.r, g: f.g, b: f.b, symbol: nextFreeSymbol(pat.palette.map((e) => e.symbol)) };
      replacePattern({ ...pat, palette: [...pat.palette, entry] });
      setActive(pat.palette.length);
      setTool("paint");
    },
    markColor: (i, done) => {
      const pat = patternRef.current!;
      pushUndo();
      const bits = stitchedRef.current;
      for (let j = 0; j < pat.cells.length; j++) if (pat.cells[j] === i) setBit(bits, j, done);
      setVersion((v) => v + 1);
      scheduleSave();
    },
  };

  // ---------- keyboard ----------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
        return;
      }
      if (mod) return;
      const map: Record<string, Tool> = { v: "pan", h: "pan", b: "paint", p: "paint", f: "fill", e: "erase", i: "pick", s: "stitch" };
      const t = map[e.key.toLowerCase()];
      if (t) setTool(t);
      else if (e.key === "+" || e.key === "=") canvasRef.current?.zoomBy(1.25);
      else if (e.key === "-") canvasRef.current?.zoomBy(0.8);
      else if (e.key === "0") canvasRef.current?.fit();
      else if (e.key === "g") setShowGrid((g) => !g);
      else if (e.key === "Escape") setHighlight(null);
      else if (e.key >= "1" && e.key <= "4") setMode((["symbol-color", "color", "symbol", "stitch"] as ViewMode[])[Number(e.key) - 1]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // ---------- derived ----------
  const counts = useMemo(() => (pattern ? colorCounts(pattern) : []), [pattern, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const doneCounts = useMemo(() => {
    if (!pattern) return [];
    const d = new Array(pattern.palette.length).fill(0);
    for (let i = 0; i < pattern.cells.length; i++) {
      const c = pattern.cells[i];
      if (c !== EMPTY && getBit(stitched, i)) d[c]++;
    }
    return d;
  }, [pattern, stitched, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const totalStitches = counts.reduce((a, b) => a + b, 0);
  const totalDone = doneCounts.reduce((a, b) => a + b, 0);

  if (project === undefined) return <div className="center-screen muted">Loading pattern…</div>;
  if (project === null)
    return (
      <div className="center-screen">
        <p>That pattern doesn't exist (or belongs to another account on this device).</p>
        <a className="btn" href="#/">Back to patterns</a>
      </div>
    );

  const hoverCell = hover && pattern ? pattern.cells[hover.y * pattern.width + hover.x] : EMPTY;
  const hoverEntry = hoverCell !== EMPTY && pattern ? pattern.palette[hoverCell] : null;
  const activeEntry = active !== null && pattern ? pattern.palette[active] : null;

  return (
    <div className={"editor" + (sidebarOpen ? "" : " collapsed")}>
      <header className="editor-top">
        <a className="icon-btn" href="#/" title="All patterns">
          <Icon name="back" />
        </a>
        <a className="brand" href="#/">
          <Logo size={24} />
        </a>
        <input
          className="title-input"
          value={project.name}
          onChange={(e) => {
            const name = e.target.value;
            setProject((p) => (p ? { ...p, name } : p));
            scheduleSave();
          }}
          aria-label="Pattern name"
        />
        <span className={"save-state " + saveState}>{saveState === "saved" ? "Saved" : saveState === "saving" ? "Saving…" : "Couldn't save — storage full?"}</span>
        <div className="spacer" />
        <button className="btn ghost sm mobile-only" onClick={() => setSidebarOpen((o) => !o)}>
          {sidebarOpen ? "Hide panel" : "Settings"}
        </button>
        <button className="btn primary" disabled={!pattern} onClick={() => setShowExport(true)}>
          <Icon name="print" /> Export & print
        </button>
      </header>

      <aside className="sidebar">
        <nav className="tabs">
          {(["image", "pattern", "colors", "info"] as Tab[]).map((t) => (
            <button key={t} className={tab === t ? "on" : ""} onClick={() => setTab(t)}>
              {t === "image" ? "Image" : t === "pattern" ? "Pattern" : t === "colors" ? `Colors${pattern ? ` (${pattern.palette.length})` : ""}` : "Info"}
            </button>
          ))}
        </nav>
        <div className="sidebar-scroll">
          {tab === "image" && <ImagePanel project={project} update={updateSettings} onReplaceImage={replaceImage} />}
          {tab === "pattern" && <SettingsPanel project={project} user={user} update={updateSettings} />}
          {tab === "colors" && pattern && (
            <LegendPanel project={project} pattern={pattern} counts={counts} doneCounts={doneCounts} user={user} ops={ops} />
          )}
          {tab === "info" && pattern && (
            <InfoPanel
              project={project}
              pattern={pattern}
              user={user}
              total={totalStitches}
              done={totalDone}
              onNotes={(notes) => {
                setProject((p) => (p ? { ...p, notes } : p));
                scheduleSave();
              }}
              onResetProgress={() => {
                if (!confirm("Clear all stitched marks?")) return;
                pushUndo();
                const bits = new Uint8Array(stitched.length);
                stitchedRef.current = bits;
                setStitched(bits);
                scheduleSave();
              }}
            />
          )}
        </div>
      </aside>

      <section className="workspace">
        <div className="toolbar">
          <div className="tool-group" role="toolbar" aria-label="Tools">
            <ToolBtn t="pan" cur={tool} set={setTool} icon="hand" label="Move (V)" />
            <ToolBtn t="stitch" cur={tool} set={setTool} icon="check" label="Mark stitched (S) — Shift+click marks a whole area" />
            <span className="sep" />
            <ToolBtn t="paint" cur={tool} set={setTool} icon="brush" label="Paint (B)" />
            <ToolBtn t="fill" cur={tool} set={setTool} icon="fill" label="Fill area (F) — Shift+click replaces color everywhere" />
            <ToolBtn t="erase" cur={tool} set={setTool} icon="eraser" label="Erase to fabric (E)" />
            <ToolBtn t="pick" cur={tool} set={setTool} icon="picker" label="Pick color (I)" />
            {activeEntry && (
              <button className="active-color" title={`Painting with DMC ${activeEntry.code} ${activeEntry.name}`} onClick={() => setTab("colors")}>
                <span style={{ background: `rgb(${activeEntry.r},${activeEntry.g},${activeEntry.b})` }} />
                {activeEntry.code}
              </button>
            )}
          </div>
          <div className="tool-group">
            <button className="icon-btn" title="Undo (Ctrl+Z)" disabled={!undoSize.undo} onClick={undo}><Icon name="undo" /></button>
            <button className="icon-btn" title="Redo (Ctrl+Shift+Z)" disabled={!undoSize.redo} onClick={redo}><Icon name="redo" /></button>
          </div>
          <div className="tool-group">
            <select className="view-select" value={mode} onChange={(e) => setMode(e.target.value as ViewMode)} title="Chart view (1–4)">
              <option value="symbol-color">Color + symbols</option>
              <option value="color">Color blocks</option>
              <option value="symbol">Symbols (B&W)</option>
              <option value="stitch">Stitched preview</option>
            </select>
            <button className={"icon-btn" + (showGrid ? " on" : "")} title="Grid (G)" onClick={() => setShowGrid((g) => !g)}><Icon name="grid" /></button>
            <label className="check compact" title="Show stitched progress">
              <input type="checkbox" checked={showStitched} onChange={(e) => setShowStitched(e.target.checked)} /> Progress
            </label>
          </div>
          <div className="tool-group">
            <button className="icon-btn" title="Zoom out (−)" onClick={() => canvasRef.current?.zoomBy(0.8)}><Icon name="minus" /></button>
            <button className="zoom-label" title="Fit to screen (0)" onClick={() => canvasRef.current?.fit()}>
              {Math.round(scale * 10)}%
            </button>
            <button className="icon-btn" title="Zoom in (+)" onClick={() => canvasRef.current?.zoomBy(1.25)}><Icon name="plus" /></button>
            <button className="icon-btn" title="Fit (0)" onClick={() => canvasRef.current?.fit()}><Icon name="fit" /></button>
          </div>
        </div>

        {staleSettings && (
          <div className="banner">
            Settings changed since your manual edits.
            <button className="btn sm primary" onClick={() => { setStaleSettings(false); runGenerate(project); }}>
              Regenerate (discard edits)
            </button>
            <button className="btn sm ghost" onClick={() => { setStaleSettings(false); lastKeyRef.current = generationKey(project, user.stash); }}>
              Keep my edits
            </button>
          </div>
        )}
        {genError && <div className="banner error">Couldn't generate: {genError}</div>}

        <div className="stage">
          {pattern ? (
            <PatternCanvas
              ref={canvasRef}
              pattern={pattern}
              version={version}
              stitched={stitched}
              mode={mode}
              showGrid={showGrid}
              showStitched={showStitched}
              fabricColor={project.settings.fabricColor}
              highlight={highlight}
              tool={tool}
              onCellAction={onCellAction}
              onHover={setHover}
              onScaleChange={setScale}
            />
          ) : (
            <div className="center-screen muted">Creating your pattern…</div>
          )}
          {gen && (
            <div className="gen-overlay">
              <div className="gen-card">
                <div className="spinner" />
                <div>
                  <strong>{gen.stage}…</strong>
                  <div className="progress"><div style={{ width: `${Math.round(gen.pct * 100)}%` }} /></div>
                </div>
              </div>
            </div>
          )}
          {toast && <div className="toast">{toast}</div>}
        </div>

        <footer className="statusbar">
          {pattern && (
            <>
              <span>{pattern.width} × {pattern.height}</span>
              <span>{pattern.palette.length} colors</span>
              <span>{totalStitches.toLocaleString()} stitches</span>
              {totalDone > 0 && (
                <span className="status-progress">
                  <span className="progress small"><span style={{ width: `${(totalDone / totalStitches) * 100}%` }} /></span>
                  {((totalDone / totalStitches) * 100).toFixed(1)}% done
                </span>
              )}
              <span className="spacer" />
              {hover && (
                <span className="hover-info">
                  Col {hover.x + 1}, Row {hover.y + 1}
                  {hoverEntry ? (
                    <>
                      {" · "}
                      <span className="swatch" style={{ background: `rgb(${hoverEntry.r},${hoverEntry.g},${hoverEntry.b})` }} />
                      {hoverEntry.symbol} DMC {hoverEntry.code} {hoverEntry.name}
                      {getBit(stitched, hover.y * pattern.width + hover.x) ? " ✓" : ""}
                    </>
                  ) : (
                    " · fabric"
                  )}
                </span>
              )}
            </>
          )}
        </footer>
      </section>

      {showExport && pattern && <ExportModal project={project} pattern={pattern} user={user} onClose={() => setShowExport(false)} />}
    </div>
  );
}

function ToolBtn({ t, cur, set, icon, label }: { t: Tool; cur: Tool; set: (t: Tool) => void; icon: Parameters<typeof Icon>[0]["name"]; label: string }) {
  return (
    <button className={"icon-btn" + (cur === t ? " on" : "")} title={label} aria-label={label} onClick={() => set(t)}>
      <Icon name={icon} />
    </button>
  );
}

function InfoPanel({
  project,
  pattern,
  user,
  total,
  done,
  onNotes,
  onResetProgress,
}: {
  project: Project;
  pattern: Pattern;
  user: User;
  total: number;
  done: number;
  onNotes: (n: string) => void;
  onResetProgress: () => void;
}) {
  const s = project.settings;
  const units = user.prefs.units;
  const fmt = (v: number) => (units === "cm" ? `${(v * 2.54).toFixed(1)} cm` : `${v.toFixed(1)}″`);
  const size = finishedSize(pattern.width, pattern.height, s.fabricCount);
  const cut = fabricNeeded(pattern.width, pattern.height, s.fabricCount);
  const per = stitchesPerSkein(s.fabricCount, s.strands);
  const hours = estimateHours(total, pattern.palette.length);
  const remaining = estimateHours(total - done, 0);
  const pct = total ? (done / total) * 100 : 0;

  return (
    <div className="panel-section">
      <h4>Progress</h4>
      <div className="big-progress">
        <div className="progress"><div style={{ width: `${pct}%` }} /></div>
        <span>
          <strong>{pct.toFixed(1)}%</strong> · {done.toLocaleString()} of {total.toLocaleString()} stitches
        </span>
      </div>
      <p className="muted tiny">Use the ✓ tool (S) to mark stitches as you go — Shift+click marks a whole connected area of one color.</p>
      {done > 0 && <button className="btn ghost sm" onClick={onResetProgress}>Reset progress</button>}

      <h4>Pattern details</h4>
      <dl className="facts-list">
        <dt>Design size</dt><dd>{pattern.width} × {pattern.height} stitches</dd>
        <dt>Fabric</dt><dd>{s.fabricCount}-count, {s.strands} strand{s.strands > 1 ? "s" : ""}</dd>
        <dt>Finished size</dt><dd>{fmt(size.w)} × {fmt(size.h)}</dd>
        <dt>Cut fabric to</dt><dd>{fmt(cut.w)} × {fmt(cut.h)} <span className="muted">(3″ margins)</span></dd>
        <dt>Colors</dt><dd>{pattern.palette.length} DMC</dd>
        <dt>Total stitches</dt><dd>{total.toLocaleString()}</dd>
        <dt>Coverage</dt><dd>{((total / (pattern.width * pattern.height)) * 100).toFixed(0)}% of grid</dd>
        <dt>Per skein</dt><dd>~{per.toLocaleString()} stitches</dd>
        <dt>Est. stitching time</dt><dd>~{Math.round(hours)} h total{done > 0 ? `, ~${Math.round(remaining)} h left` : ""}</dd>
      </dl>

      <h4>Notes</h4>
      <textarea rows={6} placeholder="Where you left off, floss substitutions, gift ideas…" value={project.notes} onChange={(e) => onNotes(e.target.value)} />

      <h4>Shortcuts</h4>
      <dl className="facts-list shortcuts">
        <dt>V / S / B / F / E / I</dt><dd>Move, stitch, paint, fill, erase, pick</dd>
        <dt>Space + drag</dt><dd>Pan with any tool</dd>
        <dt>Scroll / pinch</dt><dd>Zoom · Shift+scroll pans</dd>
        <dt>1 – 4</dt><dd>Switch chart view</dd>
        <dt>G · 0 · ± </dt><dd>Grid · fit · zoom</dd>
        <dt>Ctrl+Z / Ctrl+Shift+Z</dt><dd>Undo / redo</dd>
      </dl>
    </div>
  );
}
