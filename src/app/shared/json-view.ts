import type { Deck } from "../../model/deck.ts";

export interface JsonParts {
  before: string;
  current: string;
  after: string;
}

export function deckJson(deck: Deck): string {
  return JSON.stringify(deck, null, 2);
}

export function splitJsonAt(deck: Deck, slideIndex: number): JsonParts {
  const full = deckJson(deck);
  const slide = deck.slides[slideIndex];
  if (!slide) return { before: full, current: "", after: "" };
  const needle = JSON.stringify(slide, null, 2).split("\n").join("\n    ");
  const start = full.indexOf(`    ${needle}`);
  if (start < 0) return { before: full, current: "", after: "" };
  const from = start + 4;
  const to = from + needle.length;
  return { before: full.slice(0, from), current: full.slice(from, to), after: full.slice(to) };
}
