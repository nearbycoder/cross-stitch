import { contrastInk, hex } from "./color";
import { downloadBlob, slugify } from "./image";
import { renderFull, renderRegion, drawRulers, type ViewMode } from "./render";
import { colorCounts, estimateHours, fabricNeeded, finishedSize, stitchesPerSkein } from "./stats";
import { SYMBOL_FONT } from "./symbols";
import type { Pattern, Project } from "./types";

export interface PrintOptions {
  chartMode: "symbol" | "symbol-color";
  pageCols: number;
  pageRows: number;
  includeCover: boolean;
  includeColorPreview: boolean;
  units: "in" | "cm";
}

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function canvasUrl(c: HTMLCanvasElement) {
  return c.toDataURL("image/png");
}

export function exportPng(project: Project, p: Pattern, mode: ViewMode, withGrid: boolean) {
  // Keep within browser canvas limits (~16k px per side).
  const maxCell = Math.floor(14000 / Math.max(p.width, p.height));
  const cell = Math.max(2, Math.min(mode === "color" || mode === "stitch" ? 16 : 24, maxCell));
  const rulers = withGrid && cell >= 8 ? 28 : 0;
  const canvas = renderFull(
    p,
    { mode, cell, showGrid: withGrid, fabricColor: project.settings.fabricColor, highlight: null },
    rulers,
  );
  canvas.toBlob((b) => b && downloadBlob(b, `${slugify(project.name)}-${mode}.png`), "image/png");
}

export function exportCsv(project: Project, p: Pattern) {
  const counts = colorCounts(p);
  const per = stitchesPerSkein(project.settings.fabricCount, project.settings.strands);
  const rows = [["Symbol", "DMC", "Name", "Hex", "Stitches", "Skeins"]];
  p.palette.forEach((e, i) =>
    rows.push([e.symbol, e.code, e.name, hex(e.r, e.g, e.b), String(counts[i]), String(Math.max(1, Math.ceil(counts[i] / per)))]),
  );
  const csv = rows.map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(",")).join("\n");
  downloadBlob(new Blob([csv], { type: "text/csv" }), `${slugify(project.name)}-floss.csv`);
}

export function exportProjectJson(project: Project) {
  const data = JSON.stringify({ format: "stitchcraft-project", version: 1, project }, null, 0);
  downloadBlob(new Blob([data], { type: "application/json" }), `${slugify(project.name)}.stitchcraft.json`);
}

export function printPattern(project: Project, p: Pattern, o: PrintOptions) {
  const win = window.open("", "_blank");
  if (!win) {
    alert("Please allow pop-ups for this site to print or save the pattern as PDF.");
    return;
  }
  win.document.write(`<!doctype html><title>Preparing ${esc(project.name)}…</title><p style="font:16px system-ui;padding:40px">Preparing your pattern pages…</p>`);

  // Defer heavy rendering so the new window paints its placeholder.
  setTimeout(() => {
    const html = buildPrintHtml(project, p, o);
    win.document.open();
    win.document.write(html);
    win.document.close();
    const go = () => {
      win.focus();
      win.print();
    };
    if (win.document.readyState === "complete") setTimeout(go, 400);
    else win.addEventListener("load", () => setTimeout(go, 400));
  }, 50);
}

function buildPrintHtml(project: Project, p: Pattern, o: PrintOptions): string {
  const s = project.settings;
  const counts = colorCounts(p);
  const total = counts.reduce((a, b) => a + b, 0);
  const per = stitchesPerSkein(s.fabricCount, s.strands);
  const size = finishedSize(p.width, p.height, s.fabricCount);
  const fabric = fabricNeeded(p.width, p.height, s.fabricCount);
  const fmt = (v: number) => (o.units === "cm" ? `${(v * 2.54).toFixed(1)} cm` : `${v.toFixed(1)} in`);

  const pagesX = Math.ceil(p.width / o.pageCols);
  const pagesY = Math.ceil(p.height / o.pageRows);
  const totalPages = pagesX * pagesY;

  const cell = 22;
  const ruler = 30;
  const pages: string[] = [];
  let pageNo = 0;
  for (let py = 0; py < pagesY; py++) {
    for (let px = 0; px < pagesX; px++) {
      pageNo++;
      const region = {
        x: px * o.pageCols,
        y: py * o.pageRows,
        w: Math.min(o.pageCols, p.width - px * o.pageCols),
        h: Math.min(o.pageRows, p.height - py * o.pageRows),
      };
      const c = document.createElement("canvas");
      c.width = region.w * cell + ruler * 2;
      c.height = region.h * cell + ruler * 2;
      const ctx = c.getContext("2d")!;
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, c.width, c.height);
      renderRegion(ctx, p, region, ruler, ruler, {
        mode: o.chartMode,
        cell,
        showGrid: true,
        fabricColor: s.fabricColor,
        highlight: null,
      });
      drawRulers(ctx, p, region, ruler, ruler, cell, ruler, { background: "#fff", color: "#333" });
      ctx.strokeStyle = "#111";
      ctx.lineWidth = 2;
      ctx.strokeRect(ruler, ruler, region.w * cell, region.h * cell);
      pages.push(`
        <section class="page chart">
          <header><strong>${esc(project.name)}</strong>
            <span>Page ${pageNo} of ${totalPages} · Columns ${region.x + 1}–${region.x + region.w} · Rows ${region.y + 1}–${region.y + region.h}</span>
          </header>
          <img src="${canvasUrl(c)}" alt="Chart page ${pageNo}" />
          <footer>Red arrows mark the center. Bold lines every 10 stitches. ${miniMap(pagesX, pagesY, px, py)}</footer>
        </section>`);
    }
  }

  const legendRows = p.palette
    .map((e, i) => ({ e, i, n: counts[i] }))
    .map(
      ({ e, n }) => `<tr>
        <td><span class="sym" style="background:${hex(e.r, e.g, e.b)};color:${contrastInk(e.r, e.g, e.b)}">${esc(e.symbol)}</span></td>
        <td><span class="sym bw">${esc(e.symbol)}</span></td>
        <td><strong>${esc(e.code)}</strong></td>
        <td>${esc(e.name)}</td>
        <td class="num">${n.toLocaleString()}</td>
        <td class="num">${Math.max(1, Math.ceil(n / per))}</td>
        <td class="check">☐</td>
      </tr>`,
    )
    .join("");

  const preview = o.includeColorPreview
    ? canvasUrl(
        renderFull(p, {
          mode: Math.max(p.width, p.height) <= 200 ? "stitch" : "color",
          cell: Math.max(2, Math.floor(1400 / Math.max(p.width, p.height))),
          showGrid: false,
          fabricColor: s.fabricColor,
          highlight: null,
        }),
      )
    : "";

  const pageMap = Array.from({ length: pagesY }, (_, y) =>
    `<tr>${Array.from({ length: pagesX }, (_, x) => `<td>${y * pagesX + x + 1}</td>`).join("")}</tr>`,
  ).join("");

  const cover = o.includeCover
    ? `<section class="page cover">
        <h1>${esc(project.name)}</h1>
        <p class="sub">Counted cross stitch pattern · DMC stranded cotton</p>
        ${preview ? `<img class="preview" src="${preview}" alt="Preview" />` : ""}
        <div class="facts">
          <div><span>Design size</span><strong>${p.width} × ${p.height} stitches</strong></div>
          <div><span>Fabric</span><strong>${s.fabricCount}-count Aida</strong></div>
          <div><span>Finished size</span><strong>${fmt(size.w)} × ${fmt(size.h)}</strong></div>
          <div><span>Cut fabric to</span><strong>${fmt(fabric.w)} × ${fmt(fabric.h)}</strong></div>
          <div><span>Colors</span><strong>${p.palette.length}</strong></div>
          <div><span>Total stitches</span><strong>${total.toLocaleString()}</strong></div>
          <div><span>Strands</span><strong>${s.strands} for cross stitch</strong></div>
          <div><span>Est. time</span><strong>~${Math.round(estimateHours(total, p.palette.length))} hours</strong></div>
        </div>
        <h3>Page layout</h3>
        <table class="map">${pageMap}</table>
        <p class="tips">Start in the center of your fabric (find it by folding in half both ways) and match it to the red center arrows on the chart. Each square is one full cross stitch.</p>
      </section>`
    : "";

  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(project.name)} — Cross Stitch Pattern</title>
<style>
  @page { size: auto; margin: 12mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font: 12px/1.45 Inter, system-ui, sans-serif; color: #1c1917; }
  .page { page-break-after: always; break-after: page; padding: 8px 0; }
  .page:last-child { page-break-after: auto; break-after: auto; }
  h1 { font: 700 30px Georgia, serif; margin: 0 0 4px; }
  .sub { color: #78716c; margin: 0 0 16px; }
  .preview { display: block; max-width: 100%; max-height: 105mm; margin: 0 auto 16px; border: 1px solid #ddd; image-rendering: pixelated; }
  .facts { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 16px; }
  .facts div { border: 1px solid #e7e5e4; border-radius: 6px; padding: 6px 8px; }
  .facts span { display: block; font-size: 10px; color: #78716c; text-transform: uppercase; letter-spacing: .04em; }
  .map { border-collapse: collapse; margin-bottom: 12px; }
  .map td { border: 1px solid #a8a29e; width: 32px; height: 26px; text-align: center; font-weight: 600; }
  .tips { color: #57534e; }
  h2 { font: 700 20px Georgia, serif; margin: 0 0 10px; }
  table.legend { width: 100%; border-collapse: collapse; }
  .legend th { text-align: left; font-size: 10px; text-transform: uppercase; color: #78716c; border-bottom: 2px solid #1c1917; padding: 4px 6px; }
  .legend td { border-bottom: 1px solid #e7e5e4; padding: 3px 6px; }
  .legend tr { break-inside: avoid; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  .check { text-align: center; font-size: 15px; }
  .sym { display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; border: 1px solid #a8a29e; font-family: ${SYMBOL_FONT.replace(/"/g, "'")}; font-size: 15px; }
  .sym.bw { background: #fff; color: #111; }
  .chart header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 6px; font-size: 11px; }
  .chart img { display: block; max-width: 100%; max-height: 240mm; margin: 0 auto; }
  .chart footer { display: flex; justify-content: space-between; align-items: center; color: #78716c; font-size: 10px; margin-top: 6px; }
  .mini { border-collapse: collapse; }
  .mini td { width: 9px; height: 7px; border: 1px solid #a8a29e; }
  .mini td.on { background: #b4413a; border-color: #b4413a; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  @media screen { body { max-width: 960px; margin: 24px auto; padding: 0 24px; background: #f5f5f4; } .page { background: #fff; padding: 28px; margin-bottom: 24px; box-shadow: 0 2px 10px rgba(0,0,0,.08); } }
</style></head><body>
${cover}
<section class="page">
  <h2>Floss key</h2>
  <p class="sub">${p.palette.length} DMC colors · ${s.strands} strands · ${s.fabricCount}-count · skeins estimated at ~${per.toLocaleString()} stitches per skein</p>
  <table class="legend"><thead><tr><th>Color</th><th>Chart</th><th>DMC</th><th>Name</th><th class="num">Stitches</th><th class="num">Skeins</th><th>Have</th></tr></thead>
  <tbody>${legendRows}</tbody></table>
</section>
${pages.join("\n")}
</body></html>`;
}

function miniMap(cols: number, rows: number, cx: number, cy: number): string {
  if (cols * rows <= 1) return "";
  return `<table class="mini">${Array.from({ length: rows }, (_, y) =>
    `<tr>${Array.from({ length: cols }, (_, x) => `<td class="${x === cx && y === cy ? "on" : ""}"></td>`).join("")}</tr>`,
  ).join("")}</table>`;
}
