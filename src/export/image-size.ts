export function readSize(mime: string, data: Uint8Array): { w: number; h: number } | null {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  if (mime === "image/png" && data.length >= 24 && view.getUint32(0) === 0x89504e47) {
    return { w: view.getUint32(16), h: view.getUint32(20) };
  }
  if (mime === "image/gif" && data.length >= 10) {
    return { w: view.getUint16(6, true), h: view.getUint16(8, true) };
  }
  if ((mime === "image/jpeg" || mime === "image/jpg") && data.length > 4 && view.getUint16(0) === 0xffd8) {
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
      const isSof = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
      if (isSof) return { w: view.getUint16(offset + 7), h: view.getUint16(offset + 5) };
      if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
        offset += 2;
        continue;
      }
      offset += 2 + view.getUint16(offset + 2);
    }
  }
  return null;
}
