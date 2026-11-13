import type { AssetAddOutcome, ProjectOpenOutcome, ProjectSaveOutcome } from "../app/shared/api-types.ts";
import type { AssetStore, Deck } from "../model/deck.ts";
import { inspectImage } from "../storage/image-info.ts";
import { MAX_ASSET_BYTES, defaultProjectName, openProjectBytes, sanitiseAssetName, saveProjectBytes } from "../storage/project-bytes.ts";
import type { FilePorts } from "./web-files.ts";

const PROJECT_ACCEPT = ".deck";
const IMAGE_ACCEPT = ".png,.jpg,.jpeg,.gif,.webp";
const TEXT_ACCEPT = ".md,.txt,.json,text/plain,text/markdown,application/json";
const PROJECT_MIME = "application/zip";

export interface WebProject {
  assets: AssetStore;
  reset(): void;
  projectOpen(): Promise<ProjectOpenOutcome>;
  projectSave(file: string | null, deck: Deck): Promise<ProjectSaveOutcome>;
  assetAdd(): Promise<AssetAddOutcome>;
  loadTextFile(): Promise<{ name: string; text: string } | null>;
}

function message(error: unknown): string {
  return error instanceof Error && error.message !== "" ? error.message : "Unknown error";
}

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && a.every((value, i) => value === b[i]);
}

function projectName(file: string | null, deck: Deck): string {
  const name = (file ?? "").replaceAll("\\", "/").split("/").pop() ?? "";
  return name.toLowerCase().endsWith(".deck") && name.length > 5 ? name : defaultProjectName(deck.title);
}

export function createWebProject(ports: FilePorts, base: AssetStore): WebProject {
  let opened: AssetStore | null = null;
  const added = new Map<string, { mime: string; data: Uint8Array }>();
  const assets: AssetStore = { get: (id) => added.get(id) ?? (opened ?? base).get(id) };

  return {
    assets,
    reset() {
      opened = null;
      added.clear();
    },
    async projectOpen() {
      try {
        const picked = await ports.pick(PROJECT_ACCEPT);
        if (!picked) return { ok: false, cancelled: true };
        const project = await openProjectBytes(picked.bytes, picked.name);
        opened = project.assets;
        added.clear();
        return { ok: true, file: picked.name, deck: project.deck, assetIds: project.assetIds, missingAssetIds: project.missingAssetIds };
      } catch (error) {
        return { ok: false, error: message(error) };
      }
    },
    async projectSave(file, deck) {
      try {
        const bytes = await saveProjectBytes(deck, assets);
        const name = projectName(file, deck);
        ports.save(name, bytes, PROJECT_MIME);
        return { ok: true, file: name };
      } catch (error) {
        return { ok: false, error: message(error) };
      }
    },
    async assetAdd() {
      let picked;
      try {
        picked = await ports.pick(IMAGE_ACCEPT);
      } catch {
        return { ok: false, error: "The image could not be read, so it was not added" };
      }
      if (!picked) return { ok: false, cancelled: true };
      const { name, bytes } = picked;
      if (bytes.length > MAX_ASSET_BYTES) return { ok: false, error: `The image is larger than ${MAX_ASSET_BYTES / 1024 / 1024} MB, so it was not added` };
      let stem: string;
      try {
        stem = sanitiseAssetName(name).stem;
      } catch {
        return { ok: false, error: `Cannot add "${name}": only png, jpg, jpeg, webp and gif images are supported` };
      }
      const info = inspectImage(bytes);
      if (!info) return { ok: false, error: `"${name}" is not a readable png, jpg, webp or gif image, so it was not added` };
      if (!(info.w >= 1 && info.h >= 1)) return { ok: false, error: `The image "${name}" has no size and may be damaged, so it was not added` };
      for (let n = 1; ; n++) {
        const id = n === 1 ? stem : `${stem}-${n}`;
        const taken = assets.get(id);
        if (taken) {
          if (taken.mime === info.mime && sameBytes(taken.data, bytes)) return { ok: true, id, w: info.w, h: info.h };
          continue;
        }
        added.set(id, { mime: info.mime, data: bytes });
        return { ok: true, id, w: info.w, h: info.h };
      }
    },
    async loadTextFile() {
      try {
        const picked = await ports.pick(TEXT_ACCEPT);
        return picked ? { name: picked.name, text: new TextDecoder().decode(picked.bytes) } : null;
      } catch {
        return null;
      }
    }
  };
}
