import { useMemo, useState } from "react";
import { DMC, type Floss } from "../lib/dmc";
import { deltaE2000, hue, rgbToLab } from "../lib/color";
import { Modal, Swatch } from "./ui";

export const DMC_BY_HUE: Floss[] = [...DMC].sort((a, b) => {
  const ha = hue(a.r, a.g, a.b);
  const hb = hue(b.r, b.g, b.b);
  if (ha === -1 || hb === -1) return ha === hb ? b.r + b.g + b.b - (a.r + a.g + a.b) : ha === -1 ? 1 : -1;
  return Math.round(ha / 12) - Math.round(hb / 12) || b.r + b.g + b.b - (a.r + a.g + a.b);
});

export function searchFloss(list: Floss[], q: string): Floss[] {
  const s = q.trim().toLowerCase();
  if (!s) return list;
  return list.filter((f) => f.code.toLowerCase().startsWith(s) || f.name.toLowerCase().includes(s));
}

export default function FlossPicker({
  title,
  near,
  exclude = [],
  stash,
  onPick,
  onClose,
}: {
  title: string;
  near?: { r: number; g: number; b: number };
  exclude?: string[];
  stash?: string[];
  onPick: (f: Floss) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const [onlyStash, setOnlyStash] = useState(false);
  const owned = useMemo(() => new Set(stash ?? []), [stash]);
  const excluded = useMemo(() => new Set(exclude), [exclude]);

  const suggestions = useMemo(() => {
    if (!near) return [];
    const lab = rgbToLab(near.r, near.g, near.b);
    return DMC.filter((f) => !excluded.has(f.code))
      .map((f) => ({ f, d: deltaE2000(lab, rgbToLab(f.r, f.g, f.b)) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, 12)
      .map((x) => x.f);
  }, [near, excluded]);

  const list = searchFloss(DMC_BY_HUE, q).filter((f) => !excluded.has(f.code) && (!onlyStash || owned.has(f.code)));

  return (
    <Modal title={title} onClose={onClose} wide>
      <div className="picker-top">
        <input autoFocus className="search" placeholder="Search DMC number or color name…" value={q} onChange={(e) => setQ(e.target.value)} />
        {stash && stash.length > 0 && (
          <label className="check">
            <input type="checkbox" checked={onlyStash} onChange={(e) => setOnlyStash(e.target.checked)} /> Only floss I own
          </label>
        )}
      </div>
      {suggestions.length > 0 && !q && (
        <>
          <h4 className="picker-sub">Closest matches</h4>
          <div className="floss-grid">
            {suggestions.map((f) => (
              <FlossTile key={f.code} f={f} owned={owned.has(f.code)} onClick={() => onPick(f)} />
            ))}
          </div>
          <h4 className="picker-sub">All colors</h4>
        </>
      )}
      <div className="floss-grid">
        {list.map((f) => (
          <FlossTile key={f.code} f={f} owned={owned.has(f.code)} onClick={() => onPick(f)} />
        ))}
        {list.length === 0 && <p className="muted">No floss matches “{q}”.</p>}
      </div>
    </Modal>
  );
}

export function FlossTile({ f, owned, selected, onClick }: { f: Floss; owned?: boolean; selected?: boolean; onClick: () => void }) {
  return (
    <button className={"floss-tile" + (selected ? " selected" : "")} onClick={onClick} title={`DMC ${f.code} — ${f.name}`}>
      <Swatch r={f.r} g={f.g} b={f.b} size={28} />
      <span className="ft-code">{f.code}</span>
      <span className="ft-name">{f.name}</span>
      {owned && <span className="ft-owned" title="In your stash">●</span>}
    </button>
  );
}
