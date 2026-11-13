import { iconLayers } from "../catalog/icon-catalog.ts";
import { bodyFit, f8, iconPaths, rect } from "./blocks.ts";
import type { Ctx, Region } from "./blocks.ts";
import { panelFill } from "./effects.ts";
import { c8 } from "./fit.ts";
import type { Field } from "./palette.ts";

const MIN_PANEL = 96;
const ICON_SHARE = 0.5;
const SHORT_PANEL = 160;
const SHORT_ICON_SHARE = 0.75;
const FREE_ICON_SHARE = 0.8;
const NOTE_PAD = 32;
const MIN_NOTE = 192;

function noteBox(ctx: Ctx, r: Region): Region {
  const x0 = Math.max(r.x + NOTE_PAD, ctx.M);
  const x1 = Math.min(r.x + r.w - NOTE_PAD, ctx.W - ctx.M);
  const y0 = Math.max(r.y + NOTE_PAD, ctx.M);
  const y1 = Math.min(r.y + r.h - NOTE_PAD, ctx.H - ctx.M);
  return { x: c8(x0), y: c8(y0), w: f8(x1) - c8(x0), h: f8(y1) - c8(y0) };
}

export function drawArt(ctx: Ctx, r: Region, f: Field, tone: "surface" | "bg", text?: string, free?: Region): void {
  rect(ctx, r, panelFill(ctx, f, tone), "panel");
  const area = free ?? r;
  if (area.w < MIN_PANEL || area.h < MIN_PANEL) return;
  const layers = ctx.icon === null ? null : iconLayers(ctx.icon, ctx.d.iconFamily);
  if (ctx.icon !== null && layers !== null) {
    const side = Math.min(area.w, area.h);
    const share = free !== undefined ? FREE_ICON_SHARE : side <= SHORT_PANEL ? SHORT_ICON_SHARE : ICON_SHARE;
    const d = f8(side * share);
    iconPaths(ctx, { x: area.x + f8((area.w - d) / 2), y: area.y + f8((area.h - d) / 2), w: d, h: d }, layers, f.accent);
    ctx.artDrawn.push(ctx.icon);
    return;
  }
  if (text === undefined) return;
  const box = noteBox(ctx, r);
  if (box.w < MIN_NOTE || box.h < MIN_NOTE / 2) return;
  const cap = bodyFit(ctx, box, text, ctx.scale.step(0) * 2, { lead: false, color: f.ink, role: "caption", italic: true, align: "center" });
  cap.at(box.y + f8((box.h - cap.h) / 2));
}
