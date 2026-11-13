import type { RenderHost } from "../export/export-deck.ts";

const XHTML = "http://www.w3.org/1999/xhtml";
const PRINT_CLEANUP_MS = 300000;
const REVOKE_DELAY_MS = 30000;

function svgDocument(html: string, size: { w: number; h: number }): string {
  const parsed = new DOMParser().parseFromString(html, "text/html");
  const serializer = new XMLSerializer();
  const styles = Array.from(parsed.querySelectorAll("style")).map((s) => serializer.serializeToString(s));
  const body = Array.from(parsed.body.childNodes).map((n) => serializer.serializeToString(n));
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size.w}" height="${size.h}"><foreignObject x="0" y="0" width="${size.w}" height="${size.h}">` +
    `<div xmlns="${XHTML}" style="position:relative;width:${size.w}px;height:${size.h}px;overflow:hidden">${styles.join("")}${body.join("")}</div></foreignObject></svg>`
  );
}

async function loadImage(src: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.src = src;
  await img.decode();
  return img;
}

async function capturePng(html: string, size: { w: number; h: number }): Promise<Uint8Array> {
  const svg = svgDocument(html, size);
  const img = await loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
  const canvas = document.createElement("canvas");
  canvas.width = size.w;
  canvas.height = size.h;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("The browser could not create a drawing surface");
  context.drawImage(img, 0, 0, size.w, size.h);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("The browser could not encode the PNG");
  return new Uint8Array(await blob.arrayBuffer());
}

async function printDocument(html: string, size: { w: number; h: number }): Promise<void> {
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = `position:fixed;left:-10000px;top:0;width:${size.w}px;height:${size.h}px;border:0`;
  frame.srcdoc = html.replace(/<script[\s\S]*?<\/script>/g, "");
  const loaded = new Promise<void>((resolve) => frame.addEventListener("load", () => resolve(), { once: true }));
  document.body.appendChild(frame);
  await loaded;
  const win = frame.contentWindow;
  if (!win) {
    frame.remove();
    throw new Error("The browser could not open the print view");
  }
  const cleanup = () => frame.remove();
  win.addEventListener("afterprint", cleanup, { once: true });
  setTimeout(cleanup, PRINT_CLEANUP_MS);
  win.focus();
  win.print();
}

function download(name: string, data: Uint8Array | string, mime: string): void {
  const url = URL.createObjectURL(new Blob([data as BlobPart], { type: mime }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS);
}

export function createBrowserHost(): RenderHost {
  return { capturePng, printDocument, download };
}
