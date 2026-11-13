import type { ChartSpec, TableSpec } from "../brief/brief.ts";
import { arc, pie } from "d3-shape";
import type { PathContext } from "d3-shape";
import type { PathCommand } from "../model/deck.ts";
import { ellipse, f8, fit, hr, itemsFit, labelFit, pathEl, rect, vr } from "./blocks.ts";
import type { Ctx, Fit, Region } from "./blocks.ts";
import { hair } from "./effects.ts";
import { c8, wrap } from "./fit.ts";
import { hexToOklab, oklchToHex } from "./palette.ts";

const ROW_MAX = 96;
const MARK = 16;
const DONUT_THICKNESS = 0.38;
const LABEL_LINES = 2;
const LEGEND_SPLIT = 6;
const STACK_BELOW = 720;
const PADS = [16, 8, 0];
const RULE_BAND = 8;
const LEGEND_GAP = 32;
const BIG = 100000;
const ARC_PIECE = Math.PI / 12;
const ARC_PAD = 2;
const TAU = Math.PI * 2;

function pathContext(offset: number): { commands: PathCommand[]; context: PathContext } {
  const commands: PathCommand[] = [];
  const at = (n: number): number => Math.round((n + offset) * 1000) / 1000;
  const open = (): boolean => commands.length > 0 && (commands[commands.length - 1] as PathCommand)[0] !== "Z";
  const context: PathContext = {
    moveTo: (x, y) => {
      if (open()) commands.push(["Z"]);
      commands.push(["M", at(x), at(y)]);
    },
    lineTo: (x, y) => void commands.push(["L", at(x), at(y)]),
    closePath: () => void commands.push(["Z"]),
    arc: (cx, cy, r, a0, a1, ccw) => {
      let sweep = a1 - a0;
      if (Math.abs(sweep) >= TAU) sweep = ccw === true ? -TAU : TAU;
      else if (ccw === true && sweep > 0) sweep -= TAU;
      else if (ccw !== true && sweep < 0) sweep += TAU;
      const pieces = Math.max(1, Math.ceil(Math.abs(sweep) / ARC_PIECE));
      const step = sweep / pieces;
      const k = (4 / 3) * Math.tan(step / 4);
      const point = (a: number): [number, number] => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
      const [sx, sy] = point(a0);
      const last = commands[commands.length - 1];
      if (last === undefined || last[0] === "Z") commands.push(["M", at(sx), at(sy)]);
      else if (Math.abs((last[last.length - 2] as number) - at(sx)) > 0.002 || Math.abs((last[last.length - 1] as number) - at(sy)) > 0.002) commands.push(["L", at(sx), at(sy)]);
      for (let i = 0; i < pieces; i++) {
        const from = a0 + i * step;
        const to = from + step;
        const [x0, y0] = point(from);
        const [x1, y1] = point(to);
        commands.push(["C", at(x0 - k * r * Math.sin(from)), at(y0 + k * r * Math.cos(from)), at(x1 + k * r * Math.sin(to)), at(y1 - k * r * Math.cos(to)), at(x1), at(y1)]);
      }
    },
    rect: () => undefined,
    bezierCurveTo: () => undefined,
    quadraticCurveTo: () => undefined
  };
  return { commands, context };
}

function sliceCommands(side: number, startAngle: number, endAngle: number, inner: number): PathCommand[] {
  const radius = side / 2;
  const { commands, context } = pathContext(radius + ARC_PAD);
  arc().innerRadius(radius * inner).outerRadius(radius).context(context)({ startAngle, endAngle });
  return commands;
}

function figure(value: number, unit: string | undefined): string {
  const n = String(Math.round(value * 100) / 100);
  if (unit === undefined || unit === "") return n;
  return unit === "%" ? `${n}%` : `${n} ${unit}`;
}

function tint(hex: string, t: number): string {
  const [L, a, b] = hexToOklab(hex);
  return oklchToHex(L + (1 - L) * t, Math.hypot(a, b) * (1 - t * 0.5), (Math.atan2(b, a) * 180) / Math.PI);
}

function shortFigure(value: number, unit: string | undefined): string {
  return figure(value, unit === "%" ? "%" : undefined);
}

function widest(ctx: Ctx, texts: string[], size: number, max: number): number {
  let need = 8;
  for (const text of texts) {
    let w = 8;
    while (w < max && wrap(text, ctx.d.labelFont, size, ctx.d.labelBold, w).length > 1) w += 8;
    need = Math.max(need, w);
  }
  return Math.min(max, need);
}

function sizesOf(ctx: Ctx): number[] {
  return [ctx.scale.step(0), ctx.scale.step(-1)];
}

function tryFit<T>(ctx: Ctx, sizes: number[], build: (size: number) => T): { size: number; value: T } {
  for (let i = 0; i < sizes.length; i++) {
    const before = ctx.clips;
    const size = sizes[i] as number;
    const value = build(size);
    if (ctx.clips === before || i === sizes.length - 1) return { size, value };
    ctx.clips = before;
  }
  throw new RangeError("no label sizes");
}

function label(ctx: Ctx, region: Region, text: string, size: number, color: string, align: "left" | "center" | "right" = "left"): Fit {
  return labelFit(ctx, region, text, { upper: false, sizes: [size], color, align, role: "label" });
}

function bars(ctx: Ctx, r: Region, spec: ChartSpec): number {
  const f = ctx.f;
  const n = spec.series.length;
  const rowH = Math.min(ROW_MAX, f8(r.h / n));
  const labelW = widest(ctx, spec.series.map((p) => p.label), sizesOf(ctx)[0] as number, f8(r.w * (ctx.portrait ? 0.34 : 0.3))) + 8;
  const valueW = f8(r.w * 0.2);
  const x0 = r.x + labelW + 24;
  const barMax = f8(r.x + r.w - valueW - 16 - x0);
  const max = Math.max(...spec.series.map((p) => p.value));
  const length = (v: number): number => (max === 0 ? 0 : Math.round((v / max) * barMax));
  const built = tryFit(ctx, sizesOf(ctx), (size) => ({
    names: spec.series.map((p) => label(ctx, { x: r.x, y: 0, w: labelW, h: rowH }, p.label, size, f.ink)),
    values: spec.series.map((p) => {
      const x = c8(x0 + length(p.value) + 16);
      return label(ctx, { x, y: 0, w: f8(r.x + r.w - x), h: rowH }, figure(p.value, spec.unit), size, f.ink);
    })
  }));
  vr(ctx, x0 - 8, r.y, n * rowH, ctx.d.fx.line, f.muted);
  const bh = Math.max(8, f8(rowH * 0.6));
  spec.series.forEach((p, i) => {
    const y = r.y + i * rowH;
    const len = length(p.value);
    if (len > 0) rect(ctx, { x: x0, y: y + f8((rowH - bh) / 2), w: len, h: bh }, f.accent, "chart");
    const name = built.value.names[i] as Fit;
    const value = built.value.values[i] as Fit;
    name.at(y + f8((rowH - name.h) / 2));
    value.at(y + f8((rowH - value.h) / 2));
  });
  return n * rowH;
}

function line(ctx: Ctx, r: Region, spec: ChartSpec): number {
  const f = ctx.f;
  const n = spec.series.length;
  const step = f8(r.w / n);
  const start = r.x + f8((r.w - n * step) / 2);
  const centre = (i: number): number => start + i * step + step / 2;
  const lineH = (size: number): number => c8(size * 1.3);
  const span = (i: number, k: number): { x: number; w: number } => {
    const left = f8(Math.max(centre(i) - (k * step) / 2, r.x));
    return { x: left, w: Math.max(8, f8(Math.min(centre(i) + (k * step) / 2, r.x + r.w)) - left) };
  };
  const fits = (size: number, k: number): boolean =>
    spec.series.every((p, i) => {
      if (i % k !== 0) return true;
      const { w } = span(i, k);
      return wrap(p.label, ctx.d.labelFont, size, ctx.d.labelBold, w).length <= LABEL_LINES && wrap(shortFigure(p.value, spec.unit), ctx.d.labelFont, size, ctx.d.labelBold, w).length === 1;
    });
  const sizes = sizesOf(ctx);
  let size = sizes[sizes.length - 1] as number;
  let k = n;
  search: for (const candidate of sizes) {
    for (let each = 1; each <= n; each++) {
      if (fits(candidate, each)) {
        size = candidate;
        k = each;
        break search;
      }
    }
  }
  const shown = spec.series.map((_p, i) => i).filter((i) => i % k === 0);
  const cats = shown.map((i) => label(ctx, { ...span(i, k), y: 0, h: lineH(size) * LABEL_LINES }, (spec.series[i] as { label: string }).label, size, f.muted, "center"));
  const vals = shown.map((i) => label(ctx, { ...span(i, k), y: 0, h: lineH(size) }, shortFigure((spec.series[i] as { value: number }).value, spec.unit), size, f.ink, "center"));
  const unitText = spec.unit === undefined || spec.unit === "" || spec.unit === "%" ? "" : spec.unit;
  const unitFit = unitText === "" ? null : label(ctx, { x: r.x, y: 0, w: r.w, h: lineH(size) }, unitText, size, f.muted);
  const unitH = unitFit === null ? 0 : unitFit.h + 16;
  unitFit?.at(r.y);
  const catH = Math.max(...cats.map((c) => c.h));
  const valH = Math.max(...vals.map((v) => v.h));
  const baseline = f8(r.y + r.h - catH - 16);
  const top = r.y + unitH + valH + 32;
  const plotH = Math.max(8, baseline - top);
  const max = Math.max(...spec.series.map((p) => p.value));
  const at = (v: number): number => baseline - (max === 0 ? 0 : Math.round((v / max) * plotH));
  const plot = { x: start, y: top, w: n * step, h: plotH };
  hr(ctx, start, baseline, n * step, ctx.d.fx.line, f.muted);
  const points = spec.series.map((p, i) => [centre(i) - start, Math.min(plotH, at(p.value) - top)] as [number, number]);
  if (points.length === 2) points.splice(1, 0, [((points[0] as [number, number])[0] + (points[1] as [number, number])[0]) / 2, ((points[0] as [number, number])[1] + (points[1] as [number, number])[1]) / 2]);
  const commands = points.map(([x, y], i) => [i === 0 ? "M" : "L", x, y] as ["M" | "L", number, number]);
  pathEl(ctx, plot, commands, { kind: "none" }, { color: f.accent, width: 4 }, "chart");
  spec.series.forEach((p, i) => {
    const m = i === n - 1 ? MARK + 8 : MARK;
    ellipse(ctx, { x: centre(i) - m / 2, y: at(p.value) - m / 2, w: m, h: m }, f.accent, "chart");
  });
  shown.forEach((i, j) => {
    const value = vals[j] as Fit;
    const { x, w } = span(i, k);
    const under = spec.series.map((q, c) => ({ c, v: q.value })).filter(({ c }) => centre(c) + MARK / 2 > x && centre(c) - MARK / 2 < x + w);
    value.at(f8(Math.min(...under.map(({ v }) => at(v))) - MARK - value.h));
    (cats[j] as Fit).at(baseline + 16);
  });
  return baseline + 16 + catH - r.y;
}

function sliceColors(ctx: Ctx, n: number): string[] {
  const f = ctx.f;
  const palette = [f.accent, f.accent2, tint(f.accent, 0.45), tint(f.accent2, 0.45), f.muted, f.ink];
  const out = Array.from({ length: n }, (_v, i) => palette[i % palette.length] as string);
  if (n > 2 && out[n - 1] === out[0]) out[n - 1] = palette.find((c) => c !== out[0] && c !== out[n - 2]) as string;
  return out;
}

function slices(ctx: Ctx, r: Region, spec: ChartSpec): number {
  const f = ctx.f;
  const stacked = ctx.portrait || r.w < STACK_BELOW;
  const colors = sliceColors(ctx, spec.series.length);
  const total = spec.series.reduce((a, p) => a + p.value, 0);
  const side = f8(stacked ? Math.min(r.w, r.h * 0.55) : Math.min(r.h, r.w * 0.5));
  const box = { x: stacked ? r.x + f8((r.w - side) / 2) : r.x, y: r.y, w: side, h: side };
  const filled = spec.series.filter((p) => p.value > 0);
  const inner = spec.kind === "pie" ? 0 : 1 - DONUT_THICKNESS;
  const padded = { x: box.x - ARC_PAD, y: box.y - ARC_PAD, w: side + 2 * ARC_PAD, h: side + 2 * ARC_PAD };
  if (filled.length === 1 && spec.kind === "pie") ellipse(ctx, box, colors[0] as string, "chart");
  else if (filled.length === 1) pathEl(ctx, padded, sliceCommands(side, 0, TAU, inner), { kind: "solid", color: colors[0] as string }, null, "chart");
  else {
    const angles = pie().sort(null).value((v) => v)(spec.series.map((p) => Math.max(0, p.value)));
    spec.series.forEach((p, i) => {
      if (p.value <= 0) return;
      const a = angles[i] as { startAngle: number; endAngle: number };
      pathEl(ctx, padded, sliceCommands(side, a.startAngle, a.endAngle, inner), { kind: "solid", color: colors[i] as string }, { color: ctx.bg, width: 4 }, "chart");
    });
  }
  if (spec.kind === "donut" && spec.unit !== "%") {
    const hole = f8(side * (1 - DONUT_THICKNESS) * 0.9);
    const size = sizesOf(ctx)[0] as number;
    const centre = label(ctx, { x: box.x + f8((side - hole) / 2), y: 0, w: hole, h: c8(size * 1.3) }, figure(total, spec.unit), size, f.ink, "center");
    centre.at(box.y + f8((side - centre.h) / 2));
  }
  const lx = stacked ? r.x : f8(box.x + side + 48);
  const ly = stacked ? box.y + side + 32 : r.y;
  const lw = stacked ? r.w : r.x + r.w - lx;
  const lh = stacked ? r.y + r.h - ly : r.h;
  const items = spec.series.map((p, i) => ({ i, text: `${p.label}: ${figure(p.value, spec.unit)}${spec.unit === "%" ? "" : ` (${Math.round((p.value / total) * 100)}%)`}` }));
  const columns = items.length > LEGEND_SPLIT ? 2 : 1;
  const colW = f8((lw - (columns - 1) * LEGEND_GAP) / columns);
  const per = Math.ceil(items.length / columns);
  const groups = Array.from({ length: columns }, (_c, c) => items.slice(c * per, (c + 1) * per));
  const legends = groups.map((group, c) => itemsFit(ctx, group.map((it) => it.text), { x: lx + c * (colW + LEGEND_GAP) + 32, w: f8(colW - 32), maxH: lh, gap: 16, sizes: sizesOf(ctx), color: f.ink, role: "label" }));
  const tallest = Math.max(...legends.map((l) => l.total));
  const top = stacked ? ly : r.y + f8(Math.max(0, (Math.min(side, r.h) - tallest) / 2));
  groups.forEach((group, c) => {
    let y = top;
    (legends[c] as { fits: Fit[] }).fits.forEach((item, k) => {
      rect(ctx, { x: lx + c * (colW + LEGEND_GAP), y: y + 8, w: MARK, h: MARK }, colors[(group[k] as { i: number }).i] as string, "chart");
      item.at(y);
      y += item.h + 16;
    });
  });
  return stacked ? top + tallest - r.y : Math.max(side, tallest);
}

export function drawChart(ctx: Ctx, r: Region, spec: ChartSpec): number {
  if (spec.kind === "bar") return bars(ctx, r, spec);
  if (spec.kind === "line") return line(ctx, r, spec);
  return slices(ctx, r, spec);
}

export function drawTable(ctx: Ctx, r: Region, spec: TableSpec): number {
  const f = ctx.f;
  const cols = spec.columns.length;
  const gap = 24;
  const all = [spec.columns, ...spec.rows];
  const weight = spec.columns.map((_c, c) => Math.min(40, Math.max(4, ...all.map((row) => (row[c] as string).length))));
  const room = r.w - gap * (cols - 1);
  const widths = weight.map((wt) => f8((room * wt) / weight.reduce((a, b) => a + b, 0)));
  const xs = widths.map((_w, c) => r.x + widths.slice(0, c).reduce((a, b) => a + b + gap, 0));
  const build = (size: number, pad: number, cap: number): { cells: Fit[][]; heights: number[]; pad: number } => {
    const cells = all.map((row, ri) =>
      row.map((text, c) =>
        fit(ctx, {
          text,
          region: { x: xs[c] as number, y: 0, w: widths[c] as number, h: cap },
          role: size >= ctx.scale.step(0) ? "body" : "label",
          font: ctx.d.bodyFont,
          bold: ri === 0,
          sizes: [size],
          color: ri === 0 ? f.accentInk : f.ink,
          lh: 1.4
        })
      )
    );
    return { cells, pad, heights: cells.map((row) => Math.max(...row.map((cell) => cell.h)) + 2 * pad + RULE_BAND) };
  };
  const sum = (heights: number[]): number => heights.reduce((a, b) => a + b, 0);
  const sizes = sizesOf(ctx);
  let size = sizes[sizes.length - 1] as number;
  let built = build(size, 0, BIG);
  search: for (const candidate of sizes) {
    for (const pad of PADS) {
      const trial = build(candidate, pad, BIG);
      if (sum(trial.heights) <= r.h) {
        size = candidate;
        built = trial;
        break search;
      }
    }
  }
  if (sum(built.heights) > r.h) built = build(size, 0, Math.max(c8(size * 1.4), f8(r.h / all.length) - RULE_BAND));
  const { pad } = built;
  let y = r.y;
  built.cells.forEach((row, ri) => {
    row.forEach((cell) => cell.at(y + pad));
    y += built.heights[ri] as number;
    hr(ctx, r.x, y - RULE_BAND, r.w, ri === 0 ? ctx.d.fx.line * 2 : ctx.d.fx.line, ri === 0 ? f.ink : hair(ctx, f));
  });
  return y - r.y;
}
