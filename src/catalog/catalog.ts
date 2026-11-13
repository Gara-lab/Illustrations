import animationsJson from "./data/animations.json" with { type: "json" };
import structuresJson from "./data/structures.json" with { type: "json" };
import transitionsJson from "./data/transitions.json" with { type: "json" };
import type { Catalog } from "./types.ts";

const REQUIRED_ANIMATIONS = ["none", "fade", "slide-up", "slide-left", "zoom"];
const REQUIRED_TRANSITIONS = ["none", "fade", "slide"];

type Obj = Record<string, unknown>;

function isObj(v: unknown): v is Obj {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function objs(v: unknown, label: string, errors: string[]): Obj[] {
  if (!Array.isArray(v)) {
    errors.push(`${label} must be a list.`);
    return [];
  }
  const good = v.filter(isObj);
  if (good.length !== v.length) errors.push(`${label} contains an entry that is not an object.`);
  return good;
}

function idOf(o: Obj): string {
  return typeof o.id === "string" ? o.id : "(no id)";
}

function checkId(o: Obj, label: string, errors: string[]): void {
  if (typeof o.id !== "string" || o.id === "") errors.push(`A ${label} has no id.`);
}

function duplicates(ids: string[]): string[] {
  return ids.filter((id, i) => ids.indexOf(id) !== i);
}

export function validateCatalog(input: Catalog): string[] {
  const errors: string[] = [];
  const c = (isObj(input) ? input : {}) as Obj;
  const structures = objs(c.structures, "structures", errors);
  const animations = objs(c.animations, "animations", errors);
  const transitions = objs(c.transitions, "transitions", errors);
  const unique = (label: string, list: Obj[]) => {
    list.forEach((o) => checkId(o, label, errors));
    for (const d of duplicates(list.map(idOf))) errors.push(`Duplicate ${label} id "${d}".`);
  };
  unique("structure", structures);
  unique("animation", animations);
  unique("transition", transitions);

  for (const s of structures) {
    const where = `Structure "${idOf(s)}"`;
    const roles = objs(s.roles, `${where}: roles`, errors);
    if (roles.length === 0) errors.push(`${where}: has no roles.`);
  }

  for (const id of REQUIRED_ANIMATIONS) if (!animations.some((a) => a.id === id)) errors.push(`Animation "${id}" is missing.`);
  for (const id of REQUIRED_TRANSITIONS) if (!transitions.some((t) => t.id === id)) errors.push(`Transition "${id}" is missing.`);
  return [...new Set(errors)];
}

export function loadCatalog(): Catalog {
  const catalog: Catalog = {
    structures: structuredClone(structuresJson) as unknown as Catalog["structures"],
    animations: structuredClone(animationsJson) as unknown as Catalog["animations"],
    transitions: structuredClone(transitionsJson) as unknown as Catalog["transitions"],
  };
  const errors = validateCatalog(catalog);
  if (errors.length > 0) throw new Error(`Catalog data is invalid:\n- ${errors.join("\n- ")}`);
  return catalog;
}
