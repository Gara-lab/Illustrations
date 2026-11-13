import JSZip from "jszip";
import { validateDeck } from "../model/deck.ts";
import type { AssetStore, Deck } from "../model/deck.ts";

export interface OpenedProject {
  deck: Deck;
  assets: AssetStore;
  assetIds: string[];
  missingAssetIds: string[];
}

const PROJECT_EXT = ".deck";
const DECK_ENTRY = "deck.json";
const ASSETS_PREFIX = "assets/";
const SUPPORTED_VERSION = 1;
export const MAX_ASSET_BYTES = 25 * 1024 * 1024;
const MAX_PROJECT_BYTES = 600 * 1024 * 1024;
const MAX_ENTRIES = 1000;
const MAX_TOTAL_BYTES = 300 * 1024 * 1024;

export interface StoreLimits {
  totalBytes: number;
}

const MIME_BY_EXT: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml"
};

const EXT_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/svg+xml": "svg"
};

const EXTS = Object.keys(MIME_BY_EXT);
const RESERVED = /^(con|prn|aux|nul|com\d|lpt\d)$/i;
const ID_OK = /^[A-Za-z0-9_-]+$/;
const ASSET_ENTRY = /^assets\/([A-Za-z0-9_-]+)\.([A-Za-z0-9]+)$/;

function baseName(path: string): string {
  const parts = path.replaceAll("\\", "/").split("/");
  return parts[parts.length - 1] ?? "";
}

function checkName(name: string): void {
  if (!name.toLowerCase().endsWith(PROJECT_EXT) || baseName(name).length <= PROJECT_EXT.length) throw new Error(`A project file must end with ${PROJECT_EXT}`);
}

export function sanitiseAssetName(name: string): { stem: string; ext: string } {
  const last = baseName(name);
  const dot = last.lastIndexOf(".");
  const rawExt = dot > 0 ? last.slice(dot + 1).toLowerCase() : "";
  if (!EXTS.includes(rawExt)) {
    throw new Error(`Cannot add "${last}": only png, jpg, jpeg, gif, webp and svg images are supported`);
  }
  let stem = last
    .slice(0, dot)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  if (stem === "") stem = "image";
  if (RESERVED.test(stem)) stem = `_${stem}`;
  return { stem, ext: rawExt };
}

export function defaultProjectName(title: unknown): string {
  let stem = (typeof title === "string" ? title : "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9 _-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60)
    .trim();
  if (stem === "") stem = "Presentation";
  if (RESERVED.test(stem)) stem = `_${stem}`;
  return `${stem}${PROJECT_EXT}`;
}

export function collectAssetIds(value: unknown, found: Set<string> = new Set()): Set<string> {
  if (Array.isArray(value)) {
    for (const item of value) collectAssetIds(item, found);
  } else if (typeof value === "object" && value !== null) {
    for (const [key, item] of Object.entries(value)) {
      if (key === "assetId" && typeof item === "string") found.add(item);
      else collectAssetIds(item, found);
    }
  }
  return found;
}

function unsafeName(name: string): boolean {
  return name.startsWith("/") || name.includes("\\") || /^[A-Za-z]:/.test(name) || name.split("/").includes("..");
}

async function readZip(bytes: Uint8Array, name: string): Promise<JSZip> {
  if (bytes.length > MAX_PROJECT_BYTES) throw new Error("The project file is too large to open");
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(bytes);
  } catch {
    throw new Error(`The file ${baseName(name)} is damaged or is not a project file`);
  }
  const names = Object.keys(zip.files);
  if (names.length > MAX_ENTRIES) throw new Error("The project file has too many entries to be a valid project");
  if (names.some(unsafeName)) throw new Error("The project file contains an unsafe entry name, so it was not opened");
  return zip;
}

interface ZipStream {
  on(event: "data", handler: (chunk: Uint8Array) => void): ZipStream;
  on(event: "error", handler: (error: Error) => void): ZipStream;
  on(event: "end", handler: () => void): ZipStream;
  pause(): ZipStream;
  resume(): ZipStream;
}

interface Budget {
  left: number;
}

function inflateCapped(entry: JSZip.JSZipObject, name: string, limit: number, budget: Budget): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const chunks: Uint8Array[] = [];
    let total = 0;
    let finished = false;
    const stream = (entry as unknown as { internalStream(type: string): ZipStream }).internalStream("uint8array");
    const fail = (error: Error): void => {
      if (finished) return;
      finished = true;
      stream.pause();
      reject(error);
    };
    stream.on("data", (chunk: Uint8Array) => {
      if (finished) return;
      total += chunk.length;
      budget.left -= chunk.length;
      if (total > limit) return fail(new Error(`The entry ${name} in the project file is too large`));
      if (budget.left < 0) return fail(new Error("The project file expands to far more data than a project should hold, so it was not opened"));
      chunks.push(chunk);
    });
    stream.on("error", (error: Error) => fail(error instanceof Error ? error : new Error(String(error))));
    stream.on("end", () => {
      if (finished) return;
      finished = true;
      const out = new Uint8Array(total);
      let at = 0;
      for (const chunk of chunks) {
        out.set(chunk, at);
        at += chunk.length;
      }
      resolve(out);
    });
    stream.resume();
  });
}

async function entryBytes(zip: JSZip, name: string, limit: number, budget: Budget): Promise<Uint8Array> {
  const entry = zip.file(name);
  if (!entry) throw new Error(`The project file has no ${name}`);
  return inflateCapped(entry, name, limit, budget);
}

function assetEntries(zip: JSZip): { id: string; ext: string; name: string }[] {
  const found: { id: string; ext: string; name: string }[] = [];
  for (const name of Object.keys(zip.files)) {
    const match = ASSET_ENTRY.exec(name);
    const ext = match?.[2]?.toLowerCase();
    if (match && ext && EXTS.includes(ext) && !zip.files[name]?.dir) found.push({ id: match[1] as string, ext, name });
  }
  return found.sort((a, b) => a.name.localeCompare(b.name));
}

export async function openProjectBytes(bytes: Uint8Array, name: string, limits: StoreLimits = { totalBytes: MAX_TOTAL_BYTES }): Promise<OpenedProject> {
  checkName(name);
  const zip = await readZip(bytes, name);
  const budget: Budget = { left: limits.totalBytes };
  if (!zip.file(DECK_ENTRY)) throw new Error(`The project file has no ${DECK_ENTRY}, so it is not a project`);
  const text = new TextDecoder().decode(await entryBytes(zip, DECK_ENTRY, MAX_ASSET_BYTES, budget));
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error(`The ${DECK_ENTRY} inside the project file is damaged and cannot be read as JSON`);
  }
  const version = (raw as { version?: unknown } | null)?.version;
  if (typeof raw === "object" && raw !== null && version !== SUPPORTED_VERSION) {
    throw new Error(`This project uses file version ${JSON.stringify(version)}, but this app only reads version ${SUPPORTED_VERSION}. The file was left unchanged`);
  }
  const valid = validateDeck(raw);
  if (!valid.ok) {
    const shown = valid.errors.slice(0, 5).join("; ");
    const more = valid.errors.length > 5 ? ` (and ${valid.errors.length - 5} more)` : "";
    throw new Error(`The ${DECK_ENTRY} inside the project file is not a valid deck: ${shown}${more}`);
  }
  const loaded = new Map<string, { mime: string; data: Uint8Array }>();
  for (const entry of assetEntries(zip)) {
    if (loaded.has(entry.id)) continue;
    loaded.set(entry.id, { mime: MIME_BY_EXT[entry.ext] as string, data: await entryBytes(zip, entry.name, MAX_ASSET_BYTES, budget) });
  }
  const missingAssetIds = [...collectAssetIds(valid.deck)].filter((id) => !loaded.has(id)).sort();
  return { deck: valid.deck, assets: { get: (id) => loaded.get(id) ?? null }, assetIds: [...loaded.keys()].sort(), missingAssetIds };
}

export async function saveProjectBytes(deck: Deck, assets: AssetStore): Promise<Uint8Array> {
  const valid = validateDeck(deck);
  if (!valid.ok) throw new Error(`The deck is not valid and was not saved: ${valid.errors.slice(0, 5).join("; ")}`);
  const zip = new JSZip();
  zip.file(DECK_ENTRY, `${JSON.stringify(valid.deck, null, 2)}
`);
  for (const id of [...collectAssetIds(valid.deck)].sort()) {
    const asset = assets.get(id);
    if (!asset) throw new Error(`The image "${id}" used by the deck was not found anywhere, so nothing was saved`);
    const ext = EXT_BY_MIME[asset.mime] ?? "png";
    if (!ID_OK.test(id) || sanitiseAssetName(`${id}.${ext}`).stem !== id) {
      throw new Error(`The image id "${id}" cannot be stored in a project file (use only letters, digits, hyphen and underscore), so nothing was saved`);
    }
    if (asset.data.length > MAX_ASSET_BYTES) throw new Error(`The image "${id}" is larger than ${MAX_ASSET_BYTES / 1024 / 1024} MB, so nothing was saved`);
    zip.file(`${ASSETS_PREFIX}${id}.${ext}`, asset.data, { compression: "STORE" });
  }
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}
