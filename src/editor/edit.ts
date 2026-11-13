import type { Deck, Element, Slide } from "../model/deck.ts";

export type Handle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Size {
  w: number;
  h: number;
}

export const MIN_SIZE = 8;
const HIT_MIN = 12;
export const HANDLES: Handle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

function clamp(value: number, low: number, high: number): number {
  return Math.min(Math.max(value, low), Math.max(low, high));
}

export function elementBox(element: Box): Box {
  return { x: element.x, y: element.y, w: element.w, h: element.h };
}

export function minSizeFor(box: Size): Size {
  return { w: Math.min(MIN_SIZE, box.w), h: Math.min(MIN_SIZE, box.h) };
}

export function sameBox(a: Box, b: Box): boolean {
  return a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;
}

export function clampBox(box: Box, size: Size, min: Size = { w: MIN_SIZE, h: MIN_SIZE }): Box {
  const w = clamp(box.w, min.w, size.w);
  const h = clamp(box.h, min.h, size.h);
  return { x: clamp(box.x, 0, size.w - w), y: clamp(box.y, 0, size.h - h), w, h };
}

export function moveBox(box: Box, dx: number, dy: number, size: Size): Box {
  return { x: clamp(box.x + dx, 0, size.w - box.w), y: clamp(box.y + dy, 0, size.h - box.h), w: box.w, h: box.h };
}

export function resizeBox(box: Box, handle: Handle, dx: number, dy: number, size: Size, min: Size = minSizeFor(box)): Box {
  let left = box.x;
  let right = box.x + box.w;
  let top = box.y;
  let bottom = box.y + box.h;
  if (handle.includes("w")) left = clamp(left + dx, 0, right - min.w);
  if (handle.includes("e")) right = clamp(right + dx, left + min.w, size.w);
  if (handle.includes("n")) top = clamp(top + dy, 0, bottom - min.h);
  if (handle.includes("s")) bottom = clamp(bottom + dy, top + min.h, size.h);
  return { x: left, y: top, w: right - left, h: bottom - top };
}

export function setElementBox(deck: Deck, slideIndex: number, elementId: string, box: Box): Deck {
  const slide = deck.slides[slideIndex];
  const current = slide?.elements.find((e) => e.id === elementId);
  if (!slide || !current) return deck;
  if (![box.x, box.y, box.w, box.h].every(Number.isFinite)) return deck;
  const sameSize = box.w === current.w && box.h === current.h;
  const next = sameSize ? moveBox(box, 0, 0, deck.size) : clampBox(box, deck.size, minSizeFor(current));
  if (sameBox(next, elementBox(current))) return deck;
  const slides = deck.slides.map((s, i) =>
    i !== slideIndex ? s : { ...s, elements: s.elements.map((e) => (e.id === elementId ? { ...e, ...next } : e)) }
  );
  return { ...deck, slides };
}

export function moveElementBy(deck: Deck, slideIndex: number, elementId: string, dx: number, dy: number): Deck {
  const current = deck.slides[slideIndex]?.elements.find((e) => e.id === elementId);
  if (!current) return deck;
  return setElementBox(deck, slideIndex, elementId, { ...elementBox(current), x: current.x + dx, y: current.y + dy });
}

export function hitTest(slide: Slide, x: number, y: number): Element | null {
  for (let i = slide.elements.length - 1; i >= 0; i--) {
    const e = slide.elements[i] as Element;
    const padX = Math.max(0, HIT_MIN - e.w) / 2;
    const padY = Math.max(0, HIT_MIN - e.h) / 2;
    if (x >= e.x - padX && x <= e.x + e.w + padX && y >= e.y - padY && y <= e.y + e.h + padY) return e;
  }
  return null;
}

export function changedTarget(before: Deck, after: Deck): { slideIndex: number; elementId: string } | null {
  for (let i = 0; i < after.slides.length; i++) {
    const a = before.slides[i] as Slide | undefined;
    const b = after.slides[i] as Slide;
    if (a === b) continue;
    const changed = b.elements.find((e, j) => a?.elements[j] !== e);
    if (changed) return { slideIndex: i, elementId: changed.id };
  }
  return null;
}
