import type { Deck, Paragraph, TextEl } from "../model/deck.ts";

export const MAX_TEXT_LENGTH = 5000;
const AVG_CHAR_WIDTH = 0.55;

function paragraphText(p: Paragraph): string {
  return p.runs.map((r) => r.text).join("");
}

export function elementText(element: TextEl): string {
  return element.paragraphs.map(paragraphText).join("\n");
}

function rebuild(old: Paragraph | undefined, fallback: Paragraph, line: string): Paragraph {
  const source = old ?? fallback;
  if (old && paragraphText(old) === line) return old;
  const style = source.runs[0];
  const run = style ? { ...style, text: line } : { text: line };
  return { runs: [run], bullet: source.bullet, level: source.level };
}

export function setElementText(deck: Deck, slideIndex: number, elementId: string, text: string): Deck {
  const slide = deck.slides[slideIndex];
  const current = slide?.elements.find((e) => e.id === elementId);
  if (!slide || !current || current.type !== "text") return deck;
  if (typeof text !== "string" || text.length > MAX_TEXT_LENGTH) return deck;
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  if (lines.join("\n") === elementText(current)) return deck;
  const last = current.paragraphs[current.paragraphs.length - 1] ?? { runs: [], bullet: false, level: 0 };
  const paragraphs = lines.map((line, i) => rebuild(current.paragraphs[i], last, line));
  const next: TextEl = { ...current, paragraphs };
  const slides = deck.slides.map((s, i) =>
    i !== slideIndex ? s : { ...s, elements: s.elements.map((e) => (e.id === elementId ? next : e)) }
  );
  return { ...deck, slides };
}

export function estimateTextHeight(text: string, element: Pick<TextEl, "w" | "fontSize" | "lineHeight">): number {
  const perLine = Math.max(1, Math.floor(element.w / (element.fontSize * AVG_CHAR_WIDTH)));
  const lines = text.split("\n").reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / perLine)), 0);
  return lines * element.fontSize * element.lineHeight;
}

export function textOverflows(text: string, element: Pick<TextEl, "w" | "h" | "fontSize" | "lineHeight">): boolean {
  return estimateTextHeight(text, element) > element.h;
}
