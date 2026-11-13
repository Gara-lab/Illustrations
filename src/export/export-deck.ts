import JSZip from "jszip";
import type { Deck } from "../model/deck";
import { validateDeck } from "../model/deck.ts";
import { renderDeckHtml, renderSlideHtml } from "../render/html.ts";
import type { AssetStore } from "../render/html";
import { buildPptx } from "./pptx.ts";
import { buildMarkdown } from "./markdown.ts";

export type ExportFormat = "html" | "pptx" | "pdf" | "png" | "md";

export type ExportResult = { ok: true; path: string; warnings: string[] } | { ok: false; error: string };

export interface RenderHost {
  capturePng(html: string, size: { w: number; h: number }): Promise<Uint8Array>;
  printDocument(html: string, size: { w: number; h: number }): Promise<void>;
  download(name: string, data: Uint8Array | string, mime: string): void;
}

export const PPTX_MIME = "application/vnd.openxmlformats-officedocument.presentationml.presentation";

const PDF_WARNING = 'Choose "Save as PDF" as the printer in the print dialog. The browser decides the final file.';

export function exportBaseName(deck: Deck): string {
  const cleaned = String(deck.title ?? "")
    .replace(/[^\p{L}\p{N} _-]+/gu, "-")
    .trim()
    .slice(0, 60)
    .trim();
  return cleaned === "" ? "deck" : cleaned;
}

function slideFileName(index: number): string {
  return `slide-${String(index + 1).padStart(3, "0")}.png`;
}

export async function exportDeck(deck: Deck, format: ExportFormat, assets: AssetStore, host: RenderHost): Promise<ExportResult> {
  try {
    const checked = validateDeck(deck);
    if (!checked.ok) return { ok: false, error: `Deck is invalid: ${checked.errors.join("; ")}` };
    const base = exportBaseName(deck);
    const warnings: string[] = [];
    let name: string;
    if (format === "html") {
      name = `${base}.html`;
      host.download(name, renderDeckHtml(deck, assets), "text/html");
    } else if (format === "md") {
      name = `${base}.md`;
      host.download(name, buildMarkdown(deck, assets), "text/markdown");
    } else if (format === "pptx") {
      const built = await buildPptx(deck, assets);
      warnings.push(...built.warnings);
      name = `${base}.pptx`;
      host.download(name, built.data, PPTX_MIME);
    } else if (format === "pdf") {
      name = `${base}.pdf`;
      await host.printDocument(renderDeckHtml(deck, assets), deck.size);
      warnings.push(PDF_WARNING);
    } else if (format === "png") {
      const files: { name: string; data: Uint8Array }[] = [];
      for (let i = 0; i < deck.slides.length; i++) {
        files.push({ name: slideFileName(i), data: await host.capturePng(renderSlideHtml(deck, i, assets), deck.size) });
      }
      if (files.length === 1) {
        name = `${base}.png`;
        host.download(name, (files[0] as { data: Uint8Array }).data, "image/png");
      } else {
        const zip = new JSZip();
        for (const file of files) zip.file(file.name, file.data);
        name = `${base}-png.zip`;
        host.download(name, await zip.generateAsync({ type: "uint8array" }), "application/zip");
      }
    } else {
      return { ok: false, error: `Unknown export format: ${String(format)}` };
    }
    return { ok: true, path: name, warnings };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
