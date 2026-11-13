import type { Fill, Shadow, Stroke } from "../model/deck.ts";
import type { Ctx } from "./blocks.ts";
import { contrast } from "./palette.ts";
import type { Field } from "./palette.ts";

const WHITE = "#FFFFFF";
const BLACK = "#000000";
const GRADIENT_ANGLE = 135;
const PANEL_TINT = 0.1;
const PANEL_TINT_GRADIENT = 0.28;

const veil = (f: Field): string => (contrast(f.ink, WHITE) > contrast(f.ink, BLACK) ? WHITE : BLACK);

function solid(color: string, alpha: number): Fill {
  return alpha >= 1 ? { kind: "solid", color } : { kind: "solid", color, alpha };
}

export const hair = (ctx: Ctx, f: Field): Fill => solid(f.ink, ctx.d.fx.ruleAlpha);

export function hairStroke(ctx: Ctx, f: Field, width: number): Stroke {
  const alpha = ctx.d.fx.ruleAlpha;
  return alpha >= 1 ? { color: f.ink, width } : { color: f.ink, width, alpha };
}

export function surfaceFill(ctx: Ctx, f: Field, base: "surface" | "bg"): Fill {
  const fx = ctx.d.fx;
  if (fx.fill === "gradient") return { kind: "gradient", angle: GRADIENT_ANGLE, stops: [{ color: f.bg, at: 0 }, { color: f.surface, at: 1 }] };
  if (base === "bg") return solid(f.bg, 1);
  if (fx.fill === "translucent") return solid(veil(f), fx.fillAlpha);
  return solid(f.surface, 1);
}

export function panelFill(ctx: Ctx, f: Field, base: "surface" | "bg"): Fill {
  const fx = ctx.d.fx;
  if (fx.fill === "gradient") return { kind: "gradient", angle: GRADIENT_ANGLE, stops: [{ color: f.bg, at: 0 }, { color: f.accent, at: 1, alpha: PANEL_TINT_GRADIENT }] };
  if (fx.fill === "translucent" && base === "surface") return solid(f.accent, PANEL_TINT);
  return surfaceFill(ctx, f, base);
}

export function shadowOf(ctx: Ctx): Shadow | undefined {
  const s = ctx.d.fx.shadow;
  return s === null ? undefined : { dx: s.dx, dy: s.dy, blur: s.blur, color: BLACK, alpha: s.alpha };
}
