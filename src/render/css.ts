import type { Fill, Shadow } from "../model/deck";

const FALLBACK_COLOR = "#000000";
const CSS_ANGLE_OFFSET = 90;

export function num(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 1000) / 1000 : fallback;
}

export function color(value: unknown): string {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value) ? value : FALLBACK_COLOR;
}

export function paint(value: unknown, alpha: unknown): string {
  const hex = color(value);
  const a = Number(alpha);
  if (alpha === undefined || !Number.isFinite(a) || a >= 1) return hex;
  const channel = (i: number): number => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  return `rgba(${channel(0)},${channel(1)},${channel(2)},${num(Math.max(0, a))})`;
}

function gradientCss(fill: Extract<Fill, { kind: "gradient" }>): string {
  const stops = Array.isArray(fill.stops) ? fill.stops : [];
  const list = stops.map((s) => `${paint(s.color, s.alpha)} ${num(num(s.at) * 100)}%`).join(",");
  return `linear-gradient(${num(num(fill.angle) + CSS_ANGLE_OFFSET)}deg,${list})`;
}

export function fillCss(fill: Fill | undefined): string {
  if (fill && fill.kind === "solid") return paint(fill.color, fill.alpha);
  if (fill && fill.kind === "gradient") return gradientCss(fill);
  return "transparent";
}

export function backgroundCss(fill: Fill, base: string): string {
  if (fill.kind === "solid" && (fill.alpha === undefined || !(Number(fill.alpha) < 1))) return `background:${color(fill.color)};`;
  if (fill.kind === "solid") return `background-color:${base};background-image:linear-gradient(${fillCss(fill)},${fillCss(fill)});`;
  if (fill.kind === "gradient") return `background-color:${base};background-image:${gradientCss(fill)};`;
  return "";
}

export function shadowCss(shadow: Shadow): string {
  return `${num(shadow.dx)}px ${num(shadow.dy)}px ${Math.max(0, num(shadow.blur))}px ${paint(shadow.color, shadow.alpha)}`;
}
