import type { Catalog } from "../catalog/types.ts";
import { TONE_IDS } from "../design/directions.ts";
import type { Options } from "./types.ts";

const MAX_LENGTH_SLIDES = 60;
const MAX_CONTEXT_LENGTH = 2000;
const MAX_SEED = 4294967295;
export const MAX_FOOTER_TEXT = 40;

export type OptionsResult = { ok: true; options: Options } | { ok: false; errors: string[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function listOf(values: string[]): string {
  return values.length === 0 ? "none available" : values.join(", ");
}

export function validateOptions(input: unknown, catalog: Catalog): OptionsResult {
  if (!isRecord(input)) return { ok: false, errors: ["Options must be an object"] };
  const errors: string[] = [];

  const presentationTypes = [...new Set(catalog.structures.map((s) => s.presentationType))];
  const presentationType = input.presentationType;
  let typeValid = false;
  if (typeof presentationType !== "string") {
    errors.push("presentationType must be a string");
  } else if (!presentationTypes.includes(presentationType)) {
    errors.push(`presentationType "${presentationType}" is not in the catalog (available: ${listOf(presentationTypes)})`);
  } else {
    typeValid = true;
  }

  const objective = input.objective;
  if (typeof objective !== "string") {
    errors.push("objective must be a string");
  } else if (typeValid) {
    const objectives = catalog.structures.filter((s) => s.presentationType === presentationType).map((s) => s.objective);
    if (!objectives.includes(objective)) {
      errors.push(`objective "${objective}" is not available for presentationType "${String(presentationType)}" (available: ${listOf(objectives)})`);
    }
  }

  const lengthSlides = input.lengthSlides;
  if (typeof lengthSlides !== "number" || !Number.isInteger(lengthSlides) || lengthSlides < 1 || lengthSlides > MAX_LENGTH_SLIDES) {
    errors.push(`lengthSlides must be an integer from 1 to ${MAX_LENGTH_SLIDES}`);
  }

  const tone = input.tone;
  const tones = TONE_IDS;
  if (typeof tone !== "string" || !tones.includes(tone)) {
    errors.push(`tone must be a tone tag of a catalog theme (available: ${listOf(tones)})`);
  }

  const animation = input.animation;
  const animationIds = catalog.animations.map((a) => a.id);
  if (typeof animation !== "string" || !animationIds.includes(animation)) {
    errors.push(`animation must be an animation id in the catalog (available: ${listOf(animationIds)})`);
  }

  const aspect = input.aspect;
  if (aspect !== "16:9" && aspect !== "9:16") errors.push('aspect must be "16:9" or "9:16"');

  const mode = input.mode;
  if (mode !== "deterministic" && mode !== "creative") errors.push('mode must be "deterministic" or "creative"');

  const seed = input.seed;
  if (seed !== null && (typeof seed !== "number" || !Number.isInteger(seed) || seed < 0 || seed > MAX_SEED)) {
    errors.push(`seed must be null or an integer from 0 to ${MAX_SEED}`);
  }

  const context = input.context;
  if (typeof context !== "string") {
    errors.push("context must be a string");
  } else if (context.length > MAX_CONTEXT_LENGTH) {
    errors.push(`context must be at most ${MAX_CONTEXT_LENGTH} characters`);
  }

  const slideNumber = input.slideNumber;
  if (typeof slideNumber !== "boolean") errors.push("slideNumber must be true or false");

  const footerText = input.footerText;
  if (typeof footerText !== "string") {
    errors.push("footerText must be a string");
  } else if (footerText.length > MAX_FOOTER_TEXT) {
    errors.push(`footerText must be at most ${MAX_FOOTER_TEXT} characters`);
  }

  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    options: {
      presentationType: presentationType as string,
      objective: objective as string,
      lengthSlides: lengthSlides as number,
      tone: tone as string,
      animation: animation as string,
      aspect: aspect as Options["aspect"],
      mode: mode as Options["mode"],
      seed: seed as number | null,
      context: context as string,
      slideNumber: slideNumber as boolean,
      footerText: footerText as string,
    },
  };
}
