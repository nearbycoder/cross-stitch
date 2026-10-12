import { useState } from "react";
import { currentUser, signOut } from "./lib/auth";
import { navigate, useRoute } from "./lib/router";
import type { User } from "./lib/types";
import AuthScreen from "./components/AuthScreen";
import Dashboard from "./components/Dashboard";
import Editor from "./components/Editor";
import Account from "./components/Account";
import { Logo } from "./components/ui";

export default function App() {
  const [user, setUser] = useState<User | null>(currentUser);
  const route = useRoute();

  if (!user) return <AuthScreen onAuthed={setUser} />;

  if (route.name === "project") return <Editor key={route.id} id={route.id} user={user} onUserChange={setUser} />;

  return (
    <div className="shell">
      <header className="topbar">
        <a className="brand" href="#/">
          <Logo /> <span>Stitchcraft</span>
        </a>
        <nav>
          <a href="#/" className={route.name === "dashboard" ? "active" : ""}>Patterns</a>
          <a href="#/account" className={route.name === "account" ? "active" : ""}>Account & floss stash</a>
        </nav>
        <div className="user-chip">
          <span className="avatar">{user.displayName.charAt(0).toUpperCase()}</span>
          <span>{user.displayName}</span>
          <button
            className="btn ghost sm"
            onClick={() => {
              signOut();
              setUser(null);
              navigate("/");
            }}
          >
            Sign out
          </button>
        </div>
      </header>
      {route.name === "account" ? (
        <Account user={user} onChange={setUser} onDeleted={() => setUser(null)} />
      ) : (
        <Dashboard user={user} />
      )}
    </div>
  );
}
