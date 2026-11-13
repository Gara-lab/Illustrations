export interface ImageInfo {
  mime: string;
  w: number;
  h: number;
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function startsWith(data: Uint8Array, bytes: number[], at = 0): boolean {
  return data.length >= at + bytes.length && bytes.every((b, i) => data[at + i] === b);
}

function ascii(data: Uint8Array, at: number, text: string): boolean {
  return startsWith(data, Array.from(text, (c) => c.charCodeAt(0)), at);
}

function jpegSize(data: Uint8Array, view: DataView): { w: number; h: number } | null {
  let offset = 2;
  while (offset + 9 < data.length) {
    if (data[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = data[offset + 1] ?? 0;
    if (marker === 0xff) {
      offset += 1;
      continue;
    }
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { w: view.getUint16(offset + 7), h: view.getUint16(offset + 5) };
    }
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      offset += 2;
      continue;
    }
    const length = view.getUint16(offset + 2);
    if (length < 2) return null;
    offset += 2 + length;
  }
  return null;
}

function webpSize(data: Uint8Array, view: DataView): { w: number; h: number } | null {
  if (ascii(data, 12, "VP8 ") && data.length >= 30 && startsWith(data, [0x9d, 0x01, 0x2a], 23)) {
    return { w: view.getUint16(26, true) & 0x3fff, h: view.getUint16(28, true) & 0x3fff };
  }
  if (ascii(data, 12, "VP8L") && data.length >= 25 && data[20] === 0x2f) {
    const bits = view.getUint32(21, true);
    return { w: (bits & 0x3fff) + 1, h: ((bits >> 14) & 0x3fff) + 1 };
  }
  if (ascii(data, 12, "VP8X") && data.length >= 30) {
    const w = (data[24] ?? 0) | ((data[25] ?? 0) << 8) | ((data[26] ?? 0) << 16);
    const h = (data[27] ?? 0) | ((data[28] ?? 0) << 8) | ((data[29] ?? 0) << 16);
    return { w: w + 1, h: h + 1 };
  }
  return null;
}

export function inspectImage(data: Uint8Array): ImageInfo | null {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  if (startsWith(data, PNG_SIGNATURE) && data.length >= 24 && ascii(data, 12, "IHDR")) {
    return { mime: "image/png", w: view.getUint32(16), h: view.getUint32(20) };
  }
  if ((ascii(data, 0, "GIF87a") || ascii(data, 0, "GIF89a")) && data.length >= 10) {
    return { mime: "image/gif", w: view.getUint16(6, true), h: view.getUint16(8, true) };
  }
  if (startsWith(data, [0xff, 0xd8]) && data.length > 4) {
    const size = jpegSize(data, view);
    return size ? { mime: "image/jpeg", ...size } : null;
  }
  if (ascii(data, 0, "RIFF") && ascii(data, 8, "WEBP")) {
    const size = webpSize(data, view);
    return size ? { mime: "image/webp", ...size } : null;
  }
  return null;
}
