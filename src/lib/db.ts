// Project persistence in IndexedDB (browser-local, survives reloads; images are too big for localStorage).
import type { Project } from "./types";

const DB_NAME = "stitchcraft";
const STORE = "projects";
let dbPromise: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const store = req.result.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("ownerId", "ownerId");
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = fn(t.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
  );
}

export const listProjects = (ownerId: string) =>
  tx<Project[]>("readonly", (s) => s.index("ownerId").getAll(ownerId)).then((ps) =>
    ps.sort((a, b) => b.updatedAt - a.updatedAt),
  );
export const getProject = (id: string) => tx<Project | undefined>("readonly", (s) => s.get(id));
export const putProject = (p: Project) => tx("readwrite", (s) => s.put(p)).then(() => undefined);
export const deleteProject = (id: string) => tx("readwrite", (s) => s.delete(id)).then(() => undefined);

export async function deleteProjectsFor(ownerId: string) {
  const ps = await listProjects(ownerId);
  await Promise.all(ps.map((p) => deleteProject(p.id)));
}
