import { useMemo, useRef, useState } from "react";
import { changePassword, deleteUser, updateUser } from "../lib/auth";
import { deleteProjectsFor, listProjects, putProject } from "../lib/db";
import { DMC } from "../lib/dmc";
import { downloadBlob } from "../lib/image";
import { FABRIC_COUNTS, type Project, type User } from "../lib/types";
import { DMC_BY_HUE, FlossTile, searchFloss } from "./FlossPicker";
import { Field, Segmented } from "./ui";

export default function Account({ user, onChange, onDeleted }: { user: User; onChange: (u: User) => void; onDeleted: () => void }) {
  const save = (u: User) => {
    updateUser(u);
    onChange(u);
  };

  return (
    <main className="account">
      <div className="account-grid">
        <section className="panel">
          <h2>Profile</h2>
          <Field label="Display name">
            <input value={user.displayName} onChange={(e) => save({ ...user, displayName: e.target.value })} />
          </Field>
          <p className="muted small">Username: <strong>{user.username}</strong> · Member since {new Date(user.createdAt).toLocaleDateString()}</p>
          <PasswordForm user={user} onChange={onChange} />
        </section>

        <section className="panel">
          <h2>Pattern defaults</h2>
          <p className="muted small">Used when you upload a new image.</p>
          <Field label="Default width (stitches)">
            <input type="number" min={20} max={500} key={user.prefs.defaultWidth} defaultValue={user.prefs.defaultWidth}
              onBlur={(e) => save({ ...user, prefs: { ...user.prefs, defaultWidth: clamp(Number(e.target.value), 20, 500) } })} />
          </Field>
          <Field label="Default max colors">
            <input type="number" min={2} max={120} key={user.prefs.defaultMaxColors} defaultValue={user.prefs.defaultMaxColors}
              onBlur={(e) => save({ ...user, prefs: { ...user.prefs, defaultMaxColors: clamp(Number(e.target.value), 2, 120) } })} />
          </Field>
          <Field label="Default fabric count">
            <select value={user.prefs.defaultFabricCount}
              onChange={(e) => save({ ...user, prefs: { ...user.prefs, defaultFabricCount: Number(e.target.value) } })}>
              {FABRIC_COUNTS.map((c) => <option key={c} value={c}>{c}-count</option>)}
            </select>
          </Field>
          <Field label="Measurement units">
            <Segmented value={user.prefs.units} options={[{ value: "in", label: "Inches" }, { value: "cm", label: "Centimeters" }]}
              onChange={(units) => save({ ...user, prefs: { ...user.prefs, units } })} />
          </Field>
        </section>

        <section className="panel">
          <h2>Your data</h2>
          <p className="muted small">Everything is stored only in this browser. Back it up to move it to another device.</p>
          <DataTools user={user} onDeleted={onDeleted} />
        </section>
      </div>

      <StashManager user={user} onSave={save} />
    </main>
  );
}

function clamp(v: number, lo: number, hi: number) {
  return Number.isFinite(v) ? Math.max(lo, Math.min(hi, Math.round(v))) : lo;
}

function PasswordForm({ user, onChange }: { user: User; onChange: (u: User) => void }) {
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <form
      className="stack"
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          onChange(await changePassword(user, cur, next));
          setCur("");
          setNext("");
          setMsg({ ok: true, text: "Password updated." });
        } catch (err) {
          setMsg({ ok: false, text: err instanceof Error ? err.message : String(err) });
        }
      }}
    >
      <h4>Change password</h4>
      <input type="password" placeholder="Current password" value={cur} onChange={(e) => setCur(e.target.value)} autoComplete="current-password" />
      <input type="password" placeholder="New password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />
      {msg && <div className={msg.ok ? "success" : "error"}>{msg.text}</div>}
      <button className="btn" disabled={!cur || !next}>Update password</button>
    </form>
  );
}

function DataTools({ user, onDeleted }: { user: User; onDeleted: () => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState("");
  return (
    <div className="stack">
      <button
        className="btn"
        onClick={async () => {
          const projects = await listProjects(user.id);
          const { salt: _s, passwordHash: _p, ...profile } = user;
          const blob = new Blob([JSON.stringify({ format: "stitchcraft-backup", version: 1, profile, projects })], { type: "application/json" });
          downloadBlob(blob, `stitchcraft-backup-${user.username}.json`);
        }}
      >
        Download full backup
      </button>
      <button className="btn" onClick={() => ref.current?.click()}>Restore from backup</button>
      <input
        ref={ref}
        type="file"
        accept=".json"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          try {
            const data = JSON.parse(await f.text());
            if (data.format !== "stitchcraft-backup") throw new Error("Not a Stitchcraft backup file.");
            const projects = data.projects as Project[];
            for (const p of projects) await putProject({ ...p, ownerId: user.id });
            if (Array.isArray(data.profile?.stash)) updateUser({ ...user, stash: [...new Set([...user.stash, ...data.profile.stash])] });
            setMsg(`Restored ${projects.length} pattern${projects.length === 1 ? "" : "s"}.`);
          } catch (err) {
            setMsg(err instanceof Error ? err.message : String(err));
          }
        }}
      />
      {msg && <p className="small">{msg}</p>}
      <button
        className="btn danger"
        onClick={async () => {
          if (!confirm("Delete your account and all of its patterns from this browser? This can't be undone.")) return;
          await deleteProjectsFor(user.id);
          deleteUser(user);
          onDeleted();
        }}
      >
        Delete account
      </button>
    </div>
  );
}

function StashManager({ user, onSave }: { user: User; onSave: (u: User) => void }) {
  const [q, setQ] = useState("");
  const [show, setShow] = useState<"all" | "owned" | "missing">("all");
  const [bulk, setBulk] = useState("");
  const owned = useMemo(() => new Set(user.stash), [user.stash]);
  const list = searchFloss(DMC_BY_HUE, q).filter((f) => (show === "owned" ? owned.has(f.code) : show === "missing" ? !owned.has(f.code) : true));

  const toggle = (code: string) => {
    const next = new Set(owned);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    onSave({ ...user, stash: [...next] });
  };

  const addBulk = () => {
    const valid = new Set(DMC.map((f) => f.code.toLowerCase()));
    const byLower = new Map(DMC.map((f) => [f.code.toLowerCase(), f.code]));
    const codes = bulk.split(/[\s,;]+/).map((s) => s.trim().toLowerCase()).filter((s) => valid.has(s)).map((s) => byLower.get(s)!);
    onSave({ ...user, stash: [...new Set([...user.stash, ...codes])] });
    setBulk("");
  };

  return (
    <section className="panel stash">
      <div className="section-head">
        <div>
          <h2>Floss stash <span className="count">{user.stash.length} / {DMC.length}</span></h2>
          <p className="muted small">Tap colors you own. Patterns can be limited to only your stash so you don't need to buy anything.</p>
        </div>
        <div className="row gap wrap">
          <input className="search" placeholder="Search DMC # or name…" value={q} onChange={(e) => setQ(e.target.value)} />
          <Segmented value={show} onChange={setShow} options={[{ value: "all", label: "All" }, { value: "owned", label: "Owned" }, { value: "missing", label: "Not owned" }]} />
        </div>
      </div>
      <div className="row gap wrap bulk">
        <input placeholder="Paste DMC numbers, e.g. 310, 321, 666, B5200" value={bulk} onChange={(e) => setBulk(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addBulk()} />
        <button className="btn" onClick={addBulk} disabled={!bulk.trim()}>Add to stash</button>
        <button className="btn ghost" onClick={() => confirm("Clear your whole stash?") && onSave({ ...user, stash: [] })} disabled={!user.stash.length}>Clear</button>
      </div>
      <div className="floss-grid">
        {list.map((f) => (
          <FlossTile key={f.code} f={f} selected={owned.has(f.code)} onClick={() => toggle(f.code)} />
        ))}
      </div>
    </section>
  );
}
