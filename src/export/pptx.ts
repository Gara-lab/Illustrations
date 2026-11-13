import PptxGenJS from "pptxgenjs";
import JSZip from "jszip";
import { toBase64 } from "../model/base64.ts";
import type { Deck, Element, Fill, ImageEl, PathEl, ShapeEl, TextEl } from "../model/deck";
import { applyEffects, firstColor, lineEffects, patchedFill, shapeEffects } from "./pptx-effects.ts";
import type { EffectMap, SlideEffects } from "./pptx-effects.ts";
import { readSize } from "./image-size.ts";
import { escapeXml, unescapeXml } from "./xml.ts";

export interface PptxAssets {
  get(assetId: string): { mime: string; data: Uint8Array } | null;
}

export interface PptxResult {
  data: Uint8Array;
  warnings: string[];
  patches: { paragraphProps: number; crops: number; sharedMedia: number; effects: number };
}

type Patches = PptxResult["patches"];

const BACKGROUND_NAME = "slide background";
const MAX_LEVEL = 8;
const MIN_FONT_PT = 1;
const clampLevel = (level: number): number => (Number.isFinite(level) ? Math.min(MAX_LEVEL, Math.max(0, Math.trunc(level))) : 0);

const PX_PER_INCH = 96;
const PT_PER_PX = 0.75;
const FIXED_DATE = new Date(Date.UTC(2020, 0, 1, 0, 0, 0));
const FIXED_ISO = "2020-01-01T00:00:00Z";
const inches = (px: number): number => px / PX_PER_INCH;
const hex = (color: string): string => color.slice(1).toUpperCase();
const pt = (px: number): number => px * PT_PER_PX;

type Pic = { x: number; y: number; prst: "ellipse" | "roundRect" | null; adj: number };
type Crops = Map<string, Pic>;
type Asset = { mime: string; data: Uint8Array };
type Box = { x: number; y: number; w: number; h: number };
type Rounding = { shape: ShapeEl["shape"]; radius: number };

function lookup(assets: PptxAssets, assetId: string): Asset | null {
  try {
    return assets.get(assetId);
  } catch {
    return null;
  }
}

function addPicture(
  slide: PptxGenJS.Slide,
  name: string,
  rotation: number,
  box: Box,
  fit: "cover" | "contain",
  asset: Asset,
  rounding: Rounding | null,
  warnings: string[],
  where: string,
  crops: Crops
): void {
  const base = { data: `${asset.mime};base64,${toBase64(asset.data)}`, rotate: rotation, objectName: name };
  const size = readSize(asset.mime, asset.data);
  let target = box;
  let crop = { x: 0, y: 0 };
  if (!size || size.w <= 0 || size.h <= 0) {
    warnings.push(`${where}: image size could not be read, drawn stretched to its box.`);
  } else {
    const imageRatio = size.w / size.h;
    const boxRatio = box.w / box.h;
    if (fit === "contain") {
      const fitW = imageRatio > boxRatio ? box.w : box.h * imageRatio;
      const fitH = imageRatio > boxRatio ? box.w / imageRatio : box.h;
      target = { x: box.x + (box.w - fitW) / 2, y: box.y + (box.h - fitH) / 2, w: fitW, h: fitH };
    } else {
      crop = {
        x: imageRatio > boxRatio ? (1 - boxRatio / imageRatio) / 2 : 0,
        y: imageRatio > boxRatio ? 0 : (1 - imageRatio / boxRatio) / 2
      };
    }
  }
  const shorter = Math.min(target.w, target.h);
  const radius = rounding ? Math.min(Math.max(0, rounding.radius), shorter / 2) : 0;
  const prst = rounding?.shape === "ellipse" ? "ellipse" : radius > 0 ? "roundRect" : null;
  if (crop.x > 0 || crop.y > 0 || prst) {
    crops.set(name, { ...crop, prst, adj: shorter > 0 ? Math.round((radius / shorter) * 100000) : 0 });
  }
  slide.addImage({ ...base, x: inches(target.x), y: inches(target.y), w: inches(target.w), h: inches(target.h) });
}

function addImage(slide: PptxGenJS.Slide, el: ImageEl, asset: Asset, warnings: string[], where: string, crops: Crops): void {
  addPicture(slide, el.id, el.rotation, el, el.fit, asset, null, warnings, where, crops);
}

function addText(slide: PptxGenJS.Slide, el: TextEl): void {
  const runs: PptxGenJS.TextProps[] = [];
  el.paragraphs.forEach((paragraph, index) => {
    const isLast = index === el.paragraphs.length - 1;
    const paragraphOptions: PptxGenJS.TextPropsOptions = paragraph.bullet
      ? { bullet: { indent: pt(el.fontSize) * 1.2 }, indentLevel: clampLevel(paragraph.level) }
      : { bullet: false, indentLevel: clampLevel(paragraph.level) };
    const source = paragraph.runs.length > 0 ? paragraph.runs : [{ text: "" }];
    source.forEach((run, runIndex) => {
      runs.push({
        text: run.text,
        options: {
          ...(runIndex === 0 ? paragraphOptions : {}),
          bold: run.bold === true,
          italic: run.italic === true,
          color: hex(run.color ?? el.color),
          breakLine: !isLast && runIndex === source.length - 1
        }
      });
    });
  });
  slide.addText(runs, {
    x: inches(el.x),
    y: inches(el.y),
    w: inches(el.w),
    h: inches(el.h),
    fontFace: escapeXml(el.fontFamily),
    fontSize: Math.max(MIN_FONT_PT, pt(el.fontSize)),
    color: hex(el.color),
    align: el.align,
    valign: el.valign,
    lineSpacingMultiple: el.lineHeight,
    margin: 0,
    wrap: true,
    fit: "none",
    rotate: el.rotation,
    objectName: el.id
  });
}

function addShape(
  pptx: PptxGenJS,
  slide: PptxGenJS.Slide,
  el: ShapeEl | PathEl,
  fill: Exclude<Fill, { kind: "image" }>,
  name: string,
  effects: EffectMap,
  withShadow: boolean
): void {
  const patched = patchedFill(fill);
  const extra = shapeEffects(el, fill, withShadow);
  if (extra) effects.set(name, extra);
  const isRounded = el.type === "shape" && el.shape === "rect" && el.radius > 0;
  const radius = el.type === "shape" ? Math.min(el.radius, Math.min(el.w, el.h) / 2) : 0;
  slide.addShape(el.type === "shape" && el.shape === "ellipse" ? pptx.ShapeType.ellipse : isRounded ? pptx.ShapeType.roundRect : pptx.ShapeType.rect, {
    x: inches(el.x),
    y: inches(el.y),
    w: inches(el.w),
    h: inches(el.h),
    fill: patched ? { color: hex(firstColor(patched)) } : fill.kind === "solid" ? { color: hex(fill.color) } : { type: "none" },
    line: el.stroke ? { color: hex(el.stroke.color), width: pt(el.stroke.width) } : { type: "none" },
    rotate: el.rotation,
    objectName: name,
    ...(isRounded ? { rectRadius: inches(radius) } : {})
  });
}

function addElement(pptx: PptxGenJS, slide: PptxGenJS.Slide, el: Element, assets: PptxAssets, warnings: string[], where: string, crops: Crops, effects: EffectMap): void {
  switch (el.type) {
    case "text":
      addText(slide, el);
      if (el.shadow) effects.set(el.id, { textShadow: el.shadow });
      return;
    case "shape": {
      const fill = el.fill;
      if (fill.kind !== "image") {
        addShape(pptx, slide, el, fill, el.id, effects, true);
        return;
      }
      const asset = lookup(assets, fill.assetId);
      if (!asset) {
        warnings.push(`${where}: asset "${fill.assetId}" is missing, the image fill was left out.`);
        addShape(pptx, slide, el, { kind: "none" }, el.id, effects, true);
        return;
      }
      addPicture(slide, el.id, el.rotation, el, fill.fit, asset, { shape: el.shape, radius: el.radius }, warnings, where, crops);
      if (el.shadow) effects.set(el.id, { shadow: el.shadow });
      if (el.stroke) addShape(pptx, slide, el, { kind: "none" }, `${el.id}:stroke`, effects, false);
      return;
    }
    case "line": {
      const extra = lineEffects(el.stroke);
      if (extra) effects.set(el.id, extra);
      slide.addShape(pptx.ShapeType.line, {
        x: inches(el.x),
        y: inches(el.y),
        w: inches(el.w),
        h: inches(el.h),
        line: { color: hex(el.stroke.color), width: pt(el.stroke.width) },
        rotate: el.rotation,
        objectName: el.id
      });
      return;
    }
    case "image": {
      const asset = lookup(assets, el.assetId);
      if (!asset) {
        warnings.push(`${where}: asset "${el.assetId}" is missing, the image was left out.`);
        return;
      }
      addImage(slide, el, asset, warnings, where, crops);
      if (el.shadow) effects.set(el.id, { shadow: el.shadow });
      return;
    }
    case "path":
      addShape(pptx, slide, el, el.fill, el.id, effects, true);
      return;
  }
}

const PARAGRAPH_PROPS = /<a:pPr\b[^>]*?(?:\/>|>[\s\S]*?<\/a:pPr>)/g;

function keepFirstParagraphProps(xml: string, patches: Patches): string {
  return xml.replace(/<a:p>([\s\S]*?)<\/a:p>/g, (_whole, inner: string) => {
    let seen = false;
    return `<a:p>${inner.replace(PARAGRAPH_PROPS, (props) => {
      if (seen) {
        patches.paragraphProps += 1;
        return "";
      }
      seen = true;
      return props;
    })}</a:p>`;
  });
}

function applyCrops(xml: string, crops: Crops | undefined, patches: Patches): string {
  if (!crops) return xml;
  return xml.replace(/<p:pic>[\s\S]*?<\/p:pic>/g, (pic) => {
    const name = /<p:cNvPr id="\d+" name="([^"]*)"/.exec(pic)?.[1] ?? "";
    const entry = crops.get(unescapeXml(name));
    if (!entry) return pic;
    patches.crops += 1;
    let out = pic;
    const x = Math.round(entry.x * 100000);
    const y = Math.round(entry.y * 100000);
    if (x > 0 || y > 0) out = out.replace(/<a:stretch>/, `<a:srcRect l="${x}" t="${y}" r="${x}" b="${y}"/><a:stretch>`);
    if (entry.prst) {
      const adjust = entry.prst === "roundRect" ? `<a:gd name="adj" fmla="val ${entry.adj}"/>` : "";
      out = out.replace(/<a:prstGeom prst="rect"><a:avLst\/><\/a:prstGeom>/, `<a:prstGeom prst="${entry.prst}"><a:avLst>${adjust}</a:avLst></a:prstGeom>`);
    }
    return out;
  });
}

function dropMissingOverrides(types: string, names: Set<string>): string {
  return types.replace(/<Override PartName="\/([^"]+)"[^>]*\/>/g, (whole, part: string) => (names.has(part) ? whole : ""));
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const hash = await globalThis.crypto.subtle.digest("SHA-256", bytes as Uint8Array<ArrayBuffer>);
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
}

async function normalise(raw: Uint8Array, crops: Map<number, Crops>, effects: Map<number, SlideEffects>, patches: Patches): Promise<Uint8Array> {
  const source = await JSZip.loadAsync(raw);
  const names = Object.keys(source.files)
    .filter((name) => !source.files[name]?.dir)
    .sort((a, b) => (a === "[Content_Types].xml" ? -1 : b === "[Content_Types].xml" ? 1 : a < b ? -1 : a > b ? 1 : 0));
  const media = new Map<string, Uint8Array>();
  const shared = new Map<string, string>();
  const firstByDigest = new Map<string, string>();
  for (const name of names) {
    const file = source.files[name];
    if (!file || !name.startsWith("ppt/media/")) continue;
    const bytes = await file.async("uint8array");
    media.set(name, bytes);
    const digest = `${name.slice(name.lastIndexOf("."))}:${await sha256Hex(bytes)}`;
    const first = firstByDigest.get(digest);
    if (first) {
      shared.set(name.slice("ppt/media/".length), first.slice("ppt/media/".length));
      patches.sharedMedia += 1;
    } else {
      firstByDigest.set(digest, name);
    }
  }
  const target = new JSZip();
  for (const name of names) {
    const file = source.files[name];
    if (!file) continue;
    if (media.has(name) && shared.has(name.slice("ppt/media/".length))) continue;
    let content: string | Uint8Array;
    const slideNumber = /^ppt\/slides\/slide(\d+)\.xml$/.exec(name)?.[1];
    if (media.has(name)) {
      content = media.get(name) as Uint8Array;
    } else if (slideNumber) {
      const cropped = applyCrops(keepFirstParagraphProps(await file.async("string"), patches), crops.get(Number(slideNumber)), patches);
      content = applyEffects(cropped, effects.get(Number(slideNumber)), patches);
    } else if (name.endsWith(".rels")) {
      content = (await file.async("string")).replace(/Target="([^"]*\/)?media\/([^"/]+)"/g, (whole, dir: string | undefined, base: string) => {
        const canonical = shared.get(base);
        return canonical ? `Target="${dir ?? ""}media/${canonical}"` : whole;
      });
    } else if (name === "[Content_Types].xml") {
      content = dropMissingOverrides(await file.async("string"), new Set(names));
    } else if (name === "docProps/core.xml") {
      content = (await file.async("string")).replace(/(<dcterms:(?:created|modified)[^>]*>)[^<]+/g, `$1${FIXED_ISO}`);
    } else {
      content = await file.async("uint8array");
    }
    target.file(name, content, { date: FIXED_DATE, createFolders: false });
  }
  return target.generateAsync({ type: "uint8array", compression: "DEFLATE", compressionOptions: { level: 6 } });
}

export async function buildPptx(deck: Deck, assets: PptxAssets): Promise<PptxResult> {
  const warnings: string[] = [];
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: "DECK", width: inches(deck.size.w), height: inches(deck.size.h) });
  pptx.layout = "DECK";
  pptx.title = deck.title;
  pptx.author = "";
  pptx.company = "";

  const fonts = new Set<string>();
  const crops = new Map<number, Crops>();
  const effects = new Map<number, SlideEffects>();
  let hasMotion = false;

  deck.slides.forEach((deckSlide, slideIndex) => {
    const slide = pptx.addSlide();
    const slideCrops: Crops = new Map();
    crops.set(slideIndex + 1, slideCrops);
    const slideEffects: SlideEffects = { named: new Map(), background: null };
    effects.set(slideIndex + 1, slideEffects);
    const background = deckSlide.background;
    const patchedBackground = patchedFill(background);
    if (patchedBackground) {
      slide.background = { color: hex(firstColor(patchedBackground)) };
      slideEffects.background = patchedBackground;
    } else if (background.kind === "solid") slide.background = { color: hex(background.color) };
    if (background.kind === "image") {
      const asset = lookup(assets, background.assetId);
      const where = `Slide ${slideIndex + 1}, background`;
      if (asset) addPicture(slide, BACKGROUND_NAME, 0, { x: 0, y: 0, w: deck.size.w, h: deck.size.h }, background.fit, asset, null, warnings, where, slideCrops);
      else warnings.push(`${where}: asset "${background.assetId}" is missing, the image background was left out.`);
    }
    if (deckSlide.notes) slide.addNotes(deckSlide.notes);
    if (deckSlide.transition) hasMotion = true;
    deckSlide.elements.forEach((el) => {
      if (el.animation) hasMotion = true;
      if (el.type === "text") fonts.add(el.fontFamily);
      addElement(pptx, slide, el, assets, warnings, `Slide ${slideIndex + 1}, element "${el.id}"`, slideCrops, slideEffects.named);
    });
  });

  if (hasMotion) warnings.push("Animations and transitions are not exported to PowerPoint in this version.");
  if (fonts.size > 0) {
    warnings.push(`Fonts used: ${[...fonts].sort().join(", ")}. Install them on any computer that opens the file, or PowerPoint will substitute other fonts.`);
  }

  const raw = (await pptx.write({ outputType: "uint8array" })) as Uint8Array;
  const patches: Patches = { paragraphProps: 0, crops: 0, sharedMedia: 0, effects: 0 };
  return { data: await normalise(raw, crops, effects, patches), warnings, patches };
}
