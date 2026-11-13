import { ICON_IDS, ICON_NONE, iconId, iconKeywords } from "../catalog/icon-catalog.ts";
import type { Brief, BriefSlide } from "../brief/brief.ts";

const CONTEXT_WEIGHT = 0.5;
const SOFT_FACTOR = 0.5;
const BODY_FACTOR = 0.5;
const FRAMING = new Set<string>(["title", "closing", "section"]);
const MIN_SCORE = 1;
const WEAK_TEXT = "support reading label first test common now made new take handle break end release right list ask not evening cross essai sign step next overview see text calme welcome line full average running real local layout size fast calm write share soutien releve premier commun nouveau maintenant choose block look resultats ligne sur";
const SOFT_TEXT = "work room place people light talk report account point group travail salle lieu gens table marche rule month mois semaine book service";

export interface IconContext {
  words: ReadonlySet<string>;
}

function stem(w: string): string {
  return w.length > 3 && /[^sui]s$/.test(w) ? w.slice(0, -1) : w.length > 4 && w.endsWith("x") ? w.slice(0, -1) : w;
}

function forms(w: string): string[] {
  const base = stem(w);
  if (w.length > 4 && w.endsWith("ies")) return [base, `${w.slice(0, -3)}y`];
  if (w.length > 4 && w.endsWith("es")) return [base, w.slice(0, -2)];
  return [base];
}

function words(text: string): string[] {
  const plain = text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  return (plain.match(/[a-z0-9]+/g) ?? []).filter((w) => w.length >= 3);
}

function stems(text: string): string[] {
  return words(text).map(stem);
}

function textForms(text: string): Set<string> {
  return new Set(words(text).flatMap(forms));
}

const WEAK = new Set(stems(WEAK_TEXT));
const SOFT = new Set(stems(SOFT_TEXT));
const TREND = new Set(stems("growth grow grew rise rose increase increased croissance hausse progression augmentation"));

function weightOf(word: string): number {
  return WEAK.has(word) ? 0 : SOFT.has(word) ? SOFT_FACTOR : 1;
}

function indexOf(id: string): { w: string; weight: number; pos: number }[] {
  const found = new Map<string, number>();
  for (const lang of ["en", "fr"] as const) {
    iconKeywords(id, lang).forEach((kw, pos) => {
      for (const w of stems(kw)) found.set(w, Math.min(found.get(w) ?? pos, pos));
    });
  }
  return [...found].map(([w, pos]) => ({ w, weight: weightOf(w), pos }));
}

const INDEX = ICON_IDS.map((id) => ({ id, words: indexOf(id) }));

export function iconContext(brief: Brief): IconContext {
  const text = [brief.title, brief.subtitle, brief.purpose, brief.audience, ...(brief.mood ?? [])].filter((t): t is string => t !== undefined).join(" ");
  return { words: textForms(text) };
}

interface SlideWords {
  head: Set<string>;
  rest: Set<string>;
}

function slideWords(s: BriefSlide): SlideWords {
  const heads = [s.headline, s.number?.label, s.chart?.caption, s.table?.caption];
  if (s.image !== undefined) heads.push("draw" in s.image ? s.image.draw : s.image.caption);
  const rest = [s.body, ...(s.points ?? []), s.quote?.text];
  const join = (parts: (string | undefined)[]) => parts.filter((p): p is string => p !== undefined).join(" ");
  return { head: textForms(join(heads)), rest: textForms(join(rest)) };
}

function layoutIcon(s: BriefSlide): string | null {
  const text = (...parts: (string | undefined)[]) => textForms(parts.filter((p): p is string => p !== undefined).join(" "));
  const has = (found: Set<string>, list: Set<string>) => [...found].some((w) => list.has(w));
  if (s.intent === "quote" && s.quote !== undefined) return "quotes";
  if (s.intent === "table" && s.table !== undefined) return "table";
  if (s.intent === "chart" && s.chart !== undefined) return s.chart.kind === "pie" || s.chart.kind === "donut" ? "chart-pie" : "chart-bar";
  if (s.intent === "number" && s.number !== undefined && (s.number.value.trim().startsWith("+") || has(text(s.headline, s.number.label), TREND))) return "trend-up";
  return null;
}

export function pickIcon(s: BriefSlide, context: IconContext, used: readonly string[]): string | null {
  if (s.icon === ICON_NONE) return null;
  if (s.icon !== undefined) return iconId(s.icon);
  const own = slideWords(s);
  const framing = FRAMING.has(s.intent);
  const ranked = INDEX.map((icon) => {
    let score = 0;
    let depth = 0;
    let ownScore = 0;
    for (const { w, weight, pos } of icon.words) {
      const place = own.head.has(w) ? 1 : own.rest.has(w) ? BODY_FACTOR : 0;
      ownScore += weight * place;
      const hit = weight * (place > 0 ? place : context.words.has(w) ? CONTEXT_WEIGHT : 0);
      if (hit > 0) depth += pos;
      score += hit;
    }
    return { id: icon.id, score, depth, ownScore };
  })
    .filter((r) => (framing || r.ownScore >= MIN_SCORE) && r.score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score || a.depth - b.depth);
  const fresh = ranked.find((r) => !used.includes(r.id));
  const found = (fresh ?? ranked[0])?.id ?? null;
  if (found !== null) return found;
  const layout = layoutIcon(s);
  return layout !== null && !used.includes(layout) ? layout : null;
}
