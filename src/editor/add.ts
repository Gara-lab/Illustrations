import type { Deck, Element, ImageEl, ShapeEl, Slide, TextEl } from "../model/deck.ts";
import { freeId } from "./slides.ts";

export interface Added {
  deck: Deck;
  id: string;
}

export interface ImageSize {
  w: number;
  h: number;
}

export const DEFAULT_TEXT = "New text";
const FALLBACK_FONT = "Helvetica Neue";
const FALLBACK_TEXT_COLOR = "#1b1b1b";
export const FALLBACK_ACCENT = "#2563eb";
const IMAGE_MAX_WIDTH_SHARE = 0.5;
const IMAGE_MAX_HEIGHT_SHARE = 0.6;
const IMAGE_ID_PATTERN = /^[A-Za-z0-9_.:-]+$/;

function allTexts(deck: Deck): TextEl[] {
  return deck.slides.flatMap((s) => s.elements.filter((e): e is TextEl => e.type === "text"));
}

export function bodyStyle(deck: Deck): { fontFamily: string; color: string; lineHeight: number } {
  const texts = allTexts(deck);
  const body = texts.find((t) => t.role !== "heading" && t.role !== "title") ?? texts[0];
  return { fontFamily: body?.fontFamily ?? FALLBACK_FONT, color: body?.color ?? FALLBACK_TEXT_COLOR, lineHeight: body?.lineHeight ?? 1.2 };
}

export function accentColor(deck: Deck): string {
  for (const slide of deck.slides) {
    for (const e of slide.elements) {
      if (e.type === "shape" && e.fill.kind === "solid") return e.fill.color;
    }
  }
  return FALLBACK_ACCENT;
}

function centred(deck: Deck, w: number, h: number): { x: number; y: number } {
  return { x: Math.max(0, Math.round((deck.size.w - w) / 2)), y: Math.max(0, Math.round((deck.size.h - h) / 2)) };
}

function place(deck: Deck, slideIndex: number, kind: string, build: (id: string) => Element): Added | null {
  const slide = deck.slides[slideIndex];
  if (!slide) return null;
  const taken = new Set(deck.slides.flatMap((s) => s.elements.map((e) => e.id)));
  const id = freeId(`${slide.id}-${kind}`, taken);
  const element = build(id);
  const slides = deck.slides.map((s, i) => (i !== slideIndex ? s : ({ ...s, elements: [...s.elements, element] } as Slide)));
  return { deck: { ...deck, slides }, id };
}

export function addTextElement(deck: Deck, slideIndex: number): Added | null {
  const style = bodyStyle(deck);
  const fontSize = Math.round(Math.min(deck.size.w, deck.size.h) * 0.045);
  const w = Math.round(deck.size.w * 0.5);
  const h = Math.round(fontSize * style.lineHeight * 2);
  return place(deck, slideIndex, "text", (id) => {
    const element: TextEl = {
      id,
      type: "text",
      ...centred(deck, w, h),
      w,
      h,
      rotation: 0,
      animation: null,
      role: null,
      paragraphs: [{ runs: [{ text: DEFAULT_TEXT }], bullet: false, level: 0 }],
      fontFamily: style.fontFamily,
      fontSize,
      color: style.color,
      align: "left",
      valign: "top",
      lineHeight: style.lineHeight
    };
    return element;
  });
}

export function addShapeElement(deck: Deck, slideIndex: number, shape: ShapeEl["shape"]): Added | null {
  if (shape !== "rect" && shape !== "ellipse") return null;
  const side = Math.round(Math.min(deck.size.w, deck.size.h) * 0.3);
  return place(deck, slideIndex, shape === "rect" ? "rect" : "ellipse", (id) => {
    const element: ShapeEl = {
      id,
      type: "shape",
      ...centred(deck, side, side),
      w: side,
      h: side,
      rotation: 0,
      animation: null,
      role: null,
      shape,
      fill: { kind: "solid", color: accentColor(deck) },
      stroke: null,
      radius: 0
    };
    return element;
  });
}

export function imageBox(deck: Deck, image: ImageSize): { x: number; y: number; w: number; h: number } | null {
  if (![image.w, image.h].every((n) => Number.isFinite(n) && n > 0)) return null;
  const scale = Math.min((deck.size.w * IMAGE_MAX_WIDTH_SHARE) / image.w, (deck.size.h * IMAGE_MAX_HEIGHT_SHARE) / image.h);
  const w = Math.max(1, Math.round(image.w * scale));
  const h = Math.max(1, Math.round(image.h * scale));
  return { ...centred(deck, w, h), w, h };
}

export function addImageElement(deck: Deck, slideIndex: number, assetId: string, image: ImageSize): Added | null {
  if (typeof assetId !== "string" || !IMAGE_ID_PATTERN.test(assetId)) return null;
  const box = imageBox(deck, image);
  if (!box) return null;
  return place(deck, slideIndex, "image", (id) => {
    const element: ImageEl = { id, type: "image", ...box, rotation: 0, animation: null, role: null, assetId, fit: "contain" };
    return element;
  });
}

export function deleteElement(deck: Deck, slideIndex: number, elementId: string): Deck {
  const slide = deck.slides[slideIndex];
  if (!slide || !slide.elements.some((e) => e.id === elementId)) return deck;
  const slides = deck.slides.map((s, i) => (i !== slideIndex ? s : { ...s, elements: s.elements.filter((e) => e.id !== elementId) }));
  return { ...deck, slides };
}
