import type { Deck } from "../model/deck.ts";

export const HISTORY_CAP = 100;

export interface History {
  past: Deck[];
  present: Deck;
  future: Deck[];
  saved: Deck;
}

export function createHistory(deck: Deck): History {
  return { past: [], present: deck, future: [], saved: deck };
}

export function pushHistory(history: History, deck: Deck): History {
  if (deck === history.present) return history;
  return { ...history, past: [...history.past, history.present].slice(-HISTORY_CAP), present: deck, future: [] };
}

export function undoHistory(history: History): History {
  const previous = history.past[history.past.length - 1];
  if (!previous) return history;
  return { ...history, past: history.past.slice(0, -1), present: previous, future: [history.present, ...history.future] };
}

export function redoHistory(history: History): History {
  const next = history.future[0];
  if (!next) return history;
  return { ...history, past: [...history.past, history.present], present: next, future: history.future.slice(1) };
}

export function canUndo(history: History): boolean {
  return history.past.length > 0;
}

export function canRedo(history: History): boolean {
  return history.future.length > 0;
}

export function markSaved(history: History, deck: Deck = history.present): History {
  return { ...history, saved: deck };
}

export function rebase(latest: History, base: History, next: History): History | null {
  return latest.present === base.present ? { ...next, saved: latest.saved } : null;
}

export function isDirty(history: History): boolean {
  return history.present !== history.saved;
}
