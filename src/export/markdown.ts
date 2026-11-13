import type { Deck, ImageEl, Paragraph, Run, Slide, TextEl } from "../model/deck";

export interface MarkdownAssets { get(assetId: string): { mime: string; data: Uint8Array } | null }

const SPECIAL = /[\\*_#[\]`<>|]/g;
const LINE_START = /^([-+])/;

function escapeText(text: string): string {
  return text.replace(/\r?\n/g, " ").replace(SPECIAL, (c) => `\\${c}`).replace(LINE_START, "\\$1");
}

function runMarkdown(run: Run): string {
  const text = escapeText(run.text);
  if (text.trim() === "") return text;
  const marker = run.bold && run.italic ? "***" : run.bold ? "**" : run.italic ? "*" : "";
  if (marker === "") return text;
  const lead = text.length - text.trimStart().length;
  const trail = text.length - text.trimEnd().length;
  return `${text.slice(0, lead)}${marker}${text.slice(lead, text.length - trail)}${marker}${text.slice(text.length - trail)}`;
}

function paragraphMarkdown(paragraph: Paragraph): string {
  return paragraph.runs.map(runMarkdown).join("").trim();
}

function plainText(el: TextEl): string {
  return el.paragraphs
    .map((p) => escapeText(p.runs.map((r) => r.text).join("")).trim())
    .filter((t) => t !== "")
    .join(" ");
}

function readingOrder<T extends { x: number; y: number }>(items: T[]): T[] {
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => a.item.y - b.item.y || a.item.x - b.item.x || a.index - b.index)
    .map((entry) => entry.item);
}

function textBlocks(el: TextEl): string[] {
  const blocks: string[] = [];
  let list: string[] = [];
  const flush = (): void => {
    if (list.length > 0) blocks.push(list.join("\n"));
    list = [];
  };
  for (const paragraph of el.paragraphs) {
    const body = paragraphMarkdown(paragraph);
    if (body === "") continue;
    if (paragraph.bullet) {
      list.push(`${"  ".repeat(paragraph.level)}- ${body}`);
    } else {
      flush();
      blocks.push(body);
    }
  }
  flush();
  return blocks;
}

function notesBlock(notes: string): string {
  const lines = notes
    .split(/\r?\n/)
    .map((line) => escapeText(line).trim())
    .map((line) => (line === "" ? ">" : `> ${line}`));
  return ["> **Notes**", ">", ...lines].join("\n");
}

function slideMarkdown(slide: Slide, index: number): string {
  const ordered = readingOrder(slide.elements);
  const texts = ordered.filter((el): el is TextEl => el.type === "text");
  const heading = texts.find((el) => el.role === "title") ?? texts[0];
  const headingText = heading ? plainText(heading) : "";
  const blocks = [`## ${headingText === "" ? `Slide ${index + 1}` : headingText}`];
  for (const el of ordered) {
    if (el === heading) continue;
    if (el.type === "text") blocks.push(...textBlocks(el));
    else if (el.type === "image") blocks.push(`![](asset:${(el as ImageEl).assetId})`);
  }
  if (slide.notes.trim() !== "") blocks.push(notesBlock(slide.notes));
  return blocks.join("\n\n");
}

export function buildMarkdown(deck: Deck, _assets?: MarkdownAssets): string {
  const sections = [`# ${escapeText(deck.title)}`, ...deck.slides.map(slideMarkdown)];
  return `${sections.join("\n\n")}\n`;
}
