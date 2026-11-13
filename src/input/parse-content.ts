import type { ContentBlock } from "./types.ts";

const HEADING = /^(#{1,3})\s+(\S.*)$/;
const BULLET = /^[-*]\s+(\S.*)$/;
const QUOTE = /^>\s?(.*)$/;
const IMAGE = /^!\[([^\]]*)\]\s*(.*)$/;
const QUOTE_BY = /^(.*)(?:^|\s)(?:--|\u2014)\s*(\S.*)$/;

function g(m: RegExpExecArray, i: number): string {
  return m[i] ?? "";
}

function stemOf(id: string): string {
  return id.replace(/\.[^./\\]+$/, "");
}

function createResolver(assetIds: string[]): (name: string) => string | null {
  const exact = new Set(assetIds);
  const byLowerId = new Map<string, string>();
  const byLowerStem = new Map<string, string>();
  for (const id of assetIds) {
    const lower = id.toLowerCase();
    if (!byLowerId.has(lower)) byLowerId.set(lower, id);
    const stem = stemOf(lower);
    if (!byLowerStem.has(stem)) byLowerStem.set(stem, id);
  }
  return (name) => {
    if (exact.has(name)) return name;
    const lower = name.toLowerCase();
    return byLowerId.get(lower) ?? byLowerStem.get(lower) ?? null;
  };
}

function splitNumber(line: string): { value: string; label: string } | null {
  if (!line.startsWith("=")) return null;
  const pipe = line.indexOf("|");
  if (pipe < 0) return null;
  const value = line.slice(1, pipe).trim();
  const label = line.slice(pipe + 1).trim();
  return value !== "" && label !== "" ? { value, label } : null;
}

function splitQuote(text: string): { text: string; by: string | null } {
  const match = QUOTE_BY.exec(text);
  if (match && g(match, 1).trim() !== "") return { text: g(match, 1).trim(), by: g(match, 2).trim() };
  return { text, by: null };
}

export function parseContent(text: string, assetIds: string[]): ContentBlock[] {
  const resolve = createResolver(assetIds);
  const blocks: ContentBlock[] = [];
  let paragraph: string[] = [];
  let bullets: string[] = [];
  let quote: string[] = [];

  const flush = () => {
    if (paragraph.length > 0) {
      blocks.push({ kind: "paragraph", text: paragraph.join(" ") });
      paragraph = [];
    }
    if (bullets.length > 0) {
      blocks.push({ kind: "bullets", items: bullets });
      bullets = [];
    }
    if (quote.length > 0) {
      const { text: quoteText, by } = splitQuote(quote.join(" "));
      blocks.push({ kind: "quote", text: quoteText, by });
      quote = [];
    }
  };

  for (const raw of text.split(/\r\n|\r|\n/)) {
    const line = raw.replace(/\t/g, " ").trim();
    if (line === "") {
      flush();
      continue;
    }
    const quoteMatch = QUOTE.exec(line);
    if (quoteMatch) {
      if (bullets.length > 0 || paragraph.length > 0) flush();
      if (g(quoteMatch, 1).trim() !== "") quote.push(g(quoteMatch, 1).trim());
      continue;
    }
    const bulletMatch = BULLET.exec(line);
    if (bulletMatch) {
      if (quote.length > 0 || paragraph.length > 0) flush();
      bullets.push(g(bulletMatch, 1));
      continue;
    }
    const headingMatch = HEADING.exec(line);
    if (headingMatch) {
      flush();
      blocks.push({ kind: "heading", text: g(headingMatch, 2), level: g(headingMatch, 1).length as 1 | 2 | 3 });
      continue;
    }
    const imageMatch = IMAGE.exec(line);
    if (imageMatch) {
      flush();
      const assetId = resolve(g(imageMatch, 1).trim());
      if (assetId !== null) {
        blocks.push({ kind: "image", assetId, caption: g(imageMatch, 2) === "" ? null : g(imageMatch, 2) });
      } else {
        blocks.push({ kind: "paragraph", text: line });
      }
      continue;
    }
    const number = splitNumber(line);
    if (number) {
      flush();
      blocks.push({ kind: "number", value: number.value, label: number.label });
      continue;
    }
    if (bullets.length > 0 || quote.length > 0) flush();
    paragraph.push(line);
  }
  flush();
  return blocks;
}
