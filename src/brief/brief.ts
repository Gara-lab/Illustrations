import { ICON_NONE, iconId } from "../catalog/icon-catalog.ts";

export type SlideIntent = "title" | "section" | "statement" | "points" | "steps" | "quote" | "number" | "image" | "chart" | "table" | "closing";

export type ChartKind = "bar" | "line" | "pie" | "donut";

export interface ChartSpec {
  kind: ChartKind;
  series: { label: string; value: number }[];
  unit?: string;
  caption?: string;
}

export interface TableSpec {
  columns: string[];
  rows: string[][];
  caption?: string;
}

export interface BriefSlide {
  intent: SlideIntent;
  headline: string;
  body?: string;
  points?: string[];
  quote?: { text: string; by?: string };
  number?: { value: string; label: string };
  image?: { file: string; caption?: string } | { draw: string };
  chart?: ChartSpec;
  table?: TableSpec;
  emphasis?: "high" | "normal" | "low";
  icon?: string;
  notes?: string;
}

export interface Brief {
  version: 1;
  title: string;
  subtitle?: string;
  audience?: string;
  purpose?: string;
  mood?: string[];
  slides: BriefSlide[];
}

export type BriefResult = { ok: true; brief: Brief } | { ok: false; errors: string[] };

export const BRIEF_LIMITS = {
  title: 120,
  subtitle: 200,
  audience: 300,
  purpose: 300,
  moodEntries: 4,
  moodEntry: 30,
  slides: 60,
  headline: 100,
  body: 220,
  points: 8,
  point: 100,
  quoteText: 160,
  quoteBy: 100,
  numberValue: 12,
  numberLabel: 90,
  imageFile: 200,
  imageText: 200,
  chartPointsMin: 2,
  chartPoints: 12,
  chartLabel: 30,
  chartUnit: 12,
  chartCaption: 120,
  tableColumnsMin: 2,
  tableColumns: 6,
  tableRows: 10,
  tableCell: 40,
  notes: 4000,
} as const;

export const SLIDE_INTENTS: SlideIntent[] = ["title", "section", "statement", "points", "steps", "quote", "number", "image", "chart", "table", "closing"];

const EMPHASIS = ["high", "normal", "low"];

const INTENT_FIELDS: Record<SlideIntent, string[]> = {
  title: [],
  section: [],
  statement: ["body"],
  points: ["body", "points"],
  steps: ["body", "points"],
  quote: ["quote"],
  number: ["number"],
  image: ["image"],
  chart: ["chart"],
  table: ["table"],
  closing: [],
};

const REQUIRED_FIELD: Partial<Record<SlideIntent, string>> = {
  statement: "body",
  points: "points",
  steps: "points",
  quote: "quote",
  number: "number",
  image: "image",
  chart: "chart",
  table: "table",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const SHORT_HINT = "keep slide text short and move the explanation to notes";
const FIGURE_HINT = "give the figure itself, such as 42% or 3x, not a sentence";

function textRule(min: number, max: number, hint: string): string {
  const rule = min > 0 ? `expected text of ${min} to ${max} characters` : `expected text of at most ${max} characters`;
  return hint === "" ? rule : `${rule}; ${hint}`;
}

function readText(value: unknown, path: string, min: number, max: number, errors: string[], hint = ""): string | undefined {
  if (typeof value !== "string" || value.length > max || (min > 0 && value.trim() === "")) {
    errors.push(`${path}: ${textRule(min, max, hint)}`);
    return undefined;
  }
  return value;
}

function readOptionalText(value: unknown, path: string, max: number, errors: string[], hint = ""): string | undefined {
  if (value === undefined) return undefined;
  return readText(value, path, 0, max, errors, hint);
}

function readQuote(value: unknown, path: string, errors: string[]): BriefSlide["quote"] | undefined {
  if (!isRecord(value)) {
    errors.push(`${path}: expected an object with a text and an optional by`);
    return undefined;
  }
  const text = readText(value.text, `${path}.text`, 1, BRIEF_LIMITS.quoteText, errors, SHORT_HINT);
  const by = readOptionalText(value.by, `${path}.by`, BRIEF_LIMITS.quoteBy, errors);
  if (text === undefined) return undefined;
  return by === undefined ? { text } : { text, by };
}

function readNumber(value: unknown, path: string, errors: string[]): BriefSlide["number"] | undefined {
  if (!isRecord(value)) {
    errors.push(`${path}: expected an object with a value and a label`);
    return undefined;
  }
  const figure = readText(value.value, `${path}.value`, 1, BRIEF_LIMITS.numberValue, errors, FIGURE_HINT);
  const label = readText(value.label, `${path}.label`, 1, BRIEF_LIMITS.numberLabel, errors, SHORT_HINT);
  if (figure === undefined || label === undefined) return undefined;
  return { value: figure, label };
}

function readImage(value: unknown, path: string, errors: string[]): BriefSlide["image"] | undefined {
  if (!isRecord(value)) {
    errors.push(`${path}: expected an object with either a file or a draw description`);
    return undefined;
  }
  const hasFile = value.file !== undefined;
  const hasDraw = value.draw !== undefined;
  if (hasFile === hasDraw) {
    errors.push(`${path}: expected either a file or a draw description, not both and not neither`);
    return undefined;
  }
  if (hasDraw) {
    const draw = readText(value.draw, `${path}.draw`, 0, BRIEF_LIMITS.imageText, errors);
    return draw === undefined ? undefined : { draw };
  }
  const file = readText(value.file, `${path}.file`, 1, BRIEF_LIMITS.imageFile, errors);
  const caption = readOptionalText(value.caption, `${path}.caption`, BRIEF_LIMITS.imageText, errors);
  if (file === undefined) return undefined;
  return caption === undefined ? { file } : { file, caption };
}

const CHART_KINDS: ChartKind[] = ["bar", "line", "pie", "donut"];
const FIGURES_HINT = "give plain numbers such as 42 or 3.5, with the unit in the unit field";

function readChart(value: unknown, path: string, errors: string[]): ChartSpec | undefined {
  if (!isRecord(value)) {
    errors.push(`${path}: expected an object with a kind, a series and an optional unit and caption`);
    return undefined;
  }
  const before = errors.length;
  const kind = CHART_KINDS.find((k) => k === value.kind);
  if (kind === undefined) errors.push(`${path}.kind: expected one of ${CHART_KINDS.join(", ")}`);
  const series: { label: string; value: number }[] = [];
  const { chartPointsMin: lo, chartPoints: hi } = BRIEF_LIMITS;
  if (!Array.isArray(value.series) || value.series.length < lo || value.series.length > hi) {
    errors.push(`${path}.series: expected a list of ${lo} to ${hi} items, each with a label and a value`);
  } else {
    value.series.forEach((item, i) => {
      const at = `${path}.series[${i}]`;
      if (!isRecord(item)) {
        errors.push(`${at}: expected an object with a label and a value`);
        return;
      }
      const label = readText(item.label, `${at}.label`, 1, BRIEF_LIMITS.chartLabel, errors, SHORT_HINT);
      const figure = item.value;
      if (typeof figure !== "number" || !Number.isFinite(figure) || figure < 0) errors.push(`${at}.value: expected a number that is zero or more; ${FIGURES_HINT}`);
      else if (label !== undefined) series.push({ label, value: figure });
    });
    if ((kind === "pie" || kind === "donut") && series.length === value.series.length && series.every((p) => p.value === 0)) {
      errors.push(`${path}.series: a ${kind} chart needs at least one value above zero`);
    }
  }
  const unit = readOptionalText(value.unit, `${path}.unit`, BRIEF_LIMITS.chartUnit, errors);
  const caption = readOptionalText(value.caption, `${path}.caption`, BRIEF_LIMITS.chartCaption, errors, SHORT_HINT);
  if (errors.length > before || kind === undefined) return undefined;
  return { kind, series, ...(unit === undefined ? {} : { unit }), ...(caption === undefined ? {} : { caption }) };
}

function readTable(value: unknown, path: string, errors: string[]): TableSpec | undefined {
  if (!isRecord(value)) {
    errors.push(`${path}: expected an object with columns, rows and an optional caption`);
    return undefined;
  }
  const before = errors.length;
  const { tableColumnsMin: lo, tableColumns: hi, tableRows: maxRows, tableCell: cell } = BRIEF_LIMITS;
  const columns: string[] = [];
  if (!Array.isArray(value.columns) || value.columns.length < lo || value.columns.length > hi) {
    errors.push(`${path}.columns: expected a list of ${lo} to ${hi} short texts`);
  } else {
    value.columns.forEach((item, i) => {
      const text = readText(item, `${path}.columns[${i}]`, 1, cell, errors, SHORT_HINT);
      if (text !== undefined) columns.push(text);
    });
  }
  const rows: string[][] = [];
  if (!Array.isArray(value.rows) || value.rows.length < 1 || value.rows.length > maxRows) {
    errors.push(`${path}.rows: expected a list of 1 to ${maxRows} rows`);
  } else {
    const width = Array.isArray(value.columns) ? value.columns.length : 0;
    value.rows.forEach((row, r) => {
      const at = `${path}.rows[${r}]`;
      if (!Array.isArray(row) || row.length !== width) {
        errors.push(`${at}: expected a list of ${width} texts, one per column`);
        return;
      }
      const cells: string[] = [];
      row.forEach((item, c) => {
        const text = readText(item, `${at}[${c}]`, 0, cell, errors, SHORT_HINT);
        if (text !== undefined) cells.push(text);
      });
      if (cells.length === width) rows.push(cells);
    });
  }
  const caption = readOptionalText(value.caption, `${path}.caption`, BRIEF_LIMITS.chartCaption, errors, SHORT_HINT);
  if (errors.length > before) return undefined;
  return { columns, rows, ...(caption === undefined ? {} : { caption }) };
}

function readPoints(value: unknown, path: string, errors: string[]): string[] | undefined {
  const rule = `${path}: expected a list of 1 to ${BRIEF_LIMITS.points} short texts`;
  if (!Array.isArray(value) || value.length < 1 || value.length > BRIEF_LIMITS.points) {
    errors.push(rule);
    return undefined;
  }
  const items: string[] = [];
  let good = true;
  value.forEach((item, i) => {
    const text = readText(item, `${path}[${i}]`, 1, BRIEF_LIMITS.point, errors, SHORT_HINT);
    if (text === undefined) good = false;
    else items.push(text);
  });
  return good ? items : undefined;
}

function readSlide(value: unknown, path: string, errors: string[]): BriefSlide | undefined {
  if (!isRecord(value)) {
    errors.push(`${path}: expected an object`);
    return undefined;
  }
  const before = errors.length;
  const intent = SLIDE_INTENTS.find((i) => i === value.intent);
  if (intent === undefined) errors.push(`${path}.intent: expected one of ${SLIDE_INTENTS.join(", ")}`);
  const headline = readText(value.headline, `${path}.headline`, 1, BRIEF_LIMITS.headline, errors, SHORT_HINT);
  const slide: Partial<BriefSlide> = {};

  const allowed = intent === undefined ? ["body", "points", "quote", "number", "image", "chart", "table"] : INTENT_FIELDS[intent];
  for (const field of ["body", "points", "quote", "number", "image", "chart", "table"]) {
    const present = value[field] !== undefined;
    if (present && !allowed.includes(field)) {
      const uses = ["headline", ...allowed, "emphasis", "icon", "notes"];
      errors.push(`${path}.${field}: not used by a ${String(intent)} slide, which uses ${uses.join(", ")}`);
    } else if (intent !== undefined && !present && REQUIRED_FIELD[intent] === field) {
      errors.push(`${path}.${field}: a ${intent} slide needs this field`);
    }
  }
  if (intent !== undefined && allowed.includes("body")) {
    const body = readOptionalText(value.body, `${path}.body`, BRIEF_LIMITS.body, errors, SHORT_HINT);
    if (body !== undefined) slide.body = body;
  }
  if (intent !== undefined && allowed.includes("points") && value.points !== undefined) {
    const points = readPoints(value.points, `${path}.points`, errors);
    if (points !== undefined) slide.points = points;
  }
  if (intent === "quote" && value.quote !== undefined) {
    const quote = readQuote(value.quote, `${path}.quote`, errors);
    if (quote !== undefined) slide.quote = quote;
  }
  if (intent === "number" && value.number !== undefined) {
    const number = readNumber(value.number, `${path}.number`, errors);
    if (number !== undefined) slide.number = number;
  }
  if (intent === "image" && value.image !== undefined) {
    const image = readImage(value.image, `${path}.image`, errors);
    if (image !== undefined) slide.image = image;
  }
  if (intent === "chart" && value.chart !== undefined) {
    const chart = readChart(value.chart, `${path}.chart`, errors);
    if (chart !== undefined) slide.chart = chart;
  }
  if (intent === "table" && value.table !== undefined) {
    const table = readTable(value.table, `${path}.table`, errors);
    if (table !== undefined) slide.table = table;
  }
  if (value.emphasis !== undefined) {
    if (typeof value.emphasis === "string" && EMPHASIS.includes(value.emphasis)) slide.emphasis = value.emphasis as BriefSlide["emphasis"];
    else errors.push(`${path}.emphasis: expected high, normal or low`);
  }
  if (value.icon !== undefined) {
    const known = typeof value.icon === "string" ? (value.icon === ICON_NONE ? ICON_NONE : iconId(value.icon)) : null;
    if (known !== null) slide.icon = known;
    else errors.push(`${path}.icon: expected ${ICON_NONE} or one of the icon names listed in the prompt`);
  }
  const notes = readOptionalText(value.notes, `${path}.notes`, BRIEF_LIMITS.notes, errors);
  if (notes !== undefined) slide.notes = notes;

  if (errors.length > before || intent === undefined || headline === undefined) return undefined;
  return { intent, headline, ...slide };
}

const SNIPPET_BEFORE = 60;
const SNIPPET_AFTER = 30;
const JSON_HINT =
  "Common causes: a double quote inside a text (use single quotes instead, or write a backslash before it), a missing or extra comma, a line break inside a text, or words before or after the JSON. Paste this message back to the AI and ask it to fix the JSON.";

function tryParse(text: string): { value: unknown } | null {
  try {
    return { value: JSON.parse(text) };
  } catch {
    return null;
  }
}

function parseFailure(text: string): string {
  try {
    JSON.parse(text);
    return "";
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

function moveCitationsIntoText(source: string): string {
  return source.replace(/(?<!\\)"[ \t]*\[[^\]\r\n]*\]\((https?:\/\/[^)\s]*)\)[ \t]*(?=\r?\n|[,}\]])/g, (_match, url: string) => ` (Source: ${url})"`);
}

export function looksLikeBrief(text: string): boolean {
  const start = text.replace(/^﻿/, "").trimStart();
  return start.startsWith("{") || /^```[a-z]*\s*\{/i.test(start);
}

export function parseBriefText(text: string): { ok: true; value: unknown } | { ok: false; error: string } {
  let source = text.replace(/^﻿/, "").trim();
  const fenced = /^```[a-z]*\s*\n([\s\S]*?)\n?```$/i.exec(source);
  if (fenced !== null) source = (fenced[1] as string).trim();
  const direct = tryParse(source);
  if (direct !== null) return { ok: true, value: direct.value };
  const repaired = tryParse(moveCitationsIntoText(source));
  if (repaired !== null) return { ok: true, value: repaired.value };
  const reason = parseFailure(source);
  const at = /position (\d+)/.exec(reason);
  if (at === null) return { ok: false, error: `The brief is not valid JSON: ${reason}. ${JSON_HINT}` };
  const position = Number(at[1]);
  const flat = (s: string) => s.replace(/\s+/g, " ");
  const near = `${flat(source.slice(Math.max(0, position - SNIPPET_BEFORE), position))} [HERE] ${flat(source.slice(position, position + SNIPPET_AFTER))}`;
  return { ok: false, error: `The brief is not valid JSON: ${reason}. The problem is at [HERE] in: ${near}. ${JSON_HINT}` };
}

export function validateBrief(input: unknown): BriefResult {
  if (!isRecord(input)) return { ok: false, errors: ["The brief must be a JSON object"] };
  const errors: string[] = [];

  if (input.version !== 1) errors.push("version: expected the number 1");
  const title = readText(input.title, "title", 1, BRIEF_LIMITS.title, errors);
  const subtitle = readOptionalText(input.subtitle, "subtitle", BRIEF_LIMITS.subtitle, errors);
  const audience = readOptionalText(input.audience, "audience", BRIEF_LIMITS.audience, errors);
  const purpose = readOptionalText(input.purpose, "purpose", BRIEF_LIMITS.purpose, errors);

  let mood: string[] | undefined;
  if (input.mood !== undefined) {
    if (!Array.isArray(input.mood) || input.mood.length > BRIEF_LIMITS.moodEntries) {
      errors.push(`mood: expected a list of at most ${BRIEF_LIMITS.moodEntries} short texts`);
    } else {
      const entries: string[] = [];
      input.mood.forEach((entry, i) => {
        const text = readText(entry, `mood[${i}]`, 1, BRIEF_LIMITS.moodEntry, errors);
        if (text !== undefined) entries.push(text);
      });
      mood = entries;
    }
  }

  const slides: BriefSlide[] = [];
  if (!Array.isArray(input.slides) || input.slides.length < 1 || input.slides.length > BRIEF_LIMITS.slides) {
    errors.push(`slides: expected a list of 1 to ${BRIEF_LIMITS.slides} slides`);
  } else {
    input.slides.forEach((item, i) => {
      const slide = readSlide(item, `slides[${i}]`, errors);
      if (slide !== undefined) slides.push(slide);
    });
  }

  if (errors.length > 0 || title === undefined) return { ok: false, errors };
  const brief: Brief = { version: 1, title, slides };
  if (subtitle !== undefined) brief.subtitle = subtitle;
  if (audience !== undefined) brief.audience = audience;
  if (purpose !== undefined) brief.purpose = purpose;
  if (mood !== undefined) brief.mood = mood;
  return { ok: true, brief };
}
