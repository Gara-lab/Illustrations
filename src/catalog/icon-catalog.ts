import metaJson from "./data/icon-meta.json" with { type: "json" };
import lucideJson from "./data/icon-paths-lucide.json" with { type: "json" };
import duotoneJson from "./data/icon-paths-phosphor-duotone.json" with { type: "json" };
import regularJson from "./data/icon-paths-phosphor-regular.json" with { type: "json" };
import type { PathCommand } from "../model/deck.ts";

export const ICON_NONE = "none";

export type IconFamily = "lucide" | "phosphor-regular" | "phosphor-duotone";

export interface IconLayer {
  commands: PathCommand[];
  mode: "fill" | "stroke";
  alpha?: number;
}

export type IconLang = "en" | "fr";

interface IconMeta {
  id: string;
  lucide?: string;
  phosphor?: string;
  category?: string;
  en: string[];
  fr: string[];
  words?: string[];
}

const FALLBACK: Record<IconFamily, IconFamily> = { lucide: "phosphor-regular", "phosphor-regular": "lucide", "phosphor-duotone": "lucide" };

const META = metaJson as IconMeta[];
const BY_ID = new Map<string, IconMeta>(META.map((m) => [m.id, m]));
const ALIASES = new Map<string, string>();
for (const m of META) {
  if (m.lucide !== undefined && m.lucide !== m.id) ALIASES.set(m.lucide, m.id);
}

export const ICON_IDS: readonly string[] = META.map((m) => m.id);

const PATHS: Record<IconFamily, Record<string, IconLayer[]>> = {
  lucide: lucideJson as unknown as Record<string, IconLayer[]>,
  "phosphor-regular": regularJson as unknown as Record<string, IconLayer[]>,
  "phosphor-duotone": duotoneJson as unknown as Record<string, IconLayer[]>
};

export function iconId(name: string): string | null {
  if (BY_ID.has(name)) return name;
  return ALIASES.get(name) ?? null;
}

export function hasIcon(id: string, family: IconFamily): boolean {
  return PATHS[family][id] !== undefined;
}

export function iconLayers(id: string, family: IconFamily): readonly IconLayer[] | null {
  return PATHS[family][id] ?? PATHS[FALLBACK[family]][id] ?? null;
}

export function iconKeywords(id: string, lang: IconLang): readonly string[] {
  const m = BY_ID.get(id);
  if (m === undefined) return [];
  return [...new Set([...m[lang], ...(m.words ?? [])])];
}
