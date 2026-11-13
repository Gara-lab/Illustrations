import type { Brief, BriefSlide, SlideIntent } from "../brief/brief.ts";
import { iconContext, pickIcon } from "./icons.ts";
import { loadCatalog } from "../catalog/catalog.ts";
import type { Aspect, Deck, Slide, TextEl } from "../model/deck.ts";
import { sizeFor } from "../model/deck.ts";
import { createRng } from "../seed/rng.ts";
import type { Rng } from "../seed/rng.ts";
import { applyAnimation, hr, labelFit, useField } from "./blocks.ts";
import type { Ctx, Variant } from "./blocks.ts";
import { slideBackground } from "./background.ts";
import { audienceOf, purposeOf } from "./bias.ts";
import { DIRECTIONS, SPECS } from "./directions.ts";
import type { DirectionId } from "./directions.ts";
import { CLOSING, SECTION, STATEMENT, TITLE } from "./layout-text.ts";
import { POINTS, STEPS } from "./layout-list.ts";
import { CHART, TABLE } from "./layout-data.ts";
import { IMAGE, NUMBER, QUOTE } from "./layout-feature.ts";
import { makePalette } from "./palette.ts";
import { makeScale } from "./scale.ts";

export { DIRECTIONS } from "./directions.ts";
export type { DirectionId } from "./directions.ts";

export interface DesignOptions {
  direction: DirectionId;
  seed: number;
  aspect: Aspect;
  animation: string;
  photoAssetId: string;
  slideNumber?: boolean;
  footerText?: string;
}

const VARIANTS: Record<SlideIntent, Variant[]> = {
  title: TITLE,
  closing: CLOSING,
  section: SECTION,
  statement: STATEMENT,
  points: POINTS,
  steps: STEPS,
  quote: QUOTE,
  number: NUMBER,
  image: IMAGE,
  chart: CHART,
  table: TABLE
};

export const VARIANT_IDS: Record<SlideIntent, string[]> = Object.fromEntries((Object.keys(VARIANTS) as SlideIntent[]).map((k) => [k, VARIANTS[k].map((v) => v.id)])) as Record<SlideIntent, string[]>;

const BODY_INTENTS: SlideIntent[] = ["statement", "points", "steps", "quote", "number", "image", "chart", "table"];
const PURPOSE_EMPHASIS: Record<string, Partial<Record<SlideIntent, number>>> = {
  persuade: { statement: 1, number: 1, closing: 1 },
  inform: { points: 1, steps: 1, closing: -1 }
};
const TRANSITION_MS = 400;
const FOOTER = 56;

let transitionIds: string[] | null = null;

function knownTransitions(): string[] {
  if (transitionIds === null) transitionIds = loadCatalog().transitions.map((t) => t.id);
  return transitionIds;
}

function shuffle<T>(items: T[], rng: Rng): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}

function hashOf(text: string): number {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = (Math.imul(h, 33) + text.charCodeAt(i)) >>> 0;
  return h;
}

function placementIsValid(ctx: Ctx, contained: boolean): boolean {
  const texts = ctx.els.filter((e): e is TextEl => e.type === "text");
  for (const e of ctx.els) if (e.x < 0 || e.y < 0 || e.x + e.w > ctx.W || e.y + e.h > ctx.H) return false;
  if (contained) for (const e of ctx.els) if (e.y + e.h > ctx.bottom) return false;
  for (const t of texts) if (t.x < ctx.M || t.y < ctx.top || t.x + t.w > ctx.W - ctx.M || t.y + t.h > ctx.bottom) return false;
  for (let i = 0; i < texts.length; i++) {
    for (let j = i + 1; j < texts.length; j++) {
      const a = texts[i] as TextEl;
      const b = texts[j] as TextEl;
      if (Math.min(a.x + a.w, b.x + b.w) > Math.max(a.x, b.x) && Math.min(a.y + a.h, b.y + b.h) > Math.max(a.y, b.y)) return false;
    }
  }
  return true;
}

function footer(ctx: Ctx, slideNumber: boolean, text: string): void {
  const f = ctx.f;
  const y = ctx.H - ctx.M - 32;
  const numberW = text === "" ? 240 : 96;
  if (slideNumber) hr(ctx, ctx.M, ctx.H - ctx.M - 40, 48, ctx.d.fx.line, f.accent);
  if (slideNumber) {
    const pad = (n: number): string => String(n).padStart(2, "0");
    labelFit(ctx, { x: ctx.M, y: 0, w: numberW, h: 32 }, `${pad(ctx.slideNo)} / ${pad(ctx.total)}`, { color: f.muted, upper: false }).at(y);
  }
  if (text !== "") {
    const x = ctx.M + numberW + 16;
    labelFit(ctx, { x, y: 0, w: ctx.W - ctx.M - x, h: 32 }, text, { color: f.muted, upper: false, align: "right" }).at(y);
  }
}

function chrome(ctx: Ctx, slideNumber: boolean, text: string): void {
  if (slideNumber || text !== "") footer(ctx, slideNumber, text);
}

export function designDeck(brief: Brief, options: DesignOptions): Deck {
  const dirIndex = DIRECTIONS.findIndex((d) => d.id === options.direction);
  if (dirIndex < 0) throw new Error(`Unknown direction ${String(options.direction)}`);
  const spec = SPECS[options.direction];
  const size = sizeFor(options.aspect);
  const portrait = options.aspect === "9:16";
  const scale = makeScale(spec.ratio);
  const pal = makePalette(options.direction, options.seed);
  const rng = createRng((Math.imul(options.seed | 0, 40503) + 7919 * (dirIndex + 1)) >>> 0);
  const M = rng.pick(spec.margins);
  const headCols = rng.pick([5, 6, 7]);
  const headFont = rng.pick(spec.headFonts);
  const slideNumber = options.slideNumber === true;
  const footerText = (options.footerText ?? "").replace(/\s+/g, " ").trim();
  const footerOn = slideNumber || footerText !== "";

  const first = brief.slides[0];
  const slides: BriefSlide[] =
    first !== undefined && first.intent === "title"
      ? [{ ...first, ...(brief.subtitle === undefined ? {} : { body: brief.subtitle }) }, ...brief.slides.slice(1)]
      : [{ intent: "title", headline: brief.title, ...(brief.subtitle === undefined ? {} : { body: brief.subtitle }) }, ...brief.slides];
  const purpose = purposeOf(brief.purpose);
  const dens = { simple: -1, none: 0, technical: 1 }[audienceOf(brief.audience)];
  const total = slides.length;
  const budget = Math.ceil(total / 3);
  const bags = new Map<string, Variant[]>();
  const lastId = new Map<string, string>();
  let prevId = "";
  let centred = 0;
  let sectionNo = 0;
  const artHist: string[] = [];
  const iconCtx = iconContext(brief);

  const preset = options.animation === "none" ? null : options.animation;
  const transition: Slide["transition"] =
    preset === null ? null : { preset: knownTransitions().includes(preset) ? preset : "fade", durationMs: TRANSITION_MS };

  const trial = (ctx: Ctx, v: Variant, s: BriefSlide, allowClip: boolean): Ctx | null => {
    const t: Ctx = { ...ctx, els: [], counter: 0, clips: 0, artDrawn: [] };
    if (BODY_INTENTS.includes(s.intent) && footerOn && v.bleed !== true) {
      t.bottom = size.h - M - FOOTER;
      t.CH = t.bottom - t.top;
    }
    useField(t, "base");
    try {
      v.run(t, s);
    } catch {
      return null;
    }
    return placementIsValid(t, BODY_INTENTS.includes(s.intent) && v.bleed !== true) && (allowClip || t.clips === 0) ? t : null;
  };

  const choose = (intent: SlideIntent, ctx: Ctx, s: BriefSlide): { v: Variant; t: Ctx } => {
    const all = VARIANTS[intent];
    const applicable = (v: Variant): boolean => v.ok === undefined || v.ok(ctx, s);
    const firstValid = (bag: Variant[], accept: (v: Variant) => boolean, allowClip: boolean): { idx: number; t: Ctx } | null => {
      for (let idx = 0; idx < bag.length; idx++) {
        const v = bag[idx] as Variant;
        if (!accept(v)) continue;
        const t = trial(ctx, v, s, allowClip);
        if (t !== null) return { idx, t };
      }
      return null;
    };
    for (const allowClip of [false, true]) {
      for (let attempt = 0; attempt < 2; attempt++) {
        let bag = bags.get(intent) ?? [];
        if (bag.length === 0 || attempt === 1) {
          bag = shuffle(all, rng);
          const last = lastId.get(intent);
          if (last !== undefined && bag.length > 1 && (bag[0] as Variant).id === last) [bag[0], bag[1]] = [bag[1] as Variant, bag[0] as Variant];
        }
        let found = firstValid(bag, (v) => applicable(v) && v.id !== prevId && !(v.centred === true && centred >= budget), allowClip);
        if (found === null && attempt === 1) found = firstValid(bag, (v) => applicable(v) && v.id !== prevId, allowClip);
        if (found !== null) {
          const v = bag.splice(found.idx, 1)[0] as Variant;
          bags.set(intent, bag);
          return { v, t: found.t };
        }
      }
    }
    const rescue = firstValid(all, applicable, true) ?? firstValid(all, () => true, true);
    if (rescue !== null) return { v: all[rescue.idx] as Variant, t: rescue.t };
    for (const squeeze of [0.75, 0.55, 0.4]) {
      ctx.squeeze = squeeze;
      const found = firstValid(all, applicable, true);
      ctx.squeeze = 1;
      if (found !== null) return { v: all[found.idx] as Variant, t: { ...found.t, squeeze: 1 } };
    }
    const v = all[0] as Variant;
    const t: Ctx = { ...ctx, els: [], counter: 0, clips: 0, artDrawn: [] };
    useField(t, "base");
    v.run(t, s);
    return { v, t };
  };
  const out: Slide[] = slides.map((s, i) => {
    const slideNo = i + 1;
    if (s.intent === "section") sectionNo += 1;
    const ctx: Ctx = {
      d: s.intent === "closing" && purpose === "persuade" ? { ...spec, closingField: "punch" } : spec,
      pal,
      scale,
      artSeed: Math.imul(options.seed | 0, 131) + slideNo * 7 + dirIndex * 1009,
      W: size.w,
      H: size.h,
      M,
      CW: size.w - 2 * M,
      CH: size.h - 2 * M,
      top: M,
      bottom: size.h - M,
      portrait,
      headCols,
      headFont,
      f: pal.base,
      bg: pal.base.bg,
      slideId: `d${slideNo}`,
      els: [],
      counter: 0,
      emph: Math.max(-1, Math.min(1, (s.emphasis === "high" ? 1 : s.emphasis === "low" ? -1 : 0) + (PURPOSE_EMPHASIS[purpose]?.[s.intent] ?? 0))),
      dens,
      sectionNo,
      slideNo,
      total,
      photoAssetId: options.photoAssetId,
      squeeze: 1,
      clips: 0,
      artHist,
      artDrawn: [],
      icon: pickIcon(s, iconCtx, artHist)
    };
    const picked = choose(s.intent, ctx, s);
    const variant = picked.v;
    Object.assign(ctx, picked.t);
    if (BODY_INTENTS.includes(s.intent) && variant.bleed !== true) chrome(ctx, slideNumber, footerText);
    if (variant.centred === true) centred += 1;
    artHist.push(...ctx.artDrawn);
    prevId = variant.id;
    lastId.set(s.intent, variant.id);
    applyAnimation(ctx.els, preset);
    const back = slideBackground(ctx, s.intent);
    return {
      id: ctx.slideId,
      layoutId: `design:${options.direction}:${variant.id}`,
      background: back.background,
      elements: back.scrim === null ? ctx.els : [back.scrim, ...ctx.els],
      transition,
      notes: s.notes ?? ""
    };
  });

  return {
    version: 1,
    id: `design-${hashOf(`${brief.title}|${options.direction}|${options.seed}|${options.aspect}`).toString(36)}`,
    title: brief.title,
    aspect: options.aspect,
    size,
    themeId: `design-${options.direction}`,
    seed: options.seed,
    mode: "creative",
    slides: out
  };
}
