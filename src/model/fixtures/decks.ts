import { fromBase64 } from "../base64.ts";
import imagesJson from "./fixture-images.json" with { type: "json" };
import type { Deck, ImageEl, LineEl, PathCommand, PathEl, ShapeEl, TextEl } from "../deck.ts";

export const FIXTURE_PHOTO_ID = "asset-photo";
export const FIXTURE_LOGO_ID = "asset-logo";
export const FIXTURE_HIRES_ID = "asset-hires";

const IMAGE_FILES: Record<string, string> = {
  [FIXTURE_PHOTO_ID]: "photo.png",
  [FIXTURE_LOGO_ID]: "logo.png",
  [FIXTURE_HIRES_ID]: "hires.png"
};

const loaded = new Map<string, Uint8Array>();

export function createFixtureAssets(): { get(assetId: string): { mime: string; data: Uint8Array } | null } {
  return {
    get(assetId) {
      const file = Object.hasOwn(IMAGE_FILES, assetId) ? IMAGE_FILES[assetId] : undefined;
      if (!file) return null;
      let data = loaded.get(file);
      if (!data) {
        data = fromBase64((imagesJson as Record<string, string>)[file] as string);
        loaded.set(file, data);
      }
      return { mime: "image/png", data };
    }
  };
}

const STAR: [number, number][] = [[12, 2], [15, 9], [22, 9], [16.5, 13.5], [18.5, 21], [12, 16.5], [5.5, 21], [7.5, 13.5], [2, 9], [9, 9]];

const base = { rotation: 0, animation: null, role: null };

function text(id: string, x: number, y: number, w: number, h: number, rest: Partial<TextEl> & Pick<TextEl, "paragraphs">): TextEl {
  return {
    ...base,
    type: "text",
    id,
    x,
    y,
    w,
    h,
    fontFamily: "Inter",
    fontSize: 24,
    color: "#1B2430",
    align: "left",
    valign: "top",
    lineHeight: 1.2,
    ...rest
  };
}

function shape(id: string, x: number, y: number, w: number, h: number, rest: Partial<ShapeEl> & Pick<ShapeEl, "shape" | "fill">): ShapeEl {
  return { ...base, type: "shape", id, x, y, w, h, stroke: null, radius: 0, ...rest };
}

function image(id: string, x: number, y: number, w: number, h: number, assetId: string, fit: ImageEl["fit"], rest: Partial<ImageEl> = {}): ImageEl {
  return { ...base, type: "image", id, x, y, w, h, assetId, fit, ...rest };
}

function line(id: string, x: number, y: number, w: number, h: number, rest: Partial<LineEl> & Pick<LineEl, "stroke">): LineEl {
  return { ...base, type: "line", id, x, y, w, h, ...rest };
}

function star(id: string, x: number, y: number, w: number, h: number, color: string, rest: Partial<PathEl> = {}): PathEl {
  const commands = [...STAR.map(([px, py], i): PathCommand => [i === 0 ? "M" : "L", (px * w) / 24, (py * h) / 24]), ["Z"] as PathCommand];
  return { ...base, type: "path", id, x, y, w, h, commands, fill: { kind: "solid", color }, stroke: null, ...rest };
}

export const FIXTURE_DECK_16_9: Deck = {
  version: 1,
  id: "fixture-deck-16-9",
  title: "Quarterly review",
  aspect: "16:9",
  size: { w: 1280, h: 720 },
  themeId: "fixture-theme",
  seed: null,
  mode: "deterministic",
  slides: [
    {
      id: "s1",
      layoutId: "title",
      background: { kind: "solid", color: "#0F1B2D" },
      transition: { preset: "fade", durationMs: 600 },
      notes: "Open with the headline result.",
      elements: [
        shape("s1-accent", 80, 120, 14, 200, {
          shape: "rect",
          fill: { kind: "solid", color: "#F2A541" },
          role: "accent"
        }),
        text("s1-title", 120, 120, 1000, 140, {
          role: "title",
          fontFamily: "Georgia",
          fontSize: 64,
          color: "#FFFFFF",
          align: "left",
          valign: "bottom",
          lineHeight: 1.1,
          animation: { preset: "fade-up", order: 1, delayMs: 0 },
          paragraphs: [
            {
              bullet: false,
              level: 0,
              runs: [
                { text: "Quarterly ", bold: true },
                { text: "review", bold: true, italic: true, color: "#F2A541" }
              ]
            }
          ]
        }),
        text("s1-subtitle", 120, 280, 900, 40, {
          role: "subtitle",
          fontSize: 28,
          color: "#B8C4D6",
          animation: { preset: "fade-up", order: 2, delayMs: 200 },
          paragraphs: [{ bullet: false, level: 0, runs: [{ text: "Results, risks and next steps" }] }]
        }),
        shape("s1-orb", 960, 380, 240, 240, {
          shape: "ellipse",
          fill: { kind: "solid", color: "#1F3A5F" },
          stroke: { color: "#F2A541", width: 4 },
          animation: { preset: "zoom-in", order: 3, delayMs: 0 }
        }),
        line("s1-rule", 120, 360, 400, 1, { stroke: { color: "#F2A541", width: 3 } })
      ]
    },
    {
      id: "s2",
      layoutId: "image-right",
      background: { kind: "solid", color: "#FFFFFF" },
      transition: null,
      notes: "",
      elements: [
        text("s2-heading", 60, 40, 1160, 80, {
          role: "title",
          fontFamily: "Georgia",
          fontSize: 44,
          valign: "middle",
          paragraphs: [{ bullet: false, level: 0, runs: [{ text: "What changed this quarter", bold: true }] }]
        }),
        text("s2-body", 60, 150, 600, 400, {
          role: "body",
          fontSize: 26,
          lineHeight: 1.4,
          animation: { preset: "fade-up", order: 1, delayMs: 0 },
          paragraphs: [
            { bullet: true, level: 0, runs: [{ text: "Revenue up " }, { text: "18%", bold: true, color: "#1E8E5A" }] },
            { bullet: true, level: 1, runs: [{ text: "Driven by renewals and " }, { text: "two new regions", italic: true }] },
            { bullet: true, level: 0, runs: [{ text: "Churn down to 2.1%" }] },
            { bullet: true, level: 0, runs: [{ text: "Support backlog cleared" }] }
          ]
        }),
        shape("s2-card", 700, 150, 520, 400, {
          shape: "rect",
          fill: { kind: "solid", color: "#EEF2F7" },
          stroke: { color: "#C9D3E0", width: 2 },
          radius: 24
        }),
        image("s2-photo", 720, 170, 480, 280, FIXTURE_PHOTO_ID, "cover", {
          role: "image",
          animation: { preset: "fade", order: 2, delayMs: 100 }
        }),
        image("s2-logo", 720, 470, 200, 60, FIXTURE_LOGO_ID, "contain"),
        star("s2-star", 1140, 480, 60, 60, "#F2A541")
      ]
    },
    {
      id: "s3",
      layoutId: "closing",
      background: { kind: "none" },
      transition: { preset: "slide", durationMs: 400 },
      notes: "Ask for approval of the plan.",
      elements: [
        shape("s3-frame", 160, 140, 960, 440, {
          shape: "rect",
          fill: { kind: "none" },
          stroke: { color: "#1B2430", width: 3 },
          radius: 12
        }),
        text("s3-quote", 200, 180, 880, 280, {
          role: "quote",
          fontFamily: "Georgia",
          fontSize: 40,
          align: "center",
          valign: "middle",
          lineHeight: 1.3,
          paragraphs: [
            {
              bullet: false,
              level: 0,
              runs: [{ text: "The best way to predict the future is to " }, { text: "build it", italic: true, bold: true }]
            }
          ]
        }),
        line("s3-rule", 200, 480, 880, 1, { stroke: { color: "#1B2430", width: 2 } }),
        text("s3-by", 200, 500, 880, 50, {
          role: "attribution",
          fontSize: 22,
          color: "#5A6778",
          align: "right",
          valign: "bottom",
          paragraphs: [{ bullet: false, level: 0, runs: [{ text: "Planning team", italic: true }] }]
        }),
        star("s3-mark", 600, 600, 80, 80, "#1B2430", { animation: { preset: "zoom-in", order: 1, delayMs: 300 } })
      ]
    },
    {
      id: "s4",
      layoutId: "image-background",
      background: { kind: "image", assetId: FIXTURE_HIRES_ID, fit: "cover" },
      transition: { preset: "fade", durationMs: 500 },
      notes: "Full-slide image background with image-filled shapes.",
      elements: [
        image("s4-photo-again", 60, 60, 280, 190, FIXTURE_PHOTO_ID, "cover", {
          animation: { preset: "fade", order: 1, delayMs: 0 }
        }),
        shape("s4-card", 880, 80, 340, 300, {
          shape: "rect",
          fill: { kind: "image", assetId: FIXTURE_PHOTO_ID, fit: "cover" },
          stroke: { color: "#FFFFFF", width: 6 },
          radius: 48
        }),
        shape("s4-disc", 940, 420, 220, 220, {
          shape: "ellipse",
          fill: { kind: "image", assetId: FIXTURE_PHOTO_ID, fit: "cover" },
          animation: { preset: "zoom-in", order: 2, delayMs: 0 }
        }),
        shape("s4-badge", 400, 80, 420, 200, {
          shape: "rect",
          fill: { kind: "image", assetId: FIXTURE_LOGO_ID, fit: "contain" },
          radius: 30
        }),
        shape("s4-panel", 60, 440, 700, 220, {
          shape: "rect",
          fill: { kind: "solid", color: "#0F1B2D" },
          radius: 20
        }),
        text("s4-title", 100, 470, 620, 160, {
          role: "title",
          fontFamily: "Georgia",
          fontSize: 48,
          color: "#FFFFFF",
          valign: "middle",
          paragraphs: [{ bullet: false, level: 0, runs: [{ text: "Images as backgrounds", bold: true }] }]
        })
      ]
    }
  ]
};

export const FIXTURE_DECK_9_16: Deck = {
  version: 1,
  id: "fixture-deck-9-16",
  title: "Product story",
  aspect: "9:16",
  size: { w: 720, h: 1280 },
  themeId: "fixture-theme",
  seed: 42,
  mode: "creative",
  slides: [
    {
      id: "p1",
      layoutId: "cover-tall",
      background: { kind: "solid", color: "#14323A" },
      transition: { preset: "fade", durationMs: 500 },
      notes: "Vertical cover for mobile sharing.",
      elements: [
        image("p1-hero", 0, 0, 720, 640, FIXTURE_PHOTO_ID, "cover", {
          role: "image",
          animation: { preset: "fade", order: 1, delayMs: 0 }
        }),
        shape("p1-badge", 60, 600, 220, 80, {
          shape: "rect",
          fill: { kind: "solid", color: "#FF6B4A" },
          radius: 40,
          animation: { preset: "zoom-in", order: 2, delayMs: 100 }
        }),
        text("p1-badge-label", 60, 600, 220, 80, {
          fontSize: 28,
          color: "#FFFFFF",
          align: "center",
          valign: "middle",
          paragraphs: [{ bullet: false, level: 0, runs: [{ text: "New", bold: true }] }]
        }),
        text("p1-title", 60, 720, 600, 260, {
          role: "title",
          fontFamily: "Playfair Display",
          fontSize: 72,
          color: "#FFFFFF",
          valign: "top",
          lineHeight: 1.05,
          animation: { preset: "fade-up", order: 3, delayMs: 0 },
          paragraphs: [
            {
              bullet: false,
              level: 0,
              runs: [{ text: "Meet the ", bold: true }, { text: "new way", bold: true, color: "#FF6B4A" }, { text: " to plan", bold: true }]
            }
          ]
        }),
        line("p1-rule", 60, 1000, 300, 1, { stroke: { color: "#FF6B4A", width: 4 } }),
        text("p1-caption", 60, 1030, 600, 120, {
          role: "subtitle",
          fontSize: 28,
          color: "#BFD3D8",
          align: "left",
          valign: "top",
          lineHeight: 1.4,
          paragraphs: [{ bullet: false, level: 0, runs: [{ text: "Swipe to see how it works, in three steps." }] }]
        })
      ]
    },
    {
      id: "p2",
      layoutId: "steps-tall",
      background: { kind: "none" },
      transition: null,
      notes: "",
      elements: [
        text("p2-heading", 60, 60, 600, 100, {
          role: "title",
          fontFamily: "Playfair Display",
          fontSize: 48,
          align: "center",
          valign: "middle",
          paragraphs: [{ bullet: false, level: 0, runs: [{ text: "Three simple steps", bold: true }] }]
        }),
        shape("p2-disc", 260, 200, 200, 200, {
          shape: "ellipse",
          fill: { kind: "solid", color: "#E6F3F5" },
          stroke: { color: "#14323A", width: 3 }
        }),
        star("p2-icon", 310, 250, 100, 100, "#14323A", { animation: { preset: "zoom-in", order: 1, delayMs: 0 } }),
        text("p2-steps", 60, 440, 600, 500, {
          role: "body",
          fontSize: 30,
          lineHeight: 1.5,
          animation: { preset: "fade-up", order: 2, delayMs: 150 },
          paragraphs: [
            { bullet: true, level: 0, runs: [{ text: "Add your content", bold: true }] },
            { bullet: true, level: 1, runs: [{ text: "Text, images and " }, { text: "notes", italic: true }] },
            { bullet: true, level: 0, runs: [{ text: "Pick a tone and a seed", bold: true }] },
            { bullet: true, level: 0, runs: [{ text: "Export to " }, { text: "PowerPoint", color: "#C2410C", bold: true }] }
          ]
        }),
        image("p2-logo", 60, 980, 240, 80, FIXTURE_LOGO_ID, "contain"),
        shape("p2-footer", 0, 1180, 720, 100, {
          shape: "rect",
          fill: { kind: "solid", color: "#14323A" },
          radius: 0
        }),
        text("p2-footer-text", 60, 1200, 600, 60, {
          fontSize: 24,
          color: "#FFFFFF",
          align: "right",
          valign: "bottom",
          paragraphs: [{ bullet: false, level: 0, runs: [{ text: "Made offline, on your device" }] }]
        })
      ]
    },
    {
      id: "p3",
      layoutId: "gallery-tall",
      background: { kind: "image", assetId: FIXTURE_PHOTO_ID, fit: "contain" },
      transition: null,
      notes: "Contained background, high resolution image fill and animated image.",
      elements: [
        shape("p3-frame", 60, 100, 600, 400, {
          shape: "rect",
          fill: { kind: "image", assetId: FIXTURE_HIRES_ID, fit: "cover" },
          stroke: { color: "#14323A", width: 5 },
          radius: 60
        }),
        image("p3-hires", 60, 560, 600, 360, FIXTURE_HIRES_ID, "contain", {
          animation: { preset: "zoom-in", order: 1, delayMs: 0 }
        }),
        shape("p3-pill", 60, 980, 600, 120, {
          shape: "rect",
          fill: { kind: "image", assetId: FIXTURE_LOGO_ID, fit: "cover" },
          radius: 60
        }),
        text("p3-caption", 60, 1140, 600, 80, {
          fontSize: 26,
          color: "#14323A",
          align: "center",
          valign: "middle",
          paragraphs: [{ bullet: false, level: 0, runs: [{ text: "One asset, many places" }] }]
        })
      ]
    }
  ]
};
