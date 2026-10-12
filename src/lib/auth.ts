// Local-only accounts stored in localStorage. Passwords are salted + PBKDF2-hashed,
// but since everything lives in this browser this is profile separation, not real security.
import { DEFAULT_PREFS, type User } from "./types";
import { bytesToBase64 } from "./encoding";

const USERS_KEY = "stitchcraft.users";
const SESSION_KEY = "stitchcraft.session";

export function loadUsers(): User[] {
  try {
    const users = JSON.parse(localStorage.getItem(USERS_KEY) ?? "[]") as User[];
    return users.map((u) => ({ ...u, stash: u.stash ?? [], prefs: { ...DEFAULT_PREFS, ...u.prefs } }));
  } catch {
    return [];
  }
}

function saveUsers(users: User[]) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

async function hashPassword(password: string, salt: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: new TextEncoder().encode(salt), iterations: 120_000 },
    key,
    256,
  );
  return bytesToBase64(new Uint8Array(bits));
}

export function uid(): string {
  return crypto.randomUUID();
}

export async function signUp(username: string, displayName: string, password: string): Promise<User> {
  const name = username.trim().toLowerCase();
  if (!/^[a-z0-9_.-]{3,32}$/.test(name)) throw new Error("Username must be 3–32 letters, numbers, dots, dashes or underscores.");
  if (password.length < 6) throw new Error("Password must be at least 6 characters.");
  const users = loadUsers();
  if (users.some((u) => u.username === name)) throw new Error("That username is already taken on this device.");
  const salt = bytesToBase64(crypto.getRandomValues(new Uint8Array(16)));
  const user: User = {
    id: uid(),
    username: name,
    displayName: displayName.trim() || name,
    salt,
    passwordHash: await hashPassword(password, salt),
    createdAt: Date.now(),
    stash: [],
    prefs: { ...DEFAULT_PREFS },
  };
  saveUsers([...users, user]);
  localStorage.setItem(SESSION_KEY, user.id);
  return user;
}

export async function signIn(username: string, password: string): Promise<User> {
  const name = username.trim().toLowerCase();
  const user = loadUsers().find((u) => u.username === name);
  if (!user || (await hashPassword(password, user.salt)) !== user.passwordHash) {
    throw new Error("Incorrect username or password.");
  }
  localStorage.setItem(SESSION_KEY, user.id);
  return user;
}

export function currentUser(): User | null {
  const id = localStorage.getItem(SESSION_KEY);
  if (!id) return null;
  return loadUsers().find((u) => u.id === id) ?? null;
}

export function signOut() {
  localStorage.removeItem(SESSION_KEY);
}

export function updateUser(user: User) {
  saveUsers(loadUsers().map((u) => (u.id === user.id ? user : u)));
}

export async function changePassword(user: User, current: string, next: string): Promise<User> {
  if ((await hashPassword(current, user.salt)) !== user.passwordHash) throw new Error("Current password is incorrect.");
  if (next.length < 6) throw new Error("New password must be at least 6 characters.");
  const salt = bytesToBase64(crypto.getRandomValues(new Uint8Array(16)));
  const updated = { ...user, salt, passwordHash: await hashPassword(next, salt) };
  updateUser(updated);
  return updated;
}

export function deleteUser(user: User) {
  saveUsers(loadUsers().filter((u) => u.id !== user.id));
  signOut();
}
