import { uid } from "./auth";
import { putProject } from "./db";
import { readImageFile } from "./image";
import { recommendedStrands } from "./stats";
import { FABRIC_COLORS, type PatternSettings, type Project, type User } from "./types";

export function defaultSettings(user: User, imgW: number, imgH: number): PatternSettings {
  const width = user.prefs.defaultWidth;
  return {
    width,
    height: Math.max(1, Math.round((width * imgH) / imgW)),
    lockAspect: true,
    maxColors: user.prefs.defaultMaxColors,
    fabricCount: user.prefs.defaultFabricCount,
    strands: recommendedStrands(user.prefs.defaultFabricCount),
    fabricColor: FABRIC_COLORS[0].hex,
    dither: "none",
    ditherStrength: 0.6,
    metric: "ciede2000",
    brightness: 0,
    contrast: 0,
    saturation: 0,
    sharpen: 0,
    confetti: 1,
    minStitches: 4,
    stashOnly: false,
    transparentAsEmpty: true,
    crop: { x: 0, y: 0, w: 1, h: 1 },
  };
}

export async function createProjectFromFile(user: User, file: File): Promise<Project> {
  const img = await readImageFile(file);
  const name = (file.name || "Untitled pattern").replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ").trim() || "Untitled pattern";
  const now = Date.now();
  const project: Project = {
    id: uid(),
    ownerId: user.id,
    name: name.charAt(0).toUpperCase() + name.slice(1),
    createdAt: now,
    updatedAt: now,
    source: img.dataUrl,
    sourceWidth: img.width,
    sourceHeight: img.height,
    thumbnail: img.dataUrl,
    settings: defaultSettings(user, img.width, img.height),
    pattern: null,
    stitched: "",
    edited: false,
    notes: "",
  };
  await putProject(project);
  return project;
}

export async function importProjectJson(user: User, file: File): Promise<Project> {
  const data = JSON.parse(await file.text());
  if (data?.format !== "stitchcraft-project" || !data.project?.source) throw new Error("That isn't a Stitchcraft project file.");
  const p = data.project as Project;
  const project: Project = { ...p, id: uid(), ownerId: user.id, updatedAt: Date.now(), name: p.name + " (imported)" };
  await putProject(project);
  return project;
}
