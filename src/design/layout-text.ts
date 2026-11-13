import type { BriefSlide } from "../brief/brief.ts";
import { drawArt } from "./art.ts";
import { GAP, bodyFit, card, centreRegion, f8, has, headFit, hr, labelFit, figureFit, rect, stackY, twoCol, useField, vr } from "./blocks.ts";
import type { Ctx, Variant } from "./blocks.ts";
import { surfaceFill } from "./effects.ts";
import type { FieldKind } from "./directions.ts";
import { sizesBetween } from "./scale.ts";

const THREE = { maxWords: 3 };
const headOnly = (s: BriefSlide): { maxWords?: number } => (has(s.body) ? {} : THREE);

function strongKind(kind: FieldKind): FieldKind {
  return kind === "base" ? "punch" : kind;
}

function stackLayout(ctx: Ctx, s: BriefSlide, kind: FieldKind): void {
  const f = useField(ctx, kind);
  const head = headFit(ctx, { x: ctx.M, y: ctx.top, w: ctx.CW, h: f8(ctx.CH * 0.6) }, s.headline, { maxStep: ctx.d.headTop + 2, ...headOnly(s) });
  const sub = has(s.body) ? bodyFit(ctx, { x: ctx.M, y: 0, w: f8(ctx.CW * (ctx.portrait ? 1 : 0.7)), h: f8(ctx.CH * 0.2) }, s.body, head.size, { color: f.muted }) : null;
  const total = head.h + (sub === null ? 0 : 32 + sub.h);
  const y0 = ctx.bottom - total;
  head.at(y0);
  if (sub !== null) sub.at(y0 + head.h + 32);
  hr(ctx, ctx.M, y0 - 32, 96, 8, f.accentInk);
  const artX = ctx.portrait ? ctx.M : ctx.M + f8(ctx.CW * 0.45);
  const art = { x: artX, y: ctx.top, w: ctx.W - ctx.M - artX, h: f8(y0 - 64 - ctx.top) };
  if (art.h >= 128) drawArt(ctx, art, f, "surface");
}

function panelLayout(ctx: Ctx, s: BriefSlide, kind: FieldKind): void {
  const f = useField(ctx, "base");
  const pf = ctx.pal[strongKind(kind)];
  const panel = ctx.portrait
    ? { x: 0, y: 0, w: ctx.W, h: f8(ctx.H * 0.42) }
    : { x: f8(ctx.W * (ctx.headCols >= 6 ? 0.56 : 0.48)), y: 0, w: 0, h: ctx.H };
  if (!ctx.portrait) panel.w = ctx.W - panel.x;
  drawArt(ctx, panel, pf, "bg");
  const region = ctx.portrait
    ? { x: ctx.M, y: panel.h + GAP, w: ctx.CW, h: ctx.bottom - panel.h - GAP }
    : { x: ctx.M, y: ctx.top, w: panel.x - ctx.M - GAP, h: ctx.CH };
  const head = headFit(ctx, { ...region, h: f8(region.h * 0.7) }, s.headline, { maxStep: ctx.d.headTop + 1, ...headOnly(s) });
  const sub = has(s.body) ? bodyFit(ctx, { ...region, h: f8(region.h * 0.28) }, s.body, head.size, { color: f.muted }) : null;
  const total = head.h + (sub === null ? 0 : 32 + sub.h);
  const y0 = ctx.portrait ? ctx.bottom - total : region.y + f8((region.h - total) * 0.55);
  head.at(y0);
  if (sub !== null) sub.at(y0 + head.h + 32);
  hr(ctx, region.x, y0 - 32, 96, 8, f.accentInk);
}

function centreLayout(ctx: Ctx, s: BriefSlide, kind: FieldKind): void {
  const f = useField(ctx, kind);
  const band = ctx.portrait ? 160 : 96;
  const room = ctx.bottom - band - GAP - ctx.top;
  const region = centreRegion(ctx, ctx.CW * 0.86, ctx.top, f8(room * 0.55));
  const head = headFit(ctx, region, s.headline, { maxStep: ctx.d.headTop + 1, align: "center", ...headOnly(s) });
  const sub = has(s.body) ? bodyFit(ctx, { ...centreRegion(ctx, ctx.CW * 0.66, 0, f8(room * 0.25)) }, s.body, head.size, { color: f.muted, align: "center" }) : null;
  const total = head.h + (sub === null ? 48 : 72 + sub.h);
  const y0 = ctx.top + f8((room - total) / 2);
  head.at(y0);
  const ruleX = ctx.M + f8((ctx.CW - 96) / 2);
  hr(ctx, ruleX, y0 + head.h + 24, 96, 8, f.accentInk);
  if (sub !== null) sub.at(y0 + head.h + 72);
  drawArt(ctx, { x: 0, y: ctx.H - band, w: ctx.W, h: band }, f, "surface");
}

export const TITLE: Variant[] = [
  { id: "title.stack", run: (ctx, s) => stackLayout(ctx, s, ctx.d.titleField) },
  { id: "title.panel", run: (ctx, s) => panelLayout(ctx, s, ctx.d.titleField) },
  { id: "title.centre", centred: true, run: (ctx, s) => centreLayout(ctx, s, ctx.d.titleField) }
];

export const CLOSING: Variant[] = [
  { id: "closing.stack", run: (ctx, s) => stackLayout(ctx, s, ctx.d.closingField) },
  { id: "closing.panel", run: (ctx, s) => panelLayout(ctx, s, ctx.d.closingField) },
  { id: "closing.centre", centred: true, run: (ctx, s) => centreLayout(ctx, s, ctx.d.closingField) }
];

function ordinal(ctx: Ctx): string {
  return String(ctx.sectionNo).padStart(2, "0");
}

export const SECTION: Variant[] = [
  {
    id: "section.numeral",
    run(ctx, s) {
      const f = useField(ctx, ctx.d.sectionField);
      const num = figureFit(ctx, { x: ctx.M, y: ctx.top, w: ctx.CW, h: f8(ctx.CH * 0.6) }, ordinal(ctx), sizesBetween(ctx.scale, ctx.scale.step(6), ctx.scale.step(8)), { color: f.accentInk });
      const head = headFit(ctx, { x: ctx.M, y: 0, w: f8(ctx.CW * 0.8), h: f8(ctx.CH * 0.4) }, s.headline, { ...THREE, sizes: sizesBetween(ctx.scale, ctx.scale.step(2), Math.floor(num.size / 2)) });
      num.at(ctx.top);
      const y = ctx.bottom - head.h;
      head.at(y);
      hr(ctx, ctx.M, y - 32, 96, 8, f.accentInk);
    }
  },
  {
    id: "section.word",
    run(ctx, s) {
      const f = useField(ctx, ctx.d.sectionField);
      labelFit(ctx, { x: ctx.M, y: 0, w: ctx.CW, h: 32 }, `Section ${ordinal(ctx)}`, { color: f.accentInk }).at(ctx.top);
      hr(ctx, ctx.M, ctx.top + 48, 96, 8, f.accentInk);
      const head = headFit(ctx, { x: ctx.M, y: 0, w: ctx.CW, h: f8(ctx.CH * 0.75) }, s.headline, { ...THREE, maxStep: ctx.d.headTop + 2 });
      head.at(ctx.bottom - head.h);
    }
  },
  {
    id: "section.split",
    run(ctx, s) {
      const f = useField(ctx, "base");
      const pf = ctx.pal[strongKind(ctx.d.sectionField)];
      const panel = ctx.portrait ? { x: 0, y: 0, w: ctx.W, h: f8(ctx.H * 0.42) } : { x: 0, y: 0, w: f8(ctx.W * 0.42), h: ctx.H };
      rect(ctx, panel, surfaceFill(ctx, pf, "bg"), "panel");
      const nw = ctx.portrait ? ctx.CW : panel.w - ctx.M - 32;
      const num = figureFit(ctx, { x: ctx.M, y: 0, w: nw, h: ctx.portrait ? panel.h - ctx.M - 32 : f8(ctx.CH * 0.6) }, ordinal(ctx), sizesBetween(ctx.scale, ctx.scale.step(6), ctx.scale.step(8)), { color: pf.accentInk });
      num.at(ctx.portrait ? panel.h - 32 - num.h : ctx.bottom - num.h);
      const region = ctx.portrait
        ? { x: ctx.M, y: panel.h + GAP, w: ctx.CW, h: ctx.bottom - panel.h - GAP }
        : { x: panel.w + 64, y: ctx.top, w: ctx.W - ctx.M - panel.w - 64, h: ctx.CH };
      const head = headFit(ctx, region, s.headline, { ...THREE, color: f.ink, sizes: sizesBetween(ctx.scale, ctx.scale.step(2), Math.floor(num.size / 2)) });
      const y = ctx.portrait ? region.y : region.y + f8((region.h - head.h) / 2);
      head.at(y);
      hr(ctx, region.x, y - 32, 96, 8, f.accentInk);
    }
  }
];

export const STATEMENT: Variant[] = [
  {
    id: "statement.split",
    run(ctx, s) {
      const f = useField(ctx, "base");
      const { a, b, stacked } = twoCol(ctx, s.headline, { text: s.body });
      const head = headFit(ctx, a, s.headline);
      const body = has(s.body) ? bodyFit(ctx, stacked ? { ...b, h: f8(ctx.CH - head.h - 120) } : b, s.body, head.size) : null;
      if (stacked) {
        const total = head.h + 48 + (body === null ? 0 : body.h);
        const y0 = stackY(ctx, total);
        head.at(y0);
        if (body !== null) body.at(y0 + head.h + 48);
        return;
      }
      const total = Math.max(head.h, body === null ? 0 : body.h);
      const y0 = stackY(ctx, total);
      head.at(y0);
      if (body !== null) body.at(y0);
    }
  },
  {
    id: "statement.centred",
    centred: true,
    run(ctx, s) {
      useField(ctx, "base");
      const head = headFit(ctx, centreRegion(ctx, ctx.CW * 0.86, ctx.top, f8(ctx.CH * 0.6)), s.headline, { align: "center", maxStep: ctx.d.headTop });
      const body = has(s.body) ? bodyFit(ctx, centreRegion(ctx, ctx.CW * 0.62, 0, f8(ctx.CH * 0.34)), s.body, head.size, { align: "center" }) : null;
      const total = head.h + 48 + (body === null ? 0 : body.h);
      const y0 = stackY(ctx, total, 0.5);
      head.at(y0);
      if (body !== null) body.at(y0 + head.h + 48);
    }
  },
  {
    id: "statement.bar",
    run(ctx, s) {
      const f = useField(ctx, "base");
      const hw = ctx.portrait ? ctx.CW : f8(ctx.CW * 0.8);
      const head = headFit(ctx, { x: ctx.M, y: 0, w: hw, h: f8(ctx.CH * 0.55) }, s.headline);
      const body = has(s.body) ? bodyFit(ctx, { x: ctx.M, y: 0, w: ctx.portrait ? ctx.CW : f8(ctx.CW * 0.58), h: f8(ctx.CH * 0.34) }, s.body, head.size, { color: f.muted }) : null;
      const total = head.h + 56 + (body === null ? 0 : body.h);
      const y0 = stackY(ctx, total, 0.3);
      head.at(y0);
      const bar = y0 + head.h + 24;
      rect(ctx, { x: ctx.M, y: bar, w: 128, h: 8 }, f.accent, "rule");
      if (body !== null) body.at(bar + 32);
    }
  },
  {
    id: "statement.panel",
    run(ctx, s) {
      const f = useField(ctx, "base");
      const { a, b, stacked } = twoCol(ctx, s.headline, { text: s.body });
      const head = headFit(ctx, a, s.headline);
      const pad = 32;
      const bw = b.w - 2 * pad;
      const body = has(s.body) ? bodyFit(ctx, { x: b.x + pad, y: 0, w: bw, h: f8((stacked ? ctx.CH - head.h - 160 : ctx.CH) - 2 * pad) }, s.body, head.size, { color: f.ink }) : null;
      const cardH = body === null ? 0 : body.h + 2 * pad;
      const total = stacked ? head.h + 48 + cardH : Math.max(head.h, cardH);
      const y0 = stackY(ctx, total);
      head.at(y0);
      if (body === null) return;
      const cy = stacked ? y0 + head.h + 48 : y0;
      const cardRegion = { x: b.x, y: cy, w: b.w, h: cardH };
      const colors = card(ctx, cardRegion, 0);
      const inner = bodyFit(ctx, { x: b.x + pad, y: 0, w: bw, h: f8((stacked ? ctx.CH - head.h - 160 : ctx.CH) - 2 * pad) }, s.body ?? "", head.size, { color: colors.ink });
      inner.at(cy + pad);
      if (ctx.d.card === "rule") vr(ctx, b.x - 16, cy, cardH, 2, f.accentInk);
    }
  }
];

