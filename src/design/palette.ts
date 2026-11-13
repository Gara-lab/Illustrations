import { createRng } from "../seed/rng.ts";
import type { Rng } from "../seed/rng.ts";
import { PALETTE_SPECS } from "./directions.ts";
import type { DirectionId, PaletteSpec, SchemeId, TierId } from "./directions.ts";

export interface Field {
  bg: string;
  surface: string;
  ink: string;
  muted: string;
  accent: string;
  accent2: string;
  accentInk: string;
  onAccent: string;
  onAccent2: string;
}

export interface Palette {
  base: Field;
  inverse: Field;
  punch: Field;
  dark: boolean;
  family: number;
  hue: number;
  scheme: SchemeId;
  tier: TierId;
}

type Lch = [number, number, number];

const RAD = Math.PI / 180;
const wrap = (h: number): number => ((h % 360) + 360) % 360;
const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));
const hueDistance = (a: number, b: number): number => Math.abs(((a - b + 540) % 360) - 180);
const inBand = (h: number, lo: number, hi: number): boolean => h >= lo && h <= hi;

const SCHEMES: Record<SchemeId, { offsets: number[]; chroma: number }> = {
  mono: { offsets: [0], chroma: 0.6 },
  analogous: { offsets: [-30, 30], chroma: 0.85 },
  complementary: { offsets: [180], chroma: 0.7 },
  split: { offsets: [150, 210], chroma: 0.8 },
  triadic: { offsets: [120, 240], chroma: 0.8 },
  tetradic: { offsets: [60, 240], chroma: 0.75 },
  duotone: { offsets: [180], chroma: 1 }
};

const TIER_CHROMA: Record<TierId, [number, number]> = { low: [0.05, 0.07], mid: [0.11, 0.13], high: [0.19, 0.22] };

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const toLinear = (v: number): number => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const fromLinear = (v: number): number => (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.max(v, 0) ** (1 / 2.4) - 0.055);

function linearRgb(L: number, C: number, h: number): [number, number, number] {
  const a = C * Math.cos(h * RAD);
  const b = C * Math.sin(h * RAD);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s
  ];
}

export function hexToOklab(hex: string): [number, number, number] {
  const [r, g, b] = hexToRgb(hex).map((v) => toLinear(v / 255)) as [number, number, number];
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  ];
}

export function maxChroma(L: number, h: number): number {
  if (L <= 0 || L >= 1) return 0;
  let lo = 0;
  let hi = 0.4;
  for (let i = 0; i < 22; i++) {
    const mid = (lo + hi) / 2;
    if (linearRgb(L, mid, h).every((v) => v >= -0.00001 && v <= 1.00001)) lo = mid;
    else hi = mid;
  }
  return lo;
}

const fit = (L: number, C: number, h: number): number => Math.min(C, 0.95 * maxChroma(L, h));

export function oklchToHex(L: number, C: number, h: number): string {
  const l = clamp(L, 0, 1);
  const rgb = linearRgb(l, Math.max(0, fit(l, C, h)), h);
  return `#${rgb.map((v) => Math.round(clamp(fromLinear(v), 0, 1) * 255).toString(16).padStart(2, "0").toUpperCase()).join("")}`;
}

function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => toLinear(v / 255)) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

const passes = (hex: string, backs: string[], min: number): boolean => backs.every((b) => contrast(hex, b) >= min);

export function settleLightness(L: number, C: number, h: number, backs: string[], min: number, lighten: boolean): string {
  const end = lighten ? 1 : 0;
  let c = C;
  for (let step = 0; step < 14; step++) {
    const start = oklchToHex(L, c, h);
    if (passes(start, backs, min)) return start;
    if (passes(oklchToHex(end, c, h), backs, min)) {
      let lo = L;
      let hi = end;
      for (let i = 0; i < 22; i++) {
        const mid = (lo + hi) / 2;
        if (passes(oklchToHex(mid, c, h), backs, min)) hi = mid;
        else lo = mid;
      }
      return oklchToHex(hi, c, h);
    }
    c = step === 12 ? 0 : c * 0.9;
  }
  throw new Error(`No colour reaches contrast ${min} on ${backs.join(", ")}`);
}

function bestOn(fill: string, preferred: string[]): string {
  for (const c of [...preferred, "#000000", "#FFFFFF"]) if (contrast(c, fill) >= 4.5) return c;
  throw new Error(`No text colour reaches 4.5 on ${fill}`);
}

function weighted<T>(rng: Rng, items: readonly (readonly [T, number])[]): T {
  const total = items.reduce((sum, [, w]) => sum + w, 0);
  let r = rng.next() * total;
  for (const [item, w] of items) {
    r -= w;
    if (r < 0) return item;
  }
  return (items[items.length - 1] as readonly [T, number])[0];
}

function capChroma(h: number, C: number): number {
  if (inBand(h, 125, 165)) return Math.min(C, 0.15);
  if (inBand(h, 180, 215)) return Math.min(C, 0.12);
  return C;
}

function fill(L: number, C: number, h: number): Lch {
  const l = inBand(h, 85, 125) ? Math.max(L, 0.78) : L;
  return [l, fit(l, capChroma(h, C), h), h];
}

const isRed = (h: number): boolean => h <= 52 || h >= 338;
const isGreen = (h: number): boolean => inBand(h, 108, 172);
const clashes = (a: number, b: number): boolean => (isRed(a) && isGreen(b)) || (isGreen(a) && isRed(b));

function settlePair(a: Lch, b: Lch, dark: boolean, duotone: boolean): [Lch, Lch] {
  let [L, C] = b;
  if (!duotone) C = Math.min(C, a[1]);
  if (clashes(a[2], b[2])) {
    C = Math.min(C, 0.6 * a[1]);
    if (Math.abs(L - a[0]) < 0.16) L = a[0] + (dark ? -0.16 : 0.16);
  }
  return [a, fill(L, C, b[2])];
}

const sickly = ([L, C, h]: Lch): boolean => inBand(h, 60, 125) && inBand(L, 0.65, 0.8) && inBand(C, 0.04, 0.13);

interface Pick {
  h1: number;
  h2: number;
  scheme: SchemeId;
  chroma: number;
  fills: [number, number];
  dl: number;
  jitter: [number, number];
}

function accents(pk: Pick, dark: boolean, light?: [Lch, Lch]): [Lch, Lch] {
  const k = SCHEMES[pk.scheme];
  const mono = pk.scheme === "mono";
  const L1 = dark ? pk.fills[1] : pk.fills[0];
  const L2 = mono ? L1 + (dark ? -0.2 : 0.2) : L1 + pk.dl;
  const a = fill(L1, light ? 0.9 * light[0][1] : pk.chroma, pk.h1);
  const b = fill(L2, light ? 0.9 * light[1][1] : pk.chroma * k.chroma, pk.h2);
  return settlePair(a, b, dark, pk.scheme === "duotone");
}

function measured(c: Lch): Lch {
  const [L, a, b] = hexToOklab(oklchToHex(...c));
  return [L, Math.hypot(a, b), wrap((Math.atan2(b, a) * 180) / Math.PI)];
}

function validPair(pair: [Lch, Lch], scheme: SchemeId): boolean {
  const [a, b] = pair.map(measured) as [Lch, Lch];
  if (sickly(a) || sickly(b) || b[0] < 0.3 || b[0] > 0.92) return false;
  if ([a, b].some((c) => inBand(c[2], 85, 125) && c[0] < 0.775)) return false;
  const [A, B] = pair.map((c) => hexToOklab(oklchToHex(...c))) as [[number, number, number], [number, number, number]];
  if (Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]) < 0.06) return false;
  if (clashes(a[2], b[2]) && Math.abs(a[0] - b[0]) < 0.14) return false;
  if (scheme === "mono") return Math.abs(a[0] - b[0]) >= 0.19;
  return a[1] <= 0.03 || b[1] <= 0.03 || hueDistance(a[2], b[2]) >= 25;
}

function makeField(spec: PaletteSpec, pk: Pick, dark: boolean, [a, b]: [Lch, Lch]): Field {
  const nh = spec.neutralHue ?? pk.h1;
  const nc = spec.neutralChroma;
  const bgL = dark ? 0.15 + 0.05 * pk.jitter[0] : 0.975 + 0.012 * pk.jitter[0];
  const gap = 0.025 + 0.04 * pk.jitter[1];
  const bg = oklchToHex(bgL, nc, nh);
  const surface = oklchToHex(dark ? bgL + gap : bgL - gap, nc, nh);
  const backs = [bg, surface];
  const ink = settleLightness(dark ? 0.96 : 0.22, nc, nh, backs, 7, dark);
  const textHue = !dark && inBand(a[2], 85, 125) ? 65 : a[2];
  const accent = oklchToHex(...a);
  const accent2 = oklchToHex(...b);
  return {
    bg,
    surface,
    ink,
    muted: settleLightness(dark ? 0.72 : 0.45, nc, nh, backs, 4.6, dark),
    accent,
    accent2,
    accentInk: settleLightness(a[0], a[1], textHue, backs, 4.6, dark),
    onAccent: bestOn(accent, [ink, bg]),
    onAccent2: bestOn(accent2, [ink, bg])
  };
}

function punchField([a, b]: [Lch, Lch], duotone: boolean): Field {
  const [L, C, h] = a;
  const bg = oklchToHex(L, C, h);
  const darkInk = contrast(oklchToHex(0.18, 0.03, h), bg) >= contrast(oklchToHex(0.97, 0.01, h), bg);
  const surface = oklchToHex(darkInk ? L + 0.08 : L - 0.08, C * 0.9, h);
  const backs = [bg, surface];
  const ink = settleLightness(darkInk ? 0.18 : 0.97, 0.03, h, backs, 4.5, !darkInk);
  const inkL = hexToOklab(ink)[0];
  const mid = (L + inkL) / 2;
  const accent2 = duotone ? oklchToHex(mid, b[1], b[2]) : oklchToHex(mid, C * 0.5, h);
  return {
    bg,
    surface,
    ink,
    muted: settleLightness(darkInk ? 0.3 : 0.9, 0.02, h, backs, 4.5, !darkInk),
    accent: ink,
    accent2,
    accentInk: ink,
    onAccent: bestOn(ink, [bg]),
    onAccent2: bestOn(accent2, [ink, bg])
  };
}

function attempt(spec: PaletteSpec, rng: Rng): Palette | undefined {
  const family = weighted(rng, spec.hueWeights.map((w, i) => [i, w] as const));
  const h1 = wrap(family * 15 + rng.int(-5, 5));
  const scheme = weighted(rng, spec.schemes);
  const tier = weighted(rng, spec.tiers);
  const dark = rng.next() < spec.darkShare;
  const [c0, c1] = TIER_CHROMA[tier];
  const [j0, j1, j2, j3, j4, j5] = [rng.next(), rng.next(), rng.next(), rng.next(), rng.next(), rng.next()] as [number, number, number, number, number, number];
  const lerp = ([lo, hi]: [number, number], t: number): number => lo + (hi - lo) * t;
  const pk: Pick = {
    h1,
    h2: wrap(h1 + rng.pick(SCHEMES[scheme].offsets)),
    scheme,
    chroma: lerp([c0, c1], j0),
    fills: [lerp(spec.fillL.light, j1), lerp(spec.fillL.dark, j2)],
    dl: (j3 - 0.5) * 0.12,
    jitter: [j4, j5]
  };
  try {
    const light = accents(pk, false);
    const night = accents(pk, true, light);
    if (!validPair(light, scheme) || !validPair(night, scheme)) return undefined;
    const lightField = makeField(spec, pk, false, light);
    const darkField = makeField(spec, pk, true, night);
    return {
      base: dark ? darkField : lightField,
      inverse: dark ? lightField : darkField,
      punch: punchField(dark ? night : light, scheme === "duotone"),
      dark,
      family,
      hue: h1,
      scheme,
      tier
    };
  } catch {
    return undefined;
  }
}

export function makePalette(dir: DirectionId, seed: number): Palette {
  const spec = PALETTE_SPECS[dir];
  const rng = createRng((Math.imul(seed | 0, 2654435761) + spec.salt) >>> 0);
  for (let tries = 0; tries < 40; tries++) {
    const p = attempt(spec, rng);
    if (p) return p;
  }
  throw new Error(`No valid ${dir} palette for seed ${seed}`);
}
