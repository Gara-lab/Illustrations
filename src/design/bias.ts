export type PurposeKind = "persuade" | "inform" | "none";
export type AudienceKind = "simple" | "technical" | "none";

const PERSUADE = ["persuad*", "convinc*", "pitch*", "sell*", "win", "wins", "winning", "buy*", "fund", "funds", "funding", "decid*", "decision*", "approv*", "invest*", "propos*", "recommend*", "adopt*", "commit*"];
const INFORM = ["inform*", "teach*", "explain*", "train*", "educat*", "onboard*", "learn*", "overview", "summar*", "report*", "updat*", "describ*", "document*", "review*"];
const SIMPLE = ["executive*", "board", "investor*", "leadership", "ceo", "cfo", "customer*", "client*", "public", "general", "beginner*", "newcomer*", "student*", "manager*", "management", "stakeholder*", "buyer*", "nontechnical", "layperson", "laypeople"];
const TECHNICAL = ["engineer*", "developer*", "technical", "expert*", "specialist*", "researcher*", "scientist*", "analyst*", "academic*", "scholar*", "architect*", "practitioner*", "peer*"];

function tokens(text: string | undefined): string[] {
  return (text ?? "").toLowerCase().replace(/\bnon-?technical\b|\bnot technical\b/g, " nontechnical ").match(/[a-z]+/g) ?? [];
}

function hasAny(words: string[], list: string[]): boolean {
  return words.some((t) => list.some((w) => (w.endsWith("*") ? t.startsWith(w.slice(0, -1)) : t === w)));
}

export function purposeOf(text: string | undefined): PurposeKind {
  const words = tokens(text);
  if (hasAny(words, PERSUADE)) return "persuade";
  return hasAny(words, INFORM) ? "inform" : "none";
}

export function audienceOf(text: string | undefined): AudienceKind {
  const words = tokens(text);
  const simple = hasAny(words, SIMPLE);
  const technical = hasAny(words, TECHNICAL);
  if (simple === technical) return "none";
  return simple ? "simple" : "technical";
}
