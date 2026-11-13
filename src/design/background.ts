import type { SlideIntent } from "../brief/brief.ts";
import type { Element, Fill, ShapeEl } from "../model/deck.ts";
import { createRng } from "../seed/rng.ts";
import type { Ctx } from "./blocks.ts";
import type { DirectionId } from "./directions.ts";
import { contrast } from "./palette.ts";

export interface SlideBackground { background: Fill; scrim: ShapeEl | null }

const NEED = 4.5;
const SAMPLES = 8;
const SCRIM_ALPHAS = [0.7, 0.78, 0.86, 0.92, 0.96];
const STRONG_MIX = [0.5, 0.35, 0.2];
const SUBTLE_MIX = [0.8, 0.5];
const STREAM_SALT = 0x5bd1e995;
const WEIGHTS: Record<DirectionId, { photo: number; gradient: number; subtle: number }> = {
  editorial: { photo: 0.3, gradient: 0.4, subtle: 0.5 },
  bold: { photo: 0.2, gradient: 0.6, subtle: 0.3 },
  technical: { photo: 0.15, gradient: 0.35, subtle: 0.2 }
};

const channels = (hex: string): number[] => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

export function mix(a: string, b: string, t: number): string {
  const ca = channels(a);
  const cb = channels(b);
  const out = ca.map((v, i) => Math.round(v + ((cb[i] as number) - v) * t));
  return `#${out.map((v) => v.toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}

export function worstBlends(color: string, alpha: number): string[] {
  return [mix("#000000", color, alpha), mix("#FFFFFF", color, alpha)];
}

export function backdropColors(fill: Fill): string[] {
  if (fill.kind === "solid") return [fill.color];
  if (fill.kind !== "gradient") return [];
  const out: string[] = [];
  for (let i = 0; i + 1 < fill.stops.length; i++) {
    const a = fill.stops[i];
    const b = fill.stops[i + 1];
    if (a === undefined || b === undefined) continue;
    for (let k = 0; k <= SAMPLES; k++) out.push(mix(a.color, b.color, k / SAMPLES));
  }
  return out;
}

function exposedColors(els: Element[]): string[] {
  const out = new Set<string>();
  els.forEach((e, i) => {
    if (e.type !== "text") return;
    const held = els.slice(0, i).some((s) => s.type === "shape" && s.role !== "scrim" && opaqueFill(s.fill) && s.x <= e.x && s.y <= e.y && s.x + s.w >= e.x + e.w && s.y + s.h >= e.y + e.h);
    if (held) return;
    out.add(e.color);
    for (const p of e.paragraphs) for (const r of p.runs) if (r.color !== undefined) out.add(r.color);
  });
  return [...out];
}

export const opaqueFill = (fill: Fill): boolean =>
  fill.kind === "solid" ? (fill.alpha ?? 1) === 1 : fill.kind === "gradient" && fill.stops.every((st) => (st.alpha ?? 1) === 1);

const holds = (colors: string[], backs: string[]): boolean => colors.every((c) => backs.every((b) => contrast(c, b) >= NEED));

type Kind = "photo" | "gradient" | "band" | "solid";

export function slideBackground(ctx: Ctx, intent: SlideIntent): SlideBackground {
  const solid: SlideBackground = { background: { kind: "solid", color: ctx.bg }, scrim: null };
  const rng = createRng((ctx.artSeed ^ STREAM_SALT) >>> 0);
  const w = WEIGHTS[ctx.d.id];
  const colors = exposedColors(ctx.els);
  const strong = intent === "section" || intent === "closing";
  const u = rng.next();
  const angle = rng.pick([90, 135, 180]);
  const tintFrom = rng.pick([ctx.f.accent, ctx.f.accent2]);

  const gradient = (kind: "gradient" | "band", mixes: number[], target: string, deg: number): Fill | null => {
    for (const m of mixes) {
      const tint = mix(ctx.bg, target, m);
      if (tint === ctx.bg) continue;
      const stops = kind === "band" ? [{ color: ctx.bg, at: 0 }, { color: ctx.bg, at: 0.55 }, { color: tint, at: 1 }] : [{ color: ctx.bg, at: 0 }, { color: tint, at: 1 }];
      const fill: Fill = { kind: "gradient", angle: deg, stops };
      if (holds(colors, backdropColors(fill))) return fill;
    }
    return null;
  };

  const photo = (): SlideBackground | null => {
    if (ctx.photoAssetId === "") return null;
    for (const alpha of SCRIM_ALPHAS) {
      if (!holds(colors, worstBlends(ctx.bg, alpha))) continue;
      const scrim: ShapeEl = {
        id: `${ctx.slideId}-bg`,
        type: "shape",
        shape: "rect",
        x: 0,
        y: 0,
        w: ctx.W,
        h: ctx.H,
        rotation: 0,
        animation: null,
        role: "scrim",
        fill: { kind: "solid", color: ctx.bg, alpha },
        stroke: null,
        radius: 0
      };
      return { background: { kind: "image", assetId: ctx.photoAssetId, fit: "cover" }, scrim };
    }
    return null;
  };

  if (!strong) {
    if (u >= w.subtle) return solid;
    const fill = gradient("gradient", SUBTLE_MIX, ctx.f.surface, angle);
    return fill === null ? solid : { background: fill, scrim: null };
  }
  const first: Kind = u < w.photo ? "photo" : u < w.photo + w.gradient ? "gradient" : "band";
  const order: Kind[] = [first, "gradient", "band", "solid"].filter((k, i, all) => all.indexOf(k) === i) as Kind[];
  for (const kind of order) {
    if (kind === "photo") {
      const p = photo();
      if (p !== null) return p;
    } else if (kind !== "solid") {
      const fill = gradient(kind, STRONG_MIX, tintFrom, angle);
      if (fill !== null) return { background: fill, scrim: null };
    }
  }
  return solid;
}
