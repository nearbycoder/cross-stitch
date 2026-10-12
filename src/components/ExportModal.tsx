import { useState } from "react";
import { exportCsv, exportPng, exportProjectJson, printPattern, type PrintOptions } from "../lib/exporters";
import type { ViewMode } from "../lib/render";
import type { Pattern, Project, User } from "../lib/types";
import { Field, Icon, Modal, Segmented } from "./ui";

const PAGE_SIZES = [
  { label: "Large squares", cols: 40, rows: 55 },
  { label: "Standard", cols: 50, rows: 70 },
  { label: "Compact", cols: 60, rows: 85 },
  { label: "Dense", cols: 80, rows: 110 },
];

export default function ExportModal({ project, pattern, user, onClose }: { project: Project; pattern: Pattern; user: User; onClose: () => void }) {
  const [opts, setOpts] = useState<PrintOptions>({
    chartMode: "symbol",
    pageCols: 50,
    pageRows: 70,
    includeCover: true,
    includeColorPreview: true,
    units: user.prefs.units,
  });
  const [pngMode, setPngMode] = useState<ViewMode>("symbol-color");
  const [pngGrid, setPngGrid] = useState(true);
  const pages = Math.ceil(pattern.width / opts.pageCols) * Math.ceil(pattern.height / opts.pageRows);

  return (
    <Modal title="Export & print" onClose={onClose} wide>
      <div className="export-grid">
        <section>
          <h4><Icon name="print" /> Printable pattern / PDF</h4>
          <p className="muted small">Opens a print-ready booklet: cover with finished preview, floss key with skein counts, and numbered chart pages. Choose “Save as PDF” in the print dialog for a PDF.</p>
          <Field label="Chart style">
            <Segmented
              value={opts.chartMode}
              onChange={(chartMode) => setOpts({ ...opts, chartMode })}
              options={[
                { value: "symbol", label: "Black & white symbols" },
                { value: "symbol-color", label: "Color + symbols" },
              ]}
            />
          </Field>
          <Field label="Squares per page" hint={`${pages} chart page${pages === 1 ? "" : "s"} for this pattern`}>
            <select
              value={`${opts.pageCols}x${opts.pageRows}`}
              onChange={(e) => {
                const [c, r] = e.target.value.split("x").map(Number);
                setOpts({ ...opts, pageCols: c, pageRows: r });
              }}
            >
              {PAGE_SIZES.map((p) => (
                <option key={p.label} value={`${p.cols}x${p.rows}`}>
                  {p.label} — {p.cols} × {p.rows}
                </option>
              ))}
            </select>
          </Field>
          <label className="check">
            <input type="checkbox" checked={opts.includeCover} onChange={(e) => setOpts({ ...opts, includeCover: e.target.checked })} /> Include cover page
          </label>
          <label className="check">
            <input type="checkbox" checked={opts.includeColorPreview} disabled={!opts.includeCover} onChange={(e) => setOpts({ ...opts, includeColorPreview: e.target.checked })} /> Finished preview on cover
          </label>
          <button className="btn primary" onClick={() => printPattern(project, pattern, opts)}>
            <Icon name="print" /> Print / Save as PDF
          </button>
        </section>

        <section>
          <h4><Icon name="download" /> Image (PNG)</h4>
          <p className="muted small">A single high-resolution image of the whole chart — great for tablets or stitching apps.</p>
          <Field label="Style">
            <select value={pngMode} onChange={(e) => setPngMode(e.target.value as ViewMode)}>
              <option value="symbol-color">Color + symbols</option>
              <option value="symbol">Black & white symbols</option>
              <option value="color">Color blocks</option>
              <option value="stitch">Realistic stitch preview</option>
            </select>
          </Field>
          <label className="check">
            <input type="checkbox" checked={pngGrid} onChange={(e) => setPngGrid(e.target.checked)} /> Grid lines & numbers
          </label>
          <button className="btn" onClick={() => exportPng(project, pattern, pngMode, pngGrid)}>
            <Icon name="download" /> Download PNG
          </button>

          <h4 style={{ marginTop: 22 }}>Other formats</h4>
          <div className="stack">
            <button className="btn" onClick={() => exportCsv(project, pattern)}>
              <Icon name="download" /> Floss shopping list (CSV)
            </button>
            <button className="btn" onClick={() => exportProjectJson(project)}>
              <Icon name="download" /> Project file (re-importable)
            </button>
          </div>
        </section>
      </div>
    </Modal>
  );
}
