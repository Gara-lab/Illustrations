import type { BriefSlide } from "../brief/brief.ts";
import { drawArt } from "./art.ts";
import { GAP, bodyFit, col, f8, fit, figureFit, has, headFit, headSizes, hr, photo, rect, stackY, twoCol, useField } from "./blocks.ts";
import { surfaceFill } from "./effects.ts";
import type { Ctx, Fit, Region, Variant } from "./blocks.ts";
import { sizesBetween } from "./scale.ts";

const BIG = 100000;

function quoteFit(ctx: Ctx, region: Region, text: string, color: string): Fit {
  return fit(ctx, { text, region, role: "quote", font: ctx.headFont, bold: ctx.d.headBold, sizes: headSizes(ctx), color, lh: 1.15 });
}

function byline(ctx: Ctx, region: Region, s: BriefSlide, color: string): Fit | null {
  const by = s.quote?.by;
  return has(by) ? bodyFit(ctx, region, `— ${by}`, BIG, { lead: false, color, role: "label" }) : null;
}

export const QUOTE: Variant[] = [
  {
    id: "quote.mark",
    run(ctx, s) {
      const f = useField(ctx, "base");
      const q = s.quote as { text: string; by?: string };
      const glyph = fit(ctx, { text: "“", region: { x: ctx.M, y: 0, w: 160, h: 256 }, role: "decoration", font: ctx.headFont, bold: ctx.d.headBold, sizes: [ctx.scale.step(7)], color: f.accentInk, lh: 0.6 });
      const label = bodyFit(ctx, { x: ctx.M + 176, y: 0, w: ctx.CW - 176, h: f8(ctx.CH * 0.2) }, s.headline, BIG, { lead: false, bold: true, color: f.muted, role: "label" });
      const attr = byline(ctx, { x: ctx.M, y: 0, w: ctx.CW, h: 96 }, s, f.muted);
      const head = Math.max(glyph.h, label.h);
      const qh = f8(ctx.CH - head - 16 - (attr === null ? 0 : 32 + attr.h));
      const quote = quoteFit(ctx, { x: ctx.M, y: 0, w: ctx.CW, h: qh }, q.text, f.ink);
      const total = head + 16 + quote.h + (attr === null ? 0 : 32 + attr.h);
      const y0 = stackY(ctx, total, 0.25);
      glyph.at(y0);
      label.at(y0 + 8);
      quote.at(y0 + head + 16);
      if (attr !== null) attr.at(y0 + head + 16 + quote.h + 32);
    }
  },
  {
    id: "quote.sidebar",
    run(ctx, s) {
      const f = useField(ctx, "base");
      const q = s.quote as { text: string; by?: string };
      const x = ctx.M + 48;
      const w = ctx.CW - 48;
      const label = bodyFit(ctx, { x: ctx.M, y: 0, w: ctx.CW, h: f8(ctx.CH * 0.2) }, s.headline, BIG, { lead: false, bold: true, color: f.accentInk, role: "label" });
      const attr = byline(ctx, { x, y: 0, w, h: 96 }, s, f.muted);
      const qh = f8(ctx.CH - label.h - 32 - (attr === null ? 0 : 32 + attr.h));
      const quote = quoteFit(ctx, { x, y: 0, w, h: qh }, q.text, f.ink);
      const blockH = quote.h + (attr === null ? 0 : 32 + attr.h);
      const total = label.h + 32 + blockH;
      const y0 = stackY(ctx, total, 0.3);
      label.at(y0);
      const qy = y0 + label.h + 32;
      rect(ctx, { x: ctx.M, y: qy, w: 8, h: blockH }, f.accent, "rule");
      quote.at(qy);
      if (attr !== null) attr.at(qy + quote.h + 32);
    }
  },
  {
    id: "quote.bleed",
    bleed: true,
    run(ctx, s) {
      const f = useField(ctx, "punch");
      const q = s.quote as { text: string; by?: string };
      const label = bodyFit(ctx, { x: ctx.M, y: 0, w: ctx.CW, h: f8(ctx.CH * 0.2) }, s.headline, BIG, { lead: false, bold: true, color: f.ink, role: "label" });
      const attr = byline(ctx, { x: ctx.M, y: 0, w: f8(ctx.CW * 0.7), h: 96 }, s, f.ink);
      const reserve = label.h + 48 + (attr === null ? 0 : 56 + attr.h);
      const quote = quoteFit(ctx, { x: ctx.M, y: 0, w: ctx.CW, h: f8(ctx.CH - reserve) }, q.text, f.ink);
      label.at(ctx.top);
      quote.at(ctx.top + label.h + 48 + f8((ctx.CH - reserve - quote.h) / 2));
      if (attr !== null) {
        const ay = ctx.bottom - attr.h;
        hr(ctx, ctx.M, ay - 32, 96, 4, f.ink);
        attr.at(ay);
      }
    }
  }
];

function figureSizes(ctx: Ctx): number[] {
  return sizesBetween(ctx.scale, ctx.scale.step(4), ctx.scale.step(8));
}

function headBelowFigure(ctx: Ctx, region: Region, s: BriefSlide, figSize: number, color: string): Fit {
  return headFit(ctx, region, s.headline, { color, sizes: sizesBetween(ctx.scale, ctx.scale.step(2), Math.floor(figSize / 2)) });
}

function centredBelow(ctx: Ctx, headEnd: number, total: number): number {
  const room = ctx.bottom - headEnd;
  return Math.min(f8(ctx.bottom - total), f8(headEnd + Math.max(0, (room - total) / 2)));
}

export const NUMBER: Variant[] = [
  {
    id: "number.giant",
    run(ctx, s) {
      const f = useField(ctx, "base");
      const n = s.number as { value: string; label: string };
      const fig = figureFit(ctx, { x: ctx.M, y: 0, w: ctx.CW, h: f8(ctx.CH * 0.45) }, n.value, figureSizes(ctx), { color: f.accentInk });
      const label = bodyFit(ctx, { x: ctx.M, y: 0, w: f8(ctx.CW * (ctx.portrait ? 1 : 0.7)), h: f8(ctx.CH * 0.2) }, n.label, fig.size, { color: f.muted });
      const head = headBelowFigure(ctx, { x: ctx.M, y: 0, w: f8(ctx.CW * (ctx.portrait ? 1 : 0.8)), h: f8(ctx.CH * 0.3) }, s, fig.size, f.ink);
      head.at(ctx.top);
      const total = fig.h + 24 + label.h;
      const y0 = centredBelow(ctx, ctx.top + head.h, total);
      fig.at(y0);
      label.at(y0 + fig.h + 24);
    }
  },
  {
    id: "number.rule",
    run(ctx, s) {
      const f = useField(ctx, "base");
      const n = s.number as { value: string; label: string };
      const headRegion = { x: ctx.M, y: 0, w: f8(ctx.CW * (ctx.portrait ? 1 : 0.8)), h: f8(ctx.CH * 0.3) };
      if (ctx.portrait) {
        const fig = figureFit(ctx, { x: ctx.M, y: 0, w: ctx.CW, h: f8(ctx.CH * 0.35) }, n.value, figureSizes(ctx), { color: f.accentInk });
        const label = bodyFit(ctx, { x: ctx.M, y: 0, w: ctx.CW, h: f8(ctx.CH * 0.2) }, n.label, fig.size, { color: f.muted });
        const head = headBelowFigure(ctx, headRegion, s, fig.size, f.ink);
        head.at(ctx.top);
        const y0 = centredBelow(ctx, ctx.top + head.h, fig.h + 64 + label.h);
        fig.at(y0);
        hr(ctx, ctx.M, y0 + fig.h + 32, ctx.CW, 4, f.ink);
        label.at(y0 + fig.h + 64);
        return;
      }
      const figW = f8(ctx.CW * 0.62);
      const fig = figureFit(ctx, { x: ctx.M, y: 0, w: figW, h: f8(ctx.CH * 0.5) }, n.value, figureSizes(ctx), { color: f.accentInk });
      const lx = ctx.M + figW + GAP;
      const label = bodyFit(ctx, { x: lx, y: 0, w: ctx.W - ctx.M - lx, h: f8(ctx.CH * 0.4) }, n.label, fig.size, { color: f.muted });
      const head = headBelowFigure(ctx, headRegion, s, fig.size, f.ink);
      head.at(ctx.top);
      const tall = Math.max(fig.h, label.h);
      const y0 = centredBelow(ctx, ctx.top + head.h, tall + 32);
      const by = y0 + 32 + tall;
      fig.at(by - fig.h);
      label.at(by - label.h);
      hr(ctx, ctx.M, y0, ctx.CW, 4, f.ink);
    }
  },
  {
    id: "number.split",
    run(ctx, s) {
      const f = useField(ctx, "base");
      const pf = ctx.pal.punch;
      const n = s.number as { value: string; label: string };
      const panel = ctx.portrait ? { x: ctx.M, y: ctx.top, w: ctx.CW, h: f8(ctx.CH * 0.5) } : { x: ctx.M, y: ctx.top, w: f8(ctx.CW * 0.46), h: ctx.CH };
      rect(ctx, panel, surfaceFill(ctx, pf, "bg"), "panel", { lift: true });
      const inner = { x: panel.x + 32, y: panel.y + 32, w: panel.w - 64, h: panel.h - 64 };
      const fig = figureFit(ctx, { ...inner, h: f8(inner.h * 0.6) }, n.value, figureSizes(ctx), { color: pf.ink });
      const label = bodyFit(ctx, { ...inner, h: f8(inner.h * 0.3) }, n.label, fig.size, { color: pf.ink });
      const total = fig.h + 24 + label.h;
      const y0 = inner.y + f8((inner.h - total) / 2);
      fig.at(y0);
      label.at(y0 + fig.h + 24);
      const region = ctx.portrait
        ? { x: ctx.M, y: panel.y + panel.h + GAP, w: ctx.CW, h: ctx.bottom - panel.y - panel.h - GAP }
        : { x: panel.x + panel.w + GAP, y: ctx.top, w: ctx.W - ctx.M - panel.x - panel.w - GAP, h: ctx.CH };
      const head = headBelowFigure(ctx, region, s, fig.size, f.ink);
      const y = ctx.portrait ? region.y : region.y + f8((region.h - head.h) / 2);
      head.at(y);
    }
  }
];

function media(ctx: Ctx, r: Region, s: BriefSlide, tone: "surface" | "bg", within?: Region): void {
  const img = s.image as NonNullable<BriefSlide["image"]>;
  if ("file" in img) photo(ctx, r, ctx.photoAssetId);
  else drawArt(ctx, r, ctx.f, tone, img.draw, within);
}

function captionOf(s: BriefSlide): string | undefined {
  const img = s.image;
  return img !== undefined && "file" in img ? img.caption : undefined;
}

export const IMAGE: Variant[] = [
  {
    id: "image.side",
    bleed: true,
    run(ctx, s) {
      const f = useField(ctx, "base");
      const cap = captionOf(s);
      const { a, stacked, hc } = twoCol(ctx, s.headline, { floor: 6 });
      const mediaX = col(ctx, hc + 1, 4).x;
      const mediaR = stacked ? { x: 0, y: 0, w: ctx.W, h: f8(ctx.H * 0.46) } : { x: mediaX, y: 0, w: ctx.W - mediaX, h: ctx.H };
      media(ctx, mediaR, s, "surface");
      const region = stacked ? { x: ctx.M, y: mediaR.h + GAP, w: ctx.CW, h: ctx.bottom - mediaR.h - GAP } : a;
      const head = headFit(ctx, { ...region, h: f8(region.h * 0.6) }, s.headline);
      const capFit = has(cap) ? bodyFit(ctx, { ...region, h: f8(region.h * 0.3) }, cap, head.size, { lead: false, color: f.muted, role: "caption" }) : null;
      const block = head.h + (capFit === null ? 0 : 32 + capFit.h);
      const y0 = stacked ? region.y : region.y + Math.max(0, f8((region.h - block) / 2));
      head.at(y0);
      if (capFit !== null) {
        capFit.at(y0 + head.h + 32);
      }
    }
  },
  {
    id: "image.wide",
    run(ctx, s) {
      const f = useField(ctx, "base");
      const cap = captionOf(s);
      const head = headFit(ctx, { x: ctx.M, y: ctx.top, w: f8(ctx.CW * (ctx.portrait ? 1 : 0.85)), h: f8(ctx.CH * 0.3) }, s.headline);
      const capFit = has(cap) ? bodyFit(ctx, { x: ctx.M, y: 0, w: f8(ctx.CW * (ctx.portrait ? 1 : 0.8)), h: f8(ctx.CH * 0.16) }, cap, head.size, { lead: false, color: f.muted, role: "caption" }) : null;
      head.at(ctx.top);
      const my = ctx.top + head.h + 32;
      const mh = f8(ctx.bottom - my - (capFit === null ? 0 : 24 + capFit.h));
      media(ctx, { x: ctx.M, y: my, w: ctx.CW, h: mh }, s, "surface");
      if (capFit !== null) capFit.at(my + mh + 24);
    }
  },
  {
    id: "image.bleed",
    bleed: true,
    ok: (ctx, s) => s.image !== undefined && ("file" in s.image || ctx.icon !== null),
    run(ctx, s) {
      const f = useField(ctx, "base");
      const cap = captionOf(s);
      const pw = ctx.portrait ? ctx.W : f8(ctx.W * 0.68);
      const tw = ctx.portrait ? ctx.CW : pw - ctx.M - 48;
      const head = headFit(ctx, { x: ctx.M, y: 0, w: tw, h: f8(ctx.CH * 0.5) }, s.headline);
      const capFit = has(cap) ? bodyFit(ctx, { x: ctx.M, y: 0, w: tw, h: f8(ctx.CH * 0.2) }, cap, head.size, { lead: false, color: f.muted, role: "caption" }) : null;
      const total = head.h + (capFit === null ? 0 : 24 + capFit.h);
      const y0 = ctx.bottom - total;
      media(ctx, { x: 0, y: 0, w: ctx.W, h: ctx.H }, s, "bg", { x: ctx.M, y: ctx.top, w: ctx.CW, h: f8(y0 - 48 - GAP - ctx.top) });
      rect(ctx, { x: 0, y: y0 - 48, w: pw, h: ctx.H - y0 + 48 }, surfaceFill(ctx, f, "bg"), "panel", { lift: true });
      head.at(y0);
      if (capFit !== null) capFit.at(y0 + head.h + 24);
    }
  }
];
