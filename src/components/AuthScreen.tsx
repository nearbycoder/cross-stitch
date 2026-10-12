import { useState, type FormEvent } from "react";
import { loadUsers, signIn, signUp } from "../lib/auth";
import type { User } from "../lib/types";
import { Logo } from "./ui";

export default function AuthScreen({ onAuthed }: { onAuthed: (u: User) => void }) {
  const [mode, setMode] = useState<"signin" | "signup">(() => (loadUsers().length ? "signin" : "signup"));
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      onAuthed(mode === "signin" ? await signIn(username, password) : await signUp(username, displayName, password));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      <div className="auth-art" aria-hidden>
        <div className="auth-art-inner">
          <h1>Turn any picture into a pattern you can stitch.</h1>
          <ul>
            <li>Matched to 450+ real DMC floss colors</li>
            <li>Symbol charts, legend, skein counts & printable PDF</li>
            <li>Edit stitches, swap colors & track your progress</li>
          </ul>
        </div>
      </div>
      <div className="auth-panel">
        <form className="auth-card" onSubmit={submit}>
          <div className="brand big">
            <Logo size={40} /> <span>Stitchcraft</span>
          </div>
          <h2>{mode === "signin" ? "Welcome back" : "Create your account"}</h2>
          <p className="muted">
            Accounts and patterns are saved privately in this browser — nothing is uploaded to a server.
          </p>
          <label className="field">
            <span className="field-label">Username</span>
            <input autoFocus autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} required />
          </label>
          {mode === "signup" && (
            <label className="field">
              <span className="field-label">Display name <em>(optional)</em></span>
              <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            </label>
          )}
          <label className="field">
            <span className="field-label">Password</span>
            <input
              type="password"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          {error && <div className="error">{error}</div>}
          <button className="btn primary block" disabled={busy}>
            {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
          </button>
          <p className="switch">
            {mode === "signin" ? "New here?" : "Already have an account?"}{" "}
            <button type="button" className="link" onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(""); }}>
              {mode === "signin" ? "Create an account" : "Sign in"}
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}
