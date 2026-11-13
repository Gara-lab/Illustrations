import { fontMetric } from "../catalog/fonts.ts";

const MARGIN = 1.015;

export const c8 = (n: number): number => Math.ceil(n / 8 - 1e-9) * 8;

function advances(text: string, font: string, bold: boolean): number[] {
  const m = fontMetric(font, bold);
  return Array.from(text, (ch) => (ch === " " ? m.space : (m.advances[ch] ?? m.fallback)));
}

function textWidth(text: string, font: string, size: number, bold: boolean): number {
  let sum = 0;
  for (const a of advances(text, font, bold)) sum += a;
  return sum * size * MARGIN;
}

function widestWord(text: string, font: string, size: number, bold: boolean): number {
  let widest = 0;
  for (const word of text.split(" ")) widest = Math.max(widest, textWidth(word, font, size, bold));
  return widest;
}

function breakWord(word: string, font: string, size: number, bold: boolean, width: number): string[] {
  const adv = advances(word, font, bold);
  const chars = Array.from(word);
  const pieces: string[] = [];
  let cur = "";
  let w = 0;
  chars.forEach((ch, i) => {
    const a = (adv[i] as number) * size * MARGIN;
    if (cur !== "" && w + a > width) {
      pieces.push(cur);
      cur = "";
      w = 0;
    }
    cur += ch;
    w += a;
  });
  pieces.push(cur);
  return pieces;
}

export function wrap(text: string, font: string, size: number, bold: boolean, width: number): string[] {
  const lines: string[] = [];
  let cur = "";
  for (const word of text.split(" ").filter((w) => w !== "")) {
    let w = word;
    if (textWidth(w, font, size, bold) > width) {
      const pieces = breakWord(w, font, size, bold, width);
      if (cur !== "") lines.push(cur);
      cur = "";
      lines.push(...pieces.slice(0, -1));
      w = pieces[pieces.length - 1] as string;
    }
    const cand = cur === "" ? w : `${cur} ${w}`;
    if (cur === "" || textWidth(cand, font, size, bold) <= width) cur = cand;
    else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur !== "") lines.push(cur);
  return lines.length > 0 ? lines : [""];
}

export interface FitInput {
  text: string;
  font: string;
  bold: boolean;
  width: number;
  maxH: number;
  sizes: number[];
  lh: number;
}

export interface Fitted {
  size: number;
  lines: string[];
  text: string;
  h: number;
  clipped: boolean;
  broken: boolean;
  forced?: boolean;
}

export function fitText(o: FitInput): Fitted {
  const text = o.text.replace(/\s+/g, " ").trim();
  const smallest = o.sizes[o.sizes.length - 1] as number;
  for (const size of o.sizes) {
    if (size !== smallest && widestWord(text, o.font, size, o.bold) > o.width) continue;
    const lines = wrap(text, o.font, size, o.bold, o.width);
    const h = c8(lines.length * size * o.lh);
    if (h <= o.maxH) return { size, lines, text, h, clipped: false, broken: widestWord(text, o.font, size, o.bold) > o.width };
  }
  const size = smallest;
  const lineH = size * o.lh;
  let k = Math.max(1, Math.floor(o.maxH / lineH));
  while (k > 1 && c8(k * lineH) > o.maxH) k--;
  const words = text.split(" ");
  let n = words.length;
  while (n > 1 && wrap(`${words.slice(0, n).join(" ")}…`, o.font, size, o.bold, o.width).length > k) n--;
  let cand = `${words.slice(0, n).join(" ")}…`;
  while (cand.length > 1 && wrap(cand, o.font, size, o.bold, o.width).length > k) cand = `${cand.slice(0, -2)}…`;
  const lines = wrap(cand, o.font, size, o.bold, o.width);
  return { size, lines, text: cand, h: c8(lines.length * lineH), clipped: true, broken: widestWord(cand, o.font, size, o.bold) > o.width };
}

function balanced(words: string[], maxWords: number): string[] {
  const count = Math.ceil(words.length / maxWords);
  const base = Math.floor(words.length / count);
  const extra = words.length % count;
  const lines: string[] = [];
  let at = 0;
  for (let i = 0; i < count; i++) {
    const n = base + (i < extra ? 1 : 0);
    lines.push(words.slice(at, at + n).join(" "));
    at += n;
  }
  return lines;
}

export function fitWordLines(o: FitInput & { maxWords: number }): Fitted {
  const text = o.text.replace(/\s+/g, " ").trim();
  const words = text.split(" ");
  for (let per = o.maxWords; per >= 1; per--) {
    const lines = balanced(words, per);
    for (const size of o.sizes) {
      const widest = Math.max(...lines.map((line) => textWidth(line, o.font, size, o.bold)));
      const h = c8(lines.length * size * o.lh);
      if (widest <= o.width && h <= o.maxH) return { size, lines, text, h, clipped: false, broken: false, forced: true };
    }
  }
  return fitText(o);
}
