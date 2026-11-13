import { PATH_ARITY } from "../model/deck.ts";
import type { LineEl, PathEl, PathFill } from "../model/deck";
import { color, num, shadowCss } from "./css.ts";

const FULL_OPACITY = 1;

function opacityAttr(name: string, alpha: unknown): string {
  const a = Number(alpha);
  return alpha !== undefined && Number.isFinite(a) && a < FULL_OPACITY ? ` ${name}="${num(Math.max(0, a))}"` : "";
}

function linejoinAttr(stroke: LineEl["stroke"]): string {
  return stroke.linejoin ? ` stroke-linejoin="${stroke.linejoin}"` : "";
}

export function lineHtml(el: LineEl): string {
  const w = num(el.w);
  const h = num(el.h);
  const width = num(el.stroke.width, 1);
  return (
    `<div class="in ln"><svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
    `<line x1="0" y1="0" x2="${w}" y2="${h}" stroke="${color(el.stroke.color)}"${opacityAttr("stroke-opacity", el.stroke.alpha)} stroke-width="${width}" stroke-linecap="${el.stroke.linecap ?? "butt"}"${linejoinAttr(el.stroke)}/></svg></div>`
  );
}

function pathData(commands: unknown): string {
  if (!Array.isArray(commands)) return "";
  return commands
    .map((c: unknown) => {
      const op = Array.isArray(c) && typeof c[0] === "string" && Object.hasOwn(PATH_ARITY, c[0]) ? c[0] : null;
      if (op === null) return "";
      const arity = PATH_ARITY[op] as number;
      return [op, ...(c as unknown[]).slice(1, 1 + arity).map((v) => num(v))].join(" ");
    })
    .filter((part) => part !== "")
    .join(" ");
}

function gradientDef(id: string, fill: Extract<PathFill, { kind: "gradient" }>, w: number, h: number): string {
  const angle = (num(fill.angle) * Math.PI) / 180;
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const half = (Math.abs(w * dx) + Math.abs(h * dy)) / 2;
  const stops = (Array.isArray(fill.stops) ? fill.stops : [])
    .map((s) => `<stop offset="${num(num(s.at) * 100)}%" stop-color="${color(s.color)}"${opacityAttr("stop-opacity", s.alpha)}/>`)
    .join("");
  return (
    `<defs><linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${num(w / 2 - dx * half)}" y1="${num(h / 2 - dy * half)}" ` +
    `x2="${num(w / 2 + dx * half)}" y2="${num(h / 2 + dy * half)}">${stops}</linearGradient></defs>`
  );
}

export function pathHtml(el: PathEl): string {
  const w = num(el.w);
  const h = num(el.h);
  const id = `pg-${String(el.id).replace(/[^A-Za-z0-9_]/g, (c) => `-${c.charCodeAt(0).toString(16)}`)}`;
  const fill = el.fill ?? { kind: "none" };
  let defs = "";
  let paint = `fill="none"`;
  if (fill.kind === "solid") paint = `fill="${color(fill.color)}"${opacityAttr("fill-opacity", fill.alpha)}`;
  else if (fill.kind === "gradient") {
    defs = gradientDef(id, fill, w, h);
    paint = `fill="url(#${id})"`;
  }
  const stroke = el.stroke
    ? ` stroke="${color(el.stroke.color)}"${opacityAttr("stroke-opacity", el.stroke.alpha)} stroke-width="${Math.max(0, num(el.stroke.width))}"${el.stroke.linecap ? ` stroke-linecap="${el.stroke.linecap}"` : ""} stroke-linejoin="${el.stroke.linejoin ?? "round"}"`
    : "";
  const shadow = el.shadow ? ` style="filter:drop-shadow(${shadowCss(el.shadow)})"` : "";
  return (
    `<div class="in pa"${shadow}><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">` +
    `${defs}<path d="${pathData(el.commands)}" ${paint}${stroke}/></svg></div>`
  );
}
