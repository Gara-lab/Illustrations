import type { BriefSlide } from "../brief/brief.ts";
import type { Element, Fill, ImageEl, PathCommand, PathEl, PathFill, ShapeEl, Stroke, TextEl } from "../model/deck.ts";
import type { IconLayer } from "../catalog/icon-catalog.ts";
import type { DirSpec, FieldKind } from "./directions.ts";
import { hairStroke, shadowOf, surfaceFill } from "./effects.ts";
import { c8, fitText, fitWordLines } from "./fit.ts";
import type { Field, Palette } from "./palette.ts";
import { sizesBetween } from "./scale.ts";
import type { Scale } from "./scale.ts";

export interface Region { x: number; y: number; w: number; h: number }

export const f8 = (n: number): number => Math.floor(n / 8 + 1e-9) * 8;
const r8 = (n: number): number => Math.round(n / 8) * 8;

export const GUTTER = 24;
export const GAP = 48;

export interface Ctx {
  d: DirSpec;
  pal: Palette;
  scale: Scale;
  artSeed: number;
  W: number;
  H: number;
  M: number;
  CW: number;
  CH: number;
  top: number;
  bottom: number;
  portrait: boolean;
  headCols: number;
  headFont: string;
  f: Field;
  bg: string;
  slideId: string;
  els: Element[];
  counter: number;
  emph: number;
  dens: number;
  sectionNo: number;
  slideNo: number;
  total: number;
  photoAssetId: string;
  squeeze: number;
  clips: number;
  artHist: readonly string[];
  artDrawn: string[];
  icon: string | null;
}

export function useField(ctx: Ctx, kind: FieldKind): Field {
  ctx.f = ctx.pal[kind];
  ctx.bg = ctx.f.bg;
  return ctx.f;
}

function baseOf(ctx: Ctx, role: string, r: Region) {
  ctx.counter += 1;
  return { id: `${ctx.slideId}-e${ctx.counter}`, x: r.x, y: r.y, w: r.w, h: r.h, rotation: 0, animation: null, role };
}

export interface ShapeOpts { stroke?: Stroke; radius?: number; lift?: boolean }

const fillOf = (color: string | Fill | null): Fill => (color === null ? { kind: "none" } : typeof color === "string" ? { kind: "solid", color } : color);

function shape(ctx: Ctx, r: Region, kind: "rect" | "ellipse", color: string | Fill | null, role: string, o: ShapeOpts): void {
  const el: ShapeEl = {
    ...baseOf(ctx, role, r),
    type: "shape",
    shape: kind,
    fill: fillOf(color),
    stroke: o.stroke ?? null,
    radius: kind === "rect" ? o.radius ?? 0 : 0
  };
  const shadow = o.lift === true ? shadowOf(ctx) : undefined;
  if (shadow !== undefined) el.shadow = shadow;
  ctx.els.push(el);
}

export const rect = (ctx: Ctx, r: Region, color: string | Fill | null, role: string, o: ShapeOpts = {}): void => shape(ctx, r, "rect", color, role, o);

export const ellipse = (ctx: Ctx, r: Region, color: string | Fill | null, role: string, o: ShapeOpts = {}): void => shape(ctx, r, "ellipse", color, role, o);

export function pathEl(ctx: Ctx, r: Region, commands: PathCommand[], fill: PathFill, stroke: Stroke | null, role: string): void {
  const el: PathEl = { ...baseOf(ctx, role, r), type: "path", commands, fill, stroke };
  ctx.els.push(el);
}

export function hr(ctx: Ctx, x: number, y: number, w: number, t: number, color: string | Fill): void {
  rect(ctx, { x, y, w, h: t }, color, "rule");
}

export function vr(ctx: Ctx, x: number, y: number, h: number, t: number, color: string | Fill): void {
  rect(ctx, { x, y, w: t, h }, color, "rule");
}

const ICON_BOX = 24;
const ICON_STROKE = 1.5;
const cents = (n: number): number => Math.round(n * 100) / 100;

export function iconPaths(ctx: Ctx, r: Region, layers: readonly IconLayer[], color: string): void {
  const k = r.w / ICON_BOX;
  for (const layer of layers) {
    const commands = layer.commands.map((c): PathCommand => (c[0] === "Z" ? ["Z"] : ([c[0], ...c.slice(1).map((v) => cents((v as number) * k))] as PathCommand)));
    const alpha = layer.alpha !== undefined && layer.alpha < 1 ? { alpha: layer.alpha } : {};
    if (layer.mode === "fill") pathEl(ctx, r, commands, { kind: "solid", color, ...alpha }, null, "icon");
    else pathEl(ctx, r, commands, { kind: "none" }, { color, width: cents(ICON_STROKE * k), linecap: "round", linejoin: "round", ...alpha }, "icon");
  }
}

export function photo(ctx: Ctx, r: Region, assetId: string): void {
  const el: ImageEl = { ...baseOf(ctx, "photo", r), type: "image", assetId, fit: "cover" };
  ctx.els.push(el);
}

export function col(ctx: Ctx, c: number, span: number): Region {
  const unit = (ctx.CW + GUTTER) / 12;
  const x = ctx.M + r8(c * unit);
  let w = f8(span * unit - GUTTER);
  if (x + w > ctx.W - ctx.M) w = f8(ctx.W - ctx.M - x);
  return { x, y: ctx.top, w, h: ctx.CH };
}

export interface Cols { a: Region; b: Region; stacked: boolean; hc: number }

const LONG_TEXT_CHARS = 120;
const LONG_HEAD_UNITS = [4, 5];
const HEAD_UNITS_MAX = 7;
const HEAD_BOX_SHARE = 0.85;

function headFitsUnits(ctx: Ctx, headline: string, units: number): boolean {
  const r = fitText({ text: headline, font: ctx.headFont, bold: ctx.d.headBold, width: col(ctx, 0, units).w, maxH: f8(ctx.CH * HEAD_BOX_SHARE), sizes: headSizes(ctx), lh: 1.1 });
  return !r.clipped && !r.broken;
}

export function twoCol(ctx: Ctx, headline: string, o: { text?: string; floor?: number } = {}): Cols {
  if (ctx.portrait) {
    const a = { x: ctx.M, y: ctx.top, w: ctx.CW, h: f8(ctx.CH * 0.5) };
    return { a, b: { x: ctx.M, y: ctx.top, w: ctx.CW, h: ctx.CH }, stacked: true, hc: 12 };
  }
  const long = (o.text ?? "").trim().length >= LONG_TEXT_CHARS;
  const lo = long ? (LONG_HEAD_UNITS[0] as number) : (o.floor ?? ctx.headCols);
  const hi = long ? (LONG_HEAD_UNITS[1] as number) : HEAD_UNITS_MAX;
  let hc = hi;
  for (let c = lo; c <= hi; c++) {
    if (headFitsUnits(ctx, headline, c)) {
      hc = c;
      break;
    }
  }
  return { a: col(ctx, 0, hc), b: col(ctx, hc + 1, 11 - hc), stacked: false, hc };
}

const SPARSE_SHARE = 0.6;

export function stackY(ctx: Ctx, total: number, bias = 0.4): number {
  const room = Math.max(0, ctx.CH - total);
  const sparse = total < ctx.CH * SPARSE_SHARE;
  return ctx.top + f8(room * (sparse ? 0.5 : bias));
}

export interface TextSpec {
  text: string;
  region: Region;
  role: string;
  font: string;
  bold: boolean;
  italic?: boolean;
  sizes: number[];
  color: string;
  lh: number;
  align?: "left" | "center" | "right";
  upper?: boolean;
  maxWords?: number;
}

export interface Fit {
  size: number;
  h: number;
  w: number;
  text: string;
  broken: boolean;
  at(y: number): Region;
}

export function fit(ctx: Ctx, s: TextSpec): Fit {
  const text = s.upper === true ? s.text.toUpperCase() : s.text;
  const floor = c8(Math.min(...s.sizes) * s.lh);
  const maxH = s.region.h >= 50000 ? s.region.h : Math.max(floor, f8(s.region.h * ctx.squeeze));
  const input = { text, font: s.font, bold: s.bold, width: s.region.w, maxH, sizes: s.sizes, lh: s.lh };
  const r = s.maxWords === undefined ? fitText(input) : fitWordLines({ ...input, maxWords: s.maxWords });
  if (r.clipped || r.broken) ctx.clips += 1;
  return {
    size: r.size,
    h: r.h,
    w: s.region.w,
    text: r.text,
    broken: r.broken,
    at(y: number): Region {
      const box = { x: s.region.x, y, w: s.region.w, h: r.h };
      const el: TextEl = {
        ...baseOf(ctx, s.role, box),
        type: "text",
        paragraphs: (r.forced === true ? r.lines : [r.text]).map((line) => ({ runs: [{ text: line, ...(s.bold ? { bold: true } : {}), ...(s.italic === true ? { italic: true } : {}) }], bullet: false, level: 0 })),
        fontFamily: s.font,
        fontSize: r.size,
        color: s.color,
        align: s.align ?? "left",
        valign: "top",
        lineHeight: s.lh
      };
      ctx.els.push(el);
      return box;
    }
  };
}

export function headSizes(ctx: Ctx, maxStep?: number): number[] {
  const top = Math.max(ctx.scale.domMin, ctx.scale.step((maxStep ?? ctx.d.headTop) + ctx.emph));
  return sizesBetween(ctx.scale, ctx.scale.domMin, top);
}

function compactSizes(ctx: Ctx): number[] {
  return ctx.scale.sizes.filter((s) => s >= ctx.scale.step(2) && s < ctx.scale.domMin).reverse();
}

export function headFit(ctx: Ctx, region: Region, text: string, o: { maxStep?: number; align?: "left" | "center" | "right"; color?: string; sizes?: number[]; maxWords?: number } = {}): Fit {
  const spec: TextSpec = {
    text,
    region,
    role: "heading",
    font: ctx.headFont,
    bold: ctx.d.headBold,
    sizes: o.sizes ?? [...headSizes(ctx, o.maxStep), ...compactSizes(ctx)],
    color: o.color ?? ctx.f.ink,
    lh: 1.1
  };
  if (o.align !== undefined) spec.align = o.align;
  if (o.maxWords !== undefined) spec.maxWords = o.maxWords;
  const result = fit(ctx, spec);
  if (o.sizes === undefined && result.size < ctx.scale.domMin) ctx.clips += 1;
  return result;
}

export function secondary(ctx: Ctx, cap: number, wanted: number[]): number[] {
  const larger = ctx.dens < 0 ? ctx.scale.sizes.find((s) => s > (wanted[0] as number)) : undefined;
  const tuned = ctx.dens > 0 ? wanted.slice(-1) : larger === undefined ? wanted : [larger, ...wanted];
  const ok = tuned.filter((s) => s <= cap / 2);
  return ok.length > 0 ? ok : [ctx.scale.step(0)];
}

export function bodyFit(ctx: Ctx, region: Region, text: string, cap: number, o: { color?: string; align?: "left" | "center" | "right"; lead?: boolean; bold?: boolean; italic?: boolean; role?: string } = {}): Fit {
  const wanted = o.lead === false ? [ctx.scale.step(0)] : [ctx.scale.step(1), ctx.scale.step(0)];
  const spec: TextSpec = {
    text,
    region,
    role: o.role ?? "body",
    font: ctx.d.bodyFont,
    bold: o.bold ?? false,
    sizes: secondary(ctx, cap, wanted),
    color: o.color ?? ctx.f.ink,
    lh: 1.4
  };
  if (o.italic === true) spec.italic = true;
  if (o.align !== undefined) spec.align = o.align;
  return fit(ctx, spec);
}

export function labelFit(ctx: Ctx, region: Region, text: string, o: { color?: string; upper?: boolean; align?: "left" | "center" | "right"; role?: string; sizes?: number[] } = {}): Fit {
  const spec: TextSpec = {
    text,
    region,
    role: o.role ?? "label",
    font: ctx.d.labelFont,
    bold: ctx.d.labelBold,
    sizes: o.sizes ?? [ctx.scale.step(-1)],
    color: o.color ?? ctx.f.muted,
    lh: 1.3,
    upper: o.upper ?? ctx.d.labelUpper
  };
  if (o.align !== undefined) spec.align = o.align;
  return fit(ctx, spec);
}

export function figureFit(ctx: Ctx, region: Region, text: string, sizes: number[], o: { color?: string; align?: "left" | "center" | "right"; role?: string } = {}): Fit {
  const spec: TextSpec = {
    text,
    region,
    role: o.role ?? "figure",
    font: ctx.d.figureFont,
    bold: ctx.d.figureBold,
    sizes,
    color: o.color ?? ctx.f.accentInk,
    lh: 1.05
  };
  if (o.align !== undefined) spec.align = o.align;
  return fit(ctx, spec);
}

export interface ItemsFit { size: number; fits: Fit[]; total: number }

export function itemsFit(ctx: Ctx, items: string[], o: { x: number; w: number; maxH: number; gap: number; sizes: number[]; color: string; bold?: boolean; role?: string }): ItemsFit {
  const build = (size: number, each: number): Fit[] =>
    items.map((text) =>
      fit(ctx, { text, region: { x: o.x, y: 0, w: o.w, h: each }, role: o.role ?? "body", font: ctx.d.bodyFont, bold: o.bold ?? false, sizes: [size], color: o.color, lh: 1.4 })
    );
  const gaps = o.gap * (items.length - 1);
  const before = ctx.clips;
  for (const size of o.sizes) {
    const fits = build(size, 100000);
    const total = fits.reduce((a, f) => a + f.h, 0) + gaps;
    if (total <= o.maxH && fits.every((f) => !f.broken)) return { size, fits, total };
    ctx.clips = before;
  }
  const size = o.sizes[o.sizes.length - 1] as number;
  const natural = build(size, 100000);
  ctx.clips = before;
  const bad = natural.map((f, i) => (f.broken ? i : -1)).filter((i) => i >= 0);
  const spare = o.maxH - gaps - natural.reduce((a, f, i) => a + (f.broken ? 0 : f.h), 0);
  const share = bad.length === 0 ? 0 : f8(spare / bad.length);
  if (bad.length > 0 && share >= c8(size * 1.4)) {
    const fits = items.map((text, i) => (bad.includes(i) ? fit(ctx, { text, region: { x: o.x, y: 0, w: o.w, h: share }, role: o.role ?? "body", font: ctx.d.bodyFont, bold: o.bold ?? false, sizes: [size], color: o.color, lh: 1.4 }) : fit(ctx, { text, region: { x: o.x, y: 0, w: o.w, h: 100000 }, role: o.role ?? "body", font: ctx.d.bodyFont, bold: o.bold ?? false, sizes: [size], color: o.color, lh: 1.4 })));
    return { size, fits, total: fits.reduce((a, f) => a + f.h, 0) + gaps };
  }
  const each = Math.max(c8(size * 1.4), f8((o.maxH - gaps) / items.length));
  const fits = build(size, each);
  return { size, fits, total: fits.reduce((a, f) => a + f.h, 0) + gaps };
}

export interface CardColors { ink: string; muted: string; accent: string }

export function card(ctx: Ctx, r: Region, index: number): CardColors {
  const f = ctx.f;
  const fx = ctx.d.fx;
  if (ctx.d.card === "solid") {
    const second = index % 2 === 1;
    const on = second ? f.onAccent2 : f.onAccent;
    rect(ctx, r, second ? f.accent2 : f.accent, "card", { lift: true });
    return { ink: on, muted: on, accent: on };
  }
  if (ctx.d.card === "outline") {
    rect(ctx, r, surfaceFill(ctx, f, "surface"), "card", { stroke: hairStroke(ctx, f, fx.stroke), lift: true });
    return { ink: f.ink, muted: f.muted, accent: f.accentInk };
  }
  rect(ctx, r, surfaceFill(ctx, f, "surface"), "card", { lift: true });
  hr(ctx, r.x, r.y, r.w, fx.line, f.ink);
  return { ink: f.ink, muted: f.muted, accent: f.accentInk };
}

export interface Variant {
  id: string;
  centred?: boolean;
  bleed?: boolean;
  ok?(ctx: Ctx, s: BriefSlide): boolean;
  run(ctx: Ctx, s: BriefSlide): void;
}

export const has = (t: string | undefined): t is string => t !== undefined && t.trim() !== "";

export function centreRegion(ctx: Ctx, w: number, y = ctx.top, h = ctx.CH): Region {
  const ww = Math.min(f8(w), ctx.CW);
  return { x: ctx.M + f8((ctx.CW - ww) / 2), y, w: ww, h };
}

export function applyAnimation(els: Element[], preset: string | null): void {
  if (preset === null) return;
  let order = 0;
  for (const el of els) if (el.type === "text") el.animation = { preset, order: ++order, delayMs: 0 };
}
