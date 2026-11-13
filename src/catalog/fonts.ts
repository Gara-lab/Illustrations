import { fromBase64 } from "../model/base64.ts";
import fontFilesJson from "./data/font-files.json" with { type: "json" };
import fontListJson from "./data/fonts.json" with { type: "json" };
import fontMetricsJson from "./data/font-metrics.json" with { type: "json" };

export interface BundledFont {
  family: string;
  category: "sans" | "serif" | "display" | "mono";
  files: { weight: number; file: string }[];
}

let listCache: BundledFont[] | null = null;
const faceCache = new Map<string, string>();

export function bundledFonts(): BundledFont[] {
  if (!listCache) {
    listCache = structuredClone(fontListJson) as BundledFont[];
  }
  return listCache.map((f) => ({ ...f, files: f.files.map((x) => ({ ...x })) }));
}

function fontBase64(file: string): string {
  if (!/^[a-z0-9-]+\.woff2$/.test(file)) throw new Error(`Invalid font file name: ${file}`);
  const data = (fontFilesJson as Record<string, string>)[file];
  if (data === undefined) throw new Error(`Font file not bundled: ${file}`);
  return data;
}

export function fontBytes(file: string): Uint8Array {
  return fromBase64(fontBase64(file));
}

export function buildFontFaceCss(font: BundledFont): string {
  return font.files
    .map((f) => {
      let data: string;
      try {
        data = fontBase64(f.file);
      } catch (error) {
        throw new Error(`Cannot read bundled font file "${f.file}" for family "${font.family}": ${error instanceof Error ? error.message : String(error)}`);
      }
      return (
        `@font-face{font-family:'${font.family}';font-style:normal;font-weight:${f.weight};font-display:block;` +
        `src:url("data:font/woff2;base64,${data}") format("woff2")}`
      );
    })
    .join("\n");
}

export function fontFaceCss(family: string): string | null {
  const wanted = family.trim().toLowerCase();
  const font = bundledFonts().find((f) => f.family.toLowerCase() === wanted);
  if (!font) return null;
  const known = faceCache.get(font.family);
  if (known !== undefined) return known;
  const css = buildFontFaceCss(font);
  faceCache.set(font.family, css);
  return css;
}

export interface FontMetric {
  space: number;
  fallback: number;
  advances: Record<string, number>;
}

let metricCache: Record<string, { regular: FontMetric; bold: FontMetric }> | null = null;

export function fontMetric(family: string, bold: boolean): FontMetric {
  if (!metricCache) {
    metricCache = fontMetricsJson as unknown as Record<string, { regular: FontMetric; bold: FontMetric }>;
  }
  const entry = metricCache[family] ?? (metricCache.Inter as { regular: FontMetric; bold: FontMetric });
  return bold ? entry.bold : entry.regular;
}
