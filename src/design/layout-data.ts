import type { BriefSlide } from "../brief/brief.ts";
import { bodyFit, f8, has, headFit, rect, twoCol, useField } from "./blocks.ts";
import type { Ctx, Fit, Region, Variant } from "./blocks.ts";
import { drawChart, drawTable } from "./chart.ts";
import type { FieldKind } from "./directions.ts";

const HEAD_STEP = 3;
const LINE_SIDE_MAX = 6;

function content(ctx: Ctx, r: Region, s: BriefSlide): number {
  if (s.chart !== undefined) return drawChart(ctx, r, s.chart);
  if (s.table !== undefined) return drawTable(ctx, r, s.table);
  return 0;
}

function captionOf(s: BriefSlide): string | undefined {
  return (s.chart ?? s.table)?.caption;
}

const CAPTION_BAR = 8;
const CAPTION_INDENT = 24;

function captionFit(ctx: Ctx, region: Region, cap: string, headSize: number, color: string): Fit {
  return bodyFit(ctx, { ...region, x: region.x + CAPTION_INDENT, w: region.w - CAPTION_INDENT }, cap, headSize, { color, role: "caption" });
}

function placeCaption(ctx: Ctx, fit: Fit, x: number, y: number, accent: string): void {
  fit.at(y);
  rect(ctx, { x, y, w: CAPTION_BAR, h: fit.h }, accent, "marker");
}

function below(ctx: Ctx, s: BriefSlide, field: FieldKind): void {
  const f = useField(ctx, field);
  const cap = captionOf(s);
  const head = headFit(ctx, { x: ctx.M, y: ctx.top, w: f8(ctx.CW * (ctx.portrait ? 1 : 0.85)), h: f8(ctx.CH * 0.3) }, s.headline, { maxStep: HEAD_STEP });
  const capFit = has(cap) ? captionFit(ctx, { x: ctx.M, y: 0, w: ctx.CW, h: f8(ctx.CH * 0.12) }, cap, head.size, f.ink) : null;
  const first = ctx.els.length;
  head.at(ctx.top);
  const y = ctx.top + head.h + 40;
  const room = f8(ctx.bottom - y - (capFit === null ? 0 : capFit.h + 24));
  const used = content(ctx, { x: ctx.M, y, w: ctx.CW, h: room }, s);
  const end = capFit === null ? y + used : Math.min(ctx.bottom - capFit.h, y + used + 24) + capFit.h;
  if (capFit !== null) placeCaption(ctx, capFit, ctx.M, Math.min(ctx.bottom - capFit.h, y + used + 24), f.accent);
  const dy = f8(Math.max(0, ctx.bottom - end) * 0.5);
  if (dy > 0) for (const el of ctx.els.slice(first)) el.y += dy;
}

function side(ctx: Ctx, s: BriefSlide): void {
  const f = useField(ctx, "base");
  const cap = captionOf(s);
  const { a, b } = twoCol(ctx, s.headline);
  const head = headFit(ctx, { ...a, h: f8(a.h * 0.7) }, s.headline, { maxStep: HEAD_STEP + 1 });
  const capFit = has(cap) ? captionFit(ctx, { ...a, h: f8(a.h * 0.25) }, cap, head.size, f.ink) : null;
  head.at(a.y);
  if (capFit !== null) placeCaption(ctx, capFit, a.x, ctx.bottom - capFit.h, f.accent);
  const first = ctx.els.length;
  const used = content(ctx, { x: b.x, y: ctx.top, w: b.w, h: ctx.CH }, s);
  const dy = s.chart === undefined ? 0 : f8(Math.max(0, ctx.CH - used) * 0.5);
  if (dy > 0) for (const el of ctx.els.slice(first)) el.y += dy;
}

function variants(prefix: string, sideOk: (s: BriefSlide) => boolean): Variant[] {
  return [
    { id: `${prefix}.below`, run: (ctx, s) => below(ctx, s, "base") },
    { id: `${prefix}.side`, ok: (ctx, s) => !ctx.portrait && sideOk(s), run: side },
    { id: `${prefix}.inverse`, bleed: true, run: (ctx, s) => below(ctx, s, "inverse") }
  ];
}

export const CHART: Variant[] = variants("chart", (s) => s.chart?.kind !== "line" || s.chart.series.length <= LINE_SIDE_MAX);

export const TABLE: Variant[] = variants("table", (s) => (s.table?.columns.length ?? 0) <= 3);
