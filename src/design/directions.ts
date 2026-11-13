import { audienceOf } from "./bias.ts";
import type { IconFamily } from "../catalog/icon-catalog.ts";

export type DirectionId = "editorial" | "bold" | "technical";

export const DIRECTIONS: { id: DirectionId; label: string }[] = [
  { id: "editorial", label: "Editorial" },
  { id: "bold", label: "Bold geometric" },
  { id: "technical", label: "Quiet technical" }
];

export const DIRECTION_CHOICES: { id: string; label: string }[] = [{ id: "auto", label: "Automatic (from tone and mood)" }, ...DIRECTIONS];

const TONES: Record<DirectionId, string[]> = {
  editorial: ["professional", "corporate", "formal", "elegant", "premium", "creative"],
  bold: ["playful", "friendly", "fun", "bold", "energetic", "launch"],
  technical: ["minimal", "clean", "simple", "technical", "data", "engineering"]
};

export const TONE_IDS: string[] = Object.values(TONES).flat();

function directionOf(word: string): DirectionId | undefined {
  return DIRECTIONS.find((d) => TONES[d.id].includes(word.trim().toLowerCase()))?.id;
}

export function pickDirection(tone: string, mood: string[] = [], audience?: string): DirectionId {
  const fromMood = mood.map(directionOf).find((id) => id !== undefined);
  if (fromMood !== undefined) return fromMood;
  if (audienceOf(audience) === "technical") return "technical";
  return directionOf(tone) ?? "editorial";
}

export type FieldKind = "base" | "inverse" | "punch";
export type CardKind = "rule" | "solid" | "outline";

export type FillStyle = "flat" | "gradient" | "translucent";
export interface ShadowSpec { dx: number; dy: number; blur: number; alpha: number }
export interface EffectScheme {
  line: number;
  stroke: number;
  ruleAlpha: number;
  fill: FillStyle;
  fillAlpha: number;
  shadow: ShadowSpec | null;
}

export interface DirSpec {
  id: DirectionId;
  ratio: number;
  headTop: number;
  headFonts: string[];
  headBold: boolean;
  bodyFont: string;
  labelFont: string;
  labelBold: boolean;
  labelUpper: boolean;
  figureFont: string;
  figureBold: boolean;
  margins: number[];
  card: CardKind;
  titleField: FieldKind;
  sectionField: FieldKind;
  closingField: FieldKind;
  fx: EffectScheme;
  iconFamily: IconFamily;
}

export const SPECS: Record<DirectionId, DirSpec> = {
  editorial: {
    id: "editorial",
    ratio: 4 / 3,
    headTop: 5,
    headFonts: ["Playfair Display", "Lora"],
    headBold: false,
    bodyFont: "Inter",
    labelFont: "Inter",
    labelBold: true,
    labelUpper: true,
    figureFont: "Playfair Display",
    figureBold: false,
    margins: [80, 96, 64],
    card: "rule",
    titleField: "base",
    sectionField: "inverse",
    closingField: "inverse",
    iconFamily: "phosphor-regular",
    fx: { line: 2, stroke: 2, ruleAlpha: 0.3, fill: "translucent", fillAlpha: 0.6, shadow: { dx: 0, dy: 12, blur: 32, alpha: 0.18 } }
  },
  bold: {
    id: "bold",
    ratio: 4 / 3,
    headTop: 6,
    headFonts: ["Poppins"],
    headBold: true,
    bodyFont: "Inter",
    labelFont: "Poppins",
    labelBold: true,
    labelUpper: true,
    figureFont: "Poppins",
    figureBold: true,
    margins: [64, 72],
    card: "solid",
    titleField: "punch",
    sectionField: "punch",
    closingField: "punch",
    iconFamily: "phosphor-duotone",
    fx: { line: 4, stroke: 4, ruleAlpha: 1, fill: "flat", fillAlpha: 1, shadow: { dx: 8, dy: 8, blur: 0, alpha: 0.4 } }
  },
  technical: {
    id: "technical",
    ratio: 1.25,
    headTop: 5,
    headFonts: ["Inter"],
    headBold: true,
    bodyFont: "Inter",
    labelFont: "JetBrains Mono",
    labelBold: false,
    labelUpper: true,
    figureFont: "JetBrains Mono",
    figureBold: true,
    margins: [64, 80],
    card: "outline",
    titleField: "inverse",
    sectionField: "base",
    closingField: "inverse",
    iconFamily: "lucide",
    fx: { line: 1, stroke: 1, ruleAlpha: 0.35, fill: "gradient", fillAlpha: 1, shadow: null }
  }
};

export type SchemeId = "mono" | "analogous" | "complementary" | "split" | "triadic" | "tetradic" | "duotone";
export type TierId = "low" | "mid" | "high";

export interface PaletteSpec {
  salt: number;
  hueWeights: number[];
  schemes: [SchemeId, number][];
  tiers: [TierId, number][];
  darkShare: number;
  neutralHue: number | null;
  neutralChroma: number;
  fillL: { light: [number, number]; dark: [number, number] };
}

export const PALETTE_SPECS: Record<DirectionId, PaletteSpec> = {
  editorial: {
    salt: 101,
    hueWeights: [2, 2, 3, 3, 2, 1, 1, 1, 1, 2, 2, 2, 1, 1, 2, 3, 3, 3, 3, 2, 2, 2, 2, 2],
    schemes: [["mono", 5], ["analogous", 4], ["complementary", 2], ["split", 2], ["triadic", 1], ["tetradic", 1]],
    tiers: [["low", 4], ["mid", 5], ["high", 1]],
    darkShare: 0.2,
    neutralHue: 75,
    neutralChroma: 0.012,
    fillL: { light: [0.44, 0.54], dark: [0.66, 0.76] }
  },
  bold: {
    salt: 202,
    hueWeights: [2, 2, 3, 3, 3, 2, 1, 1, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 2],
    schemes: [["mono", 1], ["analogous", 2], ["complementary", 4], ["split", 3], ["triadic", 4], ["tetradic", 2], ["duotone", 4]],
    tiers: [["low", 1], ["mid", 3], ["high", 6]],
    darkShare: 0.5,
    neutralHue: null,
    neutralChroma: 0.02,
    fillL: { light: [0.55, 0.65], dark: [0.72, 0.8] }
  },
  technical: {
    salt: 303,
    hueWeights: [1, 1, 2, 2, 2, 1, 1, 1, 1, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 2, 2, 1, 1, 1],
    schemes: [["mono", 8], ["analogous", 3], ["complementary", 2], ["split", 1], ["triadic", 1]],
    tiers: [["low", 2], ["mid", 3], ["high", 5]],
    darkShare: 0.5,
    neutralHue: 255,
    neutralChroma: 0.006,
    fillL: { light: [0.5, 0.6], dark: [0.7, 0.78] }
  }
};
