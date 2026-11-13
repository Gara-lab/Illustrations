import type { BriefSlide } from "../brief/brief.ts";
import { GAP, GUTTER, bodyFit, card, ellipse, f8, fit, figureFit, has, headFit, hr, itemsFit, labelFit, secondary, stackY, twoCol, useField, vr } from "./blocks.ts";
import type { Ctx, Fit, Region, Variant } from "./blocks.ts";
import { hair } from "./effects.ts";
import { c8 } from "./fit.ts";

const pad2 = (i: number): string => String(i + 1).padStart(2, "0");

const headRoom = (ctx: Ctx, n: number): number => f8(ctx.CH * (n >= 7 ? 0.3 : 0.5));

interface HeadBlock { head: Fit; body: Fit | null; h: number; place(y: number): void }

function headBlock(ctx: Ctx, region: Region, s: BriefSlide): HeadBlock {
  const head = headFit(ctx, { ...region, h: f8(region.h * 0.85) }, s.headline);
  const room = Math.max(40, Math.min(f8(region.h * 0.4), f8(region.h - head.h - 24)));
  const body = has(s.body) ? bodyFit(ctx, { ...region, h: room }, s.body, head.size, { color: ctx.f.muted }) : null;
  const h = head.h + (body === null ? 0 : 24 + body.h);
  return {
    head,
    body,
    h,
    place(y: number): void {
      head.at(y);
      if (body !== null) body.at(y + head.h + 24);
    }
  };
}

function pointsOf(s: BriefSlide): string[] {
  return s.points ?? [];
}

function listText(s: BriefSlide): string {
  return pointsOf(s).join(" ");
}

function circleNumber(ctx: Ctx, x: number, y: number, size: number, label: string): void {
  const f = ctx.f;
  ellipse(ctx, { x, y, w: size, h: size }, f.accent, "marker");
  fit(ctx, { text: label, region: { x, y: 0, w: size, h: 32 }, role: "label", font: ctx.d.figureFont, bold: true, sizes: [ctx.scale.step(0)], color: f.onAccent, lh: 1.05, align: "center" }).at(y + (size - 32) / 2);
}

function cardGrid(ctx: Ctx, s: BriefSlide, prefix: string): void {
  const f = useField(ctx, "base");
  const pts = pointsOf(s);
  const n = pts.length;
  const hw = ctx.portrait ? ctx.CW : f8(ctx.CW * 0.9);
  const hb = headBlock(ctx, { x: ctx.M, y: ctx.top, w: hw, h: headRoom(ctx, n) }, s);
  const cols = ctx.portrait ? 1 : n <= 3 ? n : n === 4 ? 2 : n <= 6 ? 3 : 4;
  const rowsN = Math.ceil(n / cols);
  const counts: number[] = [];
  let left = n;
  for (let r = 0; r < rowsN; r++) {
    const c = Math.ceil(left / (rowsN - r));
    counts.push(c);
    left -= c;
  }
  const availH = ctx.CH - hb.h - GAP;
  const budget = f8((availH - (rowsN - 1) * GUTTER) / rowsN);
  const pad = 24;
  const overhead = 2 * pad + 40;
  const minCardW = Math.min(...counts.map((m) => f8((ctx.CW - GUTTER * (m - 1)) / m)));
  const sizes = secondary(ctx, hb.head.size, [ctx.scale.step(1), ctx.scale.step(0)]);
  let size = sizes[sizes.length - 1] as number;
  for (const sz of sizes) {
    const before = ctx.clips;
    const ok = pts.every((p) => {
      const probed = fit(ctx, { text: p, region: { x: 0, y: 0, w: minCardW - 2 * pad, h: 100000 }, role: "body", font: ctx.d.bodyFont, bold: false, sizes: [sz], color: f.ink, lh: 1.4 });
      return probed.h <= budget - overhead && !probed.broken;
    });
    ctx.clips = before;
    if (ok) {
      size = sz;
      break;
    }
  }
  const probe = (text: string, w: number): Fit => fit(ctx, { text, region: { x: 0, y: 0, w, h: Math.max(c8(size * 1.4), budget - overhead) }, role: "body", font: ctx.d.bodyFont, bold: false, sizes: [size], color: f.ink, lh: 1.4 });
  let need = 0;
  let idx = 0;
  counts.forEach((m) => {
    const w = f8((ctx.CW - GUTTER * (m - 1)) / m);
    for (let k = 0; k < m; k++) need = Math.max(need, probe(pts[idx + k] as string, k === m - 1 ? ctx.CW - (m - 1) * (w + GUTTER) - 2 * pad : w - 2 * pad).h);
    idx += m;
  });
  const rowH = need + overhead;
  const total = hb.h + GAP + rowsN * rowH + (rowsN - 1) * GUTTER;
  const y0 = stackY(ctx, total, 0.3);
  hb.place(y0);
  let y = y0 + hb.h + GAP;
  idx = 0;
  counts.forEach((m) => {
    const w = f8((ctx.CW - GUTTER * (m - 1)) / m);
    for (let k = 0; k < m; k++) {
      const cw = k === m - 1 ? ctx.CW - (m - 1) * (w + GUTTER) : w;
      const cx = ctx.M + k * (w + GUTTER);
      const colors = card(ctx, { x: cx, y, w: cw, h: rowH }, idx + k);
      labelFit(ctx, { x: cx + pad, y: 0, w: cw - 2 * pad, h: 32 }, `${prefix}${pad2(idx + k)}`, { color: colors.accent }).at(y + pad);
      fit(ctx, { text: pts[idx + k] as string, region: { x: cx + pad, y: 0, w: cw - 2 * pad, h: need }, role: "body", font: ctx.d.bodyFont, bold: false, sizes: [size], color: colors.ink, lh: 1.4 }).at(y + pad + 40);
    }
    idx += m;
    y += rowH + GUTTER;
  });
}

export const POINTS: Variant[] = [
  {
    id: "points.numbered",
    run(ctx, s) {
      const f = useField(ctx, "base");
      const pts = pointsOf(s);
      const wide = !ctx.portrait && s.headline.length > 48;
      const split = twoCol(ctx, s.headline, { text: listText(s), floor: 4 });
      const stacked = split.stacked || wide;
      const room = headRoom(ctx, pts.length);
      const region = wide ? { x: ctx.M, y: ctx.top, w: f8(ctx.CW * 0.9), h: room } : stacked ? { ...split.a, h: room } : split.a;
      const hb = headBlock(ctx, region, s);
      const nCols = wide ? 2 : 1;
      const colW = wide ? f8((ctx.CW - GAP) / 2) : stacked ? ctx.CW : split.b.w;
      const baseX = stacked ? ctx.M : split.b.x;
      const half = Math.ceil(pts.length / 2);
      const groups = nCols === 1 ? [pts] : [pts.slice(0, half), pts.slice(half)].filter((g) => g.length > 0);
      const availH = stacked ? ctx.CH - hb.h - GAP : ctx.CH;
      const numW = 96;
      const fitGroups = (size: number) => groups.map((g) => itemsFit(ctx, g, { x: 0, w: colW - numW - 16, maxH: availH, gap: 24, sizes: [size], color: f.ink }));
      const sizeCands = secondary(ctx, hb.head.size, [ctx.scale.step(1), ctx.scale.step(0)]);
      let items = fitGroups(sizeCands[sizeCands.length - 1] as number);
      for (const size of sizeCands) {
        const before = ctx.clips;
        const tried = fitGroups(size);
        if (ctx.clips === before) {
          items = tried;
          break;
        }
        ctx.clips = before;
      }
      const cands = secondary(ctx, hb.head.size, [ctx.scale.step(3), ctx.scale.step(2), ctx.scale.step(1), ctx.scale.step(0)]);
      const rowsFor = (ns: number): number[][] => items.map((g) => g.fits.map((it) => Math.max(c8(ns * 1.05), it.h)));
      const total = (rows: number[]): number => rows.reduce((x, y) => x + y, 0) + 24 * (rows.length - 1);
      const worst = (all: number[][]): number => Math.max(...all.map(total));
      let ns = cands[cands.length - 1] as number;
      for (const c of cands) {
        if (worst(rowsFor(c)) <= availH) {
          ns = c;
          break;
        }
      }
      const rows = rowsFor(ns);
      const listH = worst(rows);
      const y0 = stacked ? stackY(ctx, hb.h + GAP + listH, 0.2) : stackY(ctx, Math.max(hb.h, listH), 0.35);
      hb.place(y0);
      items.forEach((group, g) => {
        const x = baseX + g * (colW + GAP);
        let y = stacked ? y0 + hb.h + GAP : y0;
        group.fits.forEach((it, i) => {
          figureFit(ctx, { x, y: 0, w: numW, h: 128 }, pad2(g * half + i), [ns], { color: f.accentInk }).at(y);
          fit(ctx, { text: it.text, region: { x: x + numW + 16, y: 0, w: colW - numW - 16, h: it.h }, role: "body", font: ctx.d.bodyFont, bold: false, sizes: [group.size], color: f.ink, lh: 1.4 }).at(y);
          const rowH = (rows[g] as number[])[i] as number;
          if (i < group.fits.length - 1) hr(ctx, x, y + rowH + 8, colW, ctx.d.fx.line, hair(ctx, f));
          y += rowH + 24;
        });
      });
    }
  },
  {
    id: "points.cards",
    ok: (_ctx, s) => pointsOf(s).length <= 6,
    run(ctx, s) {
      cardGrid(ctx, s, "");
    }
  },
  {
    id: "points.staggered",
    run(ctx, s) {
      const f = useField(ctx, "base");
      const pts = pointsOf(s);
      const hw = ctx.portrait ? ctx.CW : f8(ctx.CW * 0.9);
      const hb = headBlock(ctx, { x: ctx.M, y: ctx.top, w: hw, h: headRoom(ctx, pts.length) }, s);
      const w = ctx.CW;
      const availH = ctx.CH - hb.h - GAP - 32;
      const items = itemsFit(ctx, pts, { x: 0, w: w - 96, maxH: availH, gap: 32, sizes: secondary(ctx, hb.head.size, [ctx.scale.step(1), ctx.scale.step(0)]), color: f.ink });
      const listH = items.total + 32;
      const y0 = stackY(ctx, hb.h + GAP + listH, 0.25);
      hb.place(y0);
      let y = y0 + hb.h + GAP;
      items.fits.forEach((it, i) => {
        const x = ctx.M;
        hr(ctx, x, y, w, ctx.d.fx.line, hair(ctx, f));
        labelFit(ctx, { x, y: 0, w: 80, h: 32 }, pad2(i), { color: f.accentInk }).at(y + 16);
        const placed = fit(ctx, { text: it.text, region: { x: x + 96, y: 0, w: w - 96, h: it.h }, role: "body", font: ctx.d.bodyFont, bold: false, sizes: [items.size], color: f.ink, lh: 1.4 });
        placed.at(y + 16);
        y += 16 + it.h + 16;
      });
    }
  }
];

export const STEPS: Variant[] = [
  {
    id: "steps.timeline",
    ok: (ctx, s) => !ctx.portrait && pointsOf(s).length <= 5,
    run(ctx, s) {
      const f = useField(ctx, "base");
      const pts = pointsOf(s);
      const n = pts.length;
      const hb = headBlock(ctx, { x: ctx.M, y: ctx.top, w: f8(ctx.CW * 0.9), h: f8(ctx.CH * 0.5) }, s);
      const colW = f8((ctx.CW - (n - 1) * GUTTER) / n);
      const availH = ctx.CH - hb.h - 64 - 104;
      const sizes = secondary(ctx, hb.head.size, [ctx.scale.step(0)]);
      const fits = pts.map((p) => fit(ctx, { text: p, region: { x: 0, y: 0, w: colW, h: Math.max(48, f8(availH)) }, role: "body", font: ctx.d.bodyFont, bold: false, sizes, color: f.ink, lh: 1.4 }));
      const textH = Math.max(...fits.map((x) => x.h));
      const y0 = stackY(ctx, hb.h + 64 + 104 + textH, 0.3);
      hb.place(y0);
      const lineY = y0 + hb.h + 64 + 56;
      hr(ctx, ctx.M, lineY, ctx.CW, ctx.d.fx.line, hair(ctx, f));
      pts.forEach((p, i) => {
        const x = ctx.M + i * (colW + GUTTER);
        labelFit(ctx, { x, y: 0, w: colW, h: 32 }, pad2(i), { color: f.accentInk }).at(lineY - 56);
        ellipse(ctx, { x, y: lineY - 16, w: 32, h: 32 }, i === 0 ? f.accent : f.accent2, "marker");
        fit(ctx, { text: p, region: { x, y: 0, w: colW, h: textH }, role: "body", font: ctx.d.bodyFont, bold: false, sizes, color: f.ink, lh: 1.4 }).at(lineY + 48);
      });
    }
  },
  {
    id: "steps.stair",
    ok: (ctx, s) => ctx.portrait || pointsOf(s).length <= 6,
    run(ctx, s) {
      const f = useField(ctx, "base");
      const pts = pointsOf(s);
      const n = pts.length;
      const hb = headBlock(ctx, { x: ctx.M, y: ctx.top, w: ctx.portrait ? ctx.CW : f8(ctx.CW * 0.9), h: f8(ctx.CH * 0.5) }, s);
      const stepX = n > 1 ? f8(Math.min(ctx.portrait ? 48 : 96, (ctx.CW * 0.3) / (n - 1))) : 0;
      const textX = 88;
      const tw = ctx.CW - (n - 1) * stepX - textX;
      const availH = ctx.CH - hb.h - GAP;
      const gap = 16;
      let cs = 48;
      const items = itemsFit(ctx, pts, { x: 0, w: tw, maxH: availH, gap, sizes: secondary(ctx, hb.head.size, [ctx.scale.step(1), ctx.scale.step(0)]), color: f.ink });
      for (const c of [64, 48]) {
        const rows = items.fits.map((it) => Math.max(c, it.h));
        if (rows.reduce((a, b) => a + b, 0) + gap * (n - 1) <= availH) {
          cs = c;
          break;
        }
      }
      const rows = items.fits.map((it) => Math.max(cs, it.h));
      const listH = rows.reduce((a, b) => a + b, 0) + gap * (n - 1);
      const y0 = stackY(ctx, hb.h + GAP + listH, 0.2);
      hb.place(y0);
      let y = y0 + hb.h + GAP;
      items.fits.forEach((it, i) => {
        const x = ctx.M + i * stepX;
        circleNumber(ctx, x, y + f8(((rows[i] as number) - cs) / 2), cs, pad2(i));
        fit(ctx, { text: it.text, region: { x: x + textX, y: 0, w: tw, h: it.h }, role: "body", font: ctx.d.bodyFont, bold: false, sizes: [items.size], color: f.ink, lh: 1.4 }).at(y + f8(((rows[i] as number) - it.h) / 2));
        y += (rows[i] as number) + gap;
      });
    }
  },
  {
    id: "steps.cards",
    ok: (_ctx, s) => pointsOf(s).length <= 6,
    run(ctx, s) {
      cardGrid(ctx, s, "Step ");
    }
  },
  {
    id: "steps.rail",
    run(ctx, s) {
      const f = useField(ctx, "base");
      const pts = pointsOf(s);
      const n = pts.length;
      const { a, b, stacked } = twoCol(ctx, s.headline, { text: listText(s), floor: 4 });
      const hb = headBlock(ctx, stacked ? { ...a, h: headRoom(ctx, n) } : a, s);
      const availH = stacked ? ctx.CH - hb.h - GAP : ctx.CH;
      const cs = 48;
      const gap = 16;
      const items = itemsFit(ctx, pts, { x: 0, w: b.w - 72, maxH: availH, gap, sizes: secondary(ctx, hb.head.size, [ctx.scale.step(1), ctx.scale.step(0)]), color: f.ink });
      const rows = items.fits.map((it) => Math.max(cs, it.h));
      const listH = rows.reduce((x, y) => x + y, 0) + gap * (n - 1);
      const y0 = stacked ? stackY(ctx, hb.h + GAP + listH, 0.2) : stackY(ctx, Math.max(hb.h, listH), 0.35);
      hb.place(y0);
      const start = stacked ? y0 + hb.h + GAP : y0;
      if (listH > cs) vr(ctx, b.x + cs / 2, start + cs / 2, listH - cs, ctx.d.fx.line, hair(ctx, f));
      let y = start;
      items.fits.forEach((it, i) => {
        circleNumber(ctx, b.x, y, cs, pad2(i));
        fit(ctx, { text: it.text, region: { x: b.x + 72, y: 0, w: b.w - 72, h: it.h }, role: "body", font: ctx.d.bodyFont, bold: false, sizes: [items.size], color: f.ink, lh: 1.4 }).at(y + f8(((rows[i] as number) - it.h) / 2));
        y += (rows[i] as number) + gap;
      });
    }
  }
];
