import { useCallback, useEffect, useRef, useState } from "react";
import { deleteProject, listProjects, putProject } from "../lib/db";
import { createProjectFromFile, importProjectJson } from "../lib/projects";
import { navigate } from "../lib/router";
import { uid } from "../lib/auth";
import type { Project, User } from "../lib/types";
import { Icon } from "./ui";

export default function Dashboard({ user }: { user: User }) {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const importRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(() => listProjects(user.id).then(setProjects), [user.id]);
  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleFile = useCallback(
    async (file: File | undefined | null) => {
      if (!file) return;
      setError("");
      setBusy(true);
      try {
        const p = await createProjectFromFile(user, file);
        navigate(`/project/${p.id}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setBusy(false);
      }
    },
    [user],
  );

  // Paste an image from the clipboard anywhere on the page.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const item = [...(e.clipboardData?.items ?? [])].find((i) => i.type.startsWith("image/"));
      if (item) handleFile(item.getAsFile());
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [handleFile]);

  const filtered = (projects ?? []).filter((p) => p.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <main className="dashboard">
      <section
        className={"dropzone" + (dragging ? " dragging" : "") + (busy ? " busy" : "")}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFile(e.dataTransfer.files[0]);
        }}
        onClick={() => fileRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && fileRef.current?.click()}
      >
        <div className="drop-icon"><Icon name="upload" /></div>
        <h2>{busy ? "Reading your image…" : "Drop an image to make a pattern"}</h2>
        <p>Click to browse, drag & drop, or paste with <kbd>Ctrl</kbd>+<kbd>V</kbd>. PNG, JPEG, WebP, GIF — transparent backgrounds stay unstitched.</p>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            handleFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        {error && <div className="error" onClick={(e) => e.stopPropagation()}>{error}</div>}
      </section>

      <div className="section-head">
        <h2>Your patterns {projects && <span className="count">{projects.length}</span>}</h2>
        <div className="row gap">
          {projects && projects.length > 3 && (
            <input className="search" placeholder="Search patterns…" value={query} onChange={(e) => setQuery(e.target.value)} />
          )}
          <button className="btn ghost" onClick={() => importRef.current?.click()}>
            <Icon name="upload" /> Import project file
          </button>
          <input
            ref={importRef}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              try {
                await importProjectJson(user, f);
                refresh();
              } catch (err) {
                setError(err instanceof Error ? err.message : String(err));
              }
            }}
          />
        </div>
      </div>

      {projects === null ? (
        <p className="muted">Loading…</p>
      ) : projects.length === 0 ? (
        <div className="empty">
          <p>No patterns yet. Upload a photo, illustration or pixel art above to get started.</p>
        </div>
      ) : (
        <div className="grid-cards">
          {filtered.map((p) => (
            <ProjectCard
              key={p.id}
              project={p}
              onDelete={async () => {
                if (!confirm(`Delete "${p.name}"? This can't be undone.`)) return;
                await deleteProject(p.id);
                refresh();
              }}
              onDuplicate={async () => {
                await putProject({ ...p, id: uid(), name: p.name + " copy", createdAt: Date.now(), updatedAt: Date.now() });
                refresh();
              }}
            />
          ))}
        </div>
      )}
    </main>
  );
}

function ProjectCard({ project: p, onDelete, onDuplicate }: { project: Project; onDelete: () => void; onDuplicate: () => void }) {
  const progress = progressOf(p);
  return (
    <article className="card" onClick={() => navigate(`/project/${p.id}`)}>
      <div className="card-thumb">
        <img src={p.thumbnail} alt="" />
      </div>
      <div className="card-body">
        <h3 title={p.name}>{p.name}</h3>
        <p className="muted small">
          {p.pattern ? `${p.pattern.width} × ${p.pattern.height} · ${p.pattern.palette.length} colors · ${p.settings.fabricCount}ct` : "Not generated yet"}
        </p>
        {progress !== null && (
          <div className="progress" title={`${progress.toFixed(1)}% stitched`}>
            <div style={{ width: `${progress}%` }} />
          </div>
        )}
        <p className="muted tiny">Edited {timeAgo(p.updatedAt)}</p>
      </div>
      <div className="card-actions" onClick={(e) => e.stopPropagation()}>
        <button className="icon-btn" title="Duplicate" onClick={onDuplicate}><Icon name="copy" /></button>
        <button className="icon-btn danger" title="Delete" onClick={onDelete}><Icon name="trash" /></button>
      </div>
    </article>
  );
}

function progressOf(p: Project): number | null {
  if (!p.pattern || !p.stitched) return null;
  const bin = atob(p.stitched);
  let done = 0;
  for (let i = 0; i < bin.length; i++) {
    let v = bin.charCodeAt(i);
    while (v) {
      done += v & 1;
      v >>= 1;
    }
  }
  if (!done) return null;
  // Total stitches approximated from cells (stitched bits only ever set on non-empty cells).
  const cells = atob(p.pattern.cells);
  let total = 0;
  for (let i = 0; i < cells.length; i += 2) if (!(cells.charCodeAt(i) === 0xff && cells.charCodeAt(i + 1) === 0xff)) total++;
  return total ? (done / total) * 100 : null;
}

function timeAgo(t: number): string {
  const s = (Date.now() - t) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}d ago`;
  return new Date(t).toLocaleDateString();
}
