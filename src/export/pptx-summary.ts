import JSZip from "jszip";

export interface PptxElement {
  name: string;
  kind: "text" | "shape" | "image" | "line";
}

export interface PptxSlideSummary {
  index: number;
  elements: PptxElement[];
}

export interface PptxSummary {
  slides: PptxSlideSummary[];
  fonts: string[];
  imageCount: number;
}

const ELEMENT = /<p:(sp|pic|cxnSp)>([\s\S]*?)<\/p:\1>/g;
const NAME = /<p:cNvPr\b[^>]*?\bname="([^"]*)"/;
const FONT = /<a:latin\b[^>]*?\btypeface="([^"]*)"/g;
const SLIDE_FILE = /^ppt\/slides\/slide(\d+)\.xml$/;
const MEDIA_FILE = /^ppt\/media\/[^/]+$/;

function decode(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, "&");
}

function kindOf(tag: string, body: string): PptxElement["kind"] {
  if (tag === "pic") return "image";
  if (tag === "cxnSp") return "line";
  return body.includes("<a:t>") || body.includes("<a:t ") ? "text" : "shape";
}

export async function summarisePptx(data: Uint8Array): Promise<PptxSummary> {
  const zip = await JSZip.loadAsync(data);
  const slideFiles = Object.keys(zip.files)
    .map((name) => ({ name, match: SLIDE_FILE.exec(name) }))
    .filter((x): x is { name: string; match: RegExpExecArray } => x.match !== null)
    .map((x) => ({ name: x.name, n: Number(x.match[1]) }))
    .sort((a, b) => a.n - b.n);
  const fonts = new Set<string>();
  const slides: PptxSlideSummary[] = [];
  for (const file of slideFiles) {
    const xml = await (zip.file(file.name) as JSZip.JSZipObject).async("string");
    const elements: PptxElement[] = [];
    for (const m of xml.matchAll(ELEMENT)) {
      const body = m[2] as string;
      const name = NAME.exec(body)?.[1] ?? "";
      elements.push({ name: decode(name), kind: kindOf(m[1] as string, body) });
    }
    for (const m of xml.matchAll(FONT)) fonts.add(decode(m[1] as string));
    slides.push({ index: slides.length + 1, elements });
  }
  const imageCount = Object.keys(zip.files).filter((name) => MEDIA_FILE.test(name)).length;
  return { slides, fonts: [...fonts].sort(), imageCount };
}
