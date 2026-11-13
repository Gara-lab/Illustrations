import type { Catalog } from "../../catalog/types.ts";
import { TONE_IDS } from "../../design/directions.ts";

export interface Choice {
  id: string;
  label: string;
}

export interface OptionChoices {
  presentationTypes: Choice[];
  objectivesByType: Record<string, Choice[]>;
  tones: Choice[];
  animations: Choice[];
  aspects: Choice[];
  modes: Choice[];
}

const FIELD_LABELS: [string, string][] = [
  ["presentationType", "type"],
  ["objective", "objective"],
  ["lengthSlides", "length"],
  ["tone", "tone"],
  ["animation", "animation"],
  ["aspect", "aspect"],
  ["mode", "mode"],
  ["seed", "seed"],
  ["context", "context"],
  ["slideNumber", "slide number"],
  ["footerText", "footer text"]
];

export function labelOf(id: string): string {
  const spaced = id.replace(/-/g, " ").trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function choices(ids: string[]): Choice[] {
  return ids.map((id) => ({ id, label: labelOf(id) }));
}

export function optionChoices(catalog: Catalog): OptionChoices {
  const types = [...new Set(catalog.structures.map((s) => s.presentationType))];
  const objectivesByType: Record<string, Choice[]> = {};
  for (const type of types) {
    objectivesByType[type] = choices(catalog.structures.filter((s) => s.presentationType === type).map((s) => s.objective));
  }
  return {
    presentationTypes: choices(types),
    objectivesByType,
    tones: choices(TONE_IDS),
    animations: catalog.animations.map((a) => ({ id: a.id, label: a.name })),
    aspects: [
      { id: "16:9", label: "Landscape 16:9" },
      { id: "9:16", label: "Portrait 9:16" }
    ],
    modes: [
      { id: "deterministic", label: "Deterministic" },
      { id: "creative", label: "Creative" }
    ]
  };
}

export function plainError(message: string): string {
  let out = message;
  for (const [field, label] of FIELD_LABELS) out = out.split(field).join(label);
  return out.charAt(0).toUpperCase() + out.slice(1);
}
