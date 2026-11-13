import { PATH_ARITY } from "../model/deck.ts";
import type { Fill, GradientStop, PathEl, ShapeEl, Shadow, Stroke } from "../model/deck";
import { unescapeXml } from "./xml.ts";

export type PaintFill = Extract<Fill, { kind: "solid" | "gradient" }>;
export interface Effects { fill?: PaintFill; lineAlpha?: number; shadow?: Shadow; textShadow?: Shadow; geometry?: string; linecap?: NonNullable<Stroke["linecap"]>; linejoin?: NonNullable<Stroke["linejoin"]> }
export type EffectMap = Map<string, Effects>;
export interface SlideEffects { named: EffectMap; background: PaintFill | null }

const EMU_PER_PX = 9525;
const ANGLE_UNIT = 60000;
const PERCENT_UNIT = 100000;
const SHAPE_BLOCK = /<p:(sp|pic|cxnSp)>[\s\S]*?<\/p:\1>/g;
const BLOCK_NAME = /<p:cNvPr id="\d+" name="([^"]*)"/;
const OUTLINE = /(<a:ln\b[^>]*>)([^]+?)<\/a:ln>/;
const GEOMETRY = /<a:prstGeom\b[^>]*>[^]*?<\/a:prstGeom>/;
const SHAPE_FILL = /(<\/a:prstGeom>)<a:solidFill>[\s\S]*?<\/a:solidFill>/;
const LINE_FILL = /(<a:ln\b[^>]*>)<a:solidFill><a:srgbClr val="([0-9A-Fa-f]{6})"\/><\/a:solidFill>/;
const RUN_PROPS = /(<a:rPr\b[^>]*>)([\s\S]*?)(<\/a:rPr>)/g;
const EXISTING_EFFECTS = /<a:effectLst>[\s\S]*?<\/a:effectLst>/;
const BACKGROUND = /<p:bg>[\s\S]*?<\/p:bg>/;

const CAP_ATTR = { butt: "flat", round: "rnd", square: "sq" } as const;
const JOIN_XML = { miter: '<a:miter lim="800000"/>', round: "<a:round/>", bevel: "<a:bevel/>" } as const;

const isTranslucent = (alpha: number | undefined): alpha is number => typeof alpha === "number" && alpha < 1;
const alphaOf = (alpha: number): number => Math.round(Math.max(0, alpha) * PERCENT_UNIT);

function colourXml(color: string, alpha: number | undefined): string {
  const val = color.slice(1).toUpperCase();
  return isTranslucent(alpha) ? `<a:srgbClr val="${val}"><a:alpha val="${alphaOf(alpha)}"/></a:srgbClr>` : `<a:srgbClr val="${val}"/>`;
}

function fillXml(fill: PaintFill): string {
  if (fill.kind === "solid") return `<a:solidFill>${colourXml(fill.color, fill.alpha)}</a:solidFill>`;
  const stops = fill.stops.map((s: GradientStop) => `<a:gs pos="${Math.round(s.at * PERCENT_UNIT)}">${colourXml(s.color, s.alpha)}</a:gs>`).join("");
  const angle = Math.round((((fill.angle % 360) + 360) % 360) * ANGLE_UNIT);
  return `<a:gradFill rotWithShape="1"><a:gsLst>${stops}</a:gsLst><a:lin ang="${angle}" scaled="0"/></a:gradFill>`;
}

function shadowXml(shadow: Shadow): string {
  const dist = Math.round(Math.hypot(shadow.dx, shadow.dy) * EMU_PER_PX);
  const direction = Math.round((((Math.atan2(shadow.dy, shadow.dx) * 180) / Math.PI + 360) % 360) * ANGLE_UNIT);
  const blur = Math.round(shadow.blur * EMU_PER_PX);
  return (
    `<a:effectLst><a:outerShdw blurRad="${blur}" dist="${dist}" dir="${direction}" algn="ctr" rotWithShape="1">` +
    `${colourXml(shadow.color, shadow.alpha)}</a:outerShdw></a:effectLst>`
  );
}

function pathGeometryXml(el: PathEl): string {
  const emu = (v: number): number => Math.round(v * EMU_PER_PX);
  const pt = (x: number, y: number): string => `<a:pt x="${emu(x)}" y="${emu(y)}"/>`;
  const body = el.commands
    .filter((c) => Object.hasOwn(PATH_ARITY, c[0]))
    .map((c) => {
      if (c[0] === "M") return `<a:moveTo>${pt(c[1], c[2])}</a:moveTo>`;
      if (c[0] === "L") return `<a:lnTo>${pt(c[1], c[2])}</a:lnTo>`;
      if (c[0] === "C") return `<a:cubicBezTo>${pt(c[1], c[2])}${pt(c[3], c[4])}${pt(c[5], c[6])}</a:cubicBezTo>`;
      return "<a:close/>";
    })
    .join("");
  return (
    `<a:custGeom><a:avLst/><a:gdLst/><a:ahLst/><a:cxnLst/><a:rect l="l" t="t" r="r" b="b"/>` +
    `<a:pathLst><a:path w="${emu(el.w)}" h="${emu(el.h)}">${body}</a:path></a:pathLst></a:custGeom>`
  );
}

export function firstColor(fill: PaintFill): string {
  return fill.kind === "solid" ? fill.color : (fill.stops[0] as GradientStop).color;
}

export function patchedFill(fill: Fill): PaintFill | null {
  return fill.kind === "gradient" || (fill.kind === "solid" && isTranslucent(fill.alpha)) ? fill : null;
}

function lineStyleOf(stroke: Stroke): Effects {
  const out: Effects = {};
  if (stroke.linecap) out.linecap = stroke.linecap;
  if (stroke.linejoin) out.linejoin = stroke.linejoin;
  return out;
}

export function shapeEffects(el: ShapeEl | PathEl, fill: Fill, withShadow: boolean): Effects | null {
  const out: Effects = {};
  if (el.type === "path") out.geometry = pathGeometryXml(el);
  const patched = patchedFill(fill);
  if (patched) out.fill = patched;
  if (el.stroke && isTranslucent(el.stroke.alpha)) out.lineAlpha = el.stroke.alpha;
  if (el.stroke) Object.assign(out, lineStyleOf(el.stroke));
  if (withShadow && el.shadow) out.shadow = el.shadow;
  return Object.keys(out).length > 0 ? out : null;
}

export function lineEffects(stroke: Stroke): Effects | null {
  const out: Effects = { ...lineStyleOf(stroke) };
  if (isTranslucent(stroke.alpha)) out.lineAlpha = stroke.alpha;
  return Object.keys(out).length > 0 ? out : null;
}

function patchBlock(block: string, effects: Effects): string {
  let out = block;
  if (effects.fill) out = out.replace(SHAPE_FILL, (_w, geometry: string) => `${geometry}${fillXml(effects.fill as PaintFill)}`);
  if (effects.geometry) {
    const geometry = effects.geometry;
    out = out.replace(GEOMETRY, () => geometry);
  }
  const join = effects.linejoin ? JOIN_XML[effects.linejoin] : effects.geometry ? JOIN_XML.round : "";
  if (join || effects.linecap) {
    const cap = effects.linecap ? ` cap="${CAP_ATTR[effects.linecap]}"` : "";
    out = out.replace(OUTLINE, (_w, open: string, body: string) => `${open.replace(/>$/, `${cap}>`)}${body}${join}</a:ln>`);
  }
  if (effects.lineAlpha !== undefined) {
    out = out.replace(LINE_FILL, (_w, open: string, val: string) => `${open}<a:solidFill>${colourXml(`#${val}`, effects.lineAlpha)}</a:solidFill>`);
  }
  if (effects.shadow) {
    out = out.replace(EXISTING_EFFECTS, "").replace("</p:spPr>", () => `${shadowXml(effects.shadow as Shadow)}</p:spPr>`);
  }
  if (effects.textShadow) {
    const shadow = shadowXml(effects.textShadow);
    out = out.replace(RUN_PROPS, (_w, open: string, body: string, close: string) => {
      const at = body.indexOf("<a:latin");
      return `${open}${at < 0 ? `${body}${shadow}` : `${body.slice(0, at)}${shadow}${body.slice(at)}`}${close}`;
    });
  }
  return out;
}

export function applyEffects(xml: string, slide: SlideEffects | undefined, counter: { effects: number }): string {
  if (!slide) return xml;
  let out = xml;
  if (slide.background) {
    const background = slide.background;
    out = out.replace(BACKGROUND, () => {
      counter.effects += 1;
      return `<p:bg><p:bgPr>${fillXml(background)}<a:effectLst/></p:bgPr></p:bg>`;
    });
  }
  if (slide.named.size === 0) return out;
  return out.replace(SHAPE_BLOCK, (block) => {
    const entry = slide.named.get(unescapeXml(BLOCK_NAME.exec(block)?.[1] ?? ""));
    if (!entry) return block;
    counter.effects += 1;
    return patchBlock(block, entry);
  });
}
