import type { Deck, Slide } from "../model/deck.ts";

function validIndex(deck: Deck, index: number): boolean {
  return Number.isInteger(index) && index >= 0 && index < deck.slides.length;
}

export function freeId(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}${n}`)) n += 1;
  return `${base}${n}`;
}

export function moveSlide(deck: Deck, from: number, to: number): Deck {
  if (!validIndex(deck, from) || !validIndex(deck, to) || from === to) return deck;
  const slides = deck.slides.slice();
  const [moved] = slides.splice(from, 1);
  slides.splice(to, 0, moved as Slide);
  return { ...deck, slides };
}

export function duplicateSlide(deck: Deck, index: number): Deck {
  if (!validIndex(deck, index)) return deck;
  const source = deck.slides[index] as Slide;
  const slideIds = new Set(deck.slides.map((s) => s.id));
  const elementIds = new Set(deck.slides.flatMap((s) => s.elements.map((e) => e.id)));
  const id = freeId(`${source.id}-copy`, slideIds);
  const prefix = `${source.id}-`;
  const copy = structuredClone(source);
  copy.id = id;
  copy.elements = copy.elements.map((e) => {
    const suffix = e.id.startsWith(prefix) ? e.id.slice(prefix.length) : e.id;
    const next = freeId(`${id}-${suffix}`, elementIds);
    elementIds.add(next);
    return { ...e, id: next };
  });
  const slides = deck.slides.slice();
  slides.splice(index + 1, 0, copy);
  return { ...deck, slides };
}

export function deleteSlide(deck: Deck, index: number): Deck {
  if (!validIndex(deck, index) || deck.slides.length <= 1) return deck;
  return { ...deck, slides: deck.slides.filter((_, i) => i !== index) };
}

export function changedSlideIndex(before: Deck, after: Deck): number | null {
  if (after.slides.length === 0) return null;
  const length = Math.max(before.slides.length, after.slides.length);
  for (let i = 0; i < length; i++) {
    if (before.slides[i]?.id !== after.slides[i]?.id) return Math.min(i, after.slides.length - 1);
  }
  return null;
}

export function selectionAfterDelete(deletedIndex: number, remaining: number): number {
  return Math.max(0, Math.min(deletedIndex, remaining - 1));
}
