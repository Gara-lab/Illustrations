export interface Fit {
  scale: number;
  width: number;
  height: number;
}

export function fitScale(box: { width: number; height: number }, design: { w: number; h: number }): Fit {
  const bw = Number.isFinite(box.width) ? Math.max(0, box.width) : 0;
  const bh = Number.isFinite(box.height) ? Math.max(0, box.height) : 0;
  if (design.w <= 0 || design.h <= 0) return { scale: 0, width: 0, height: 0 };
  const scale = Math.min(bw / design.w, bh / design.h);
  return { scale, width: design.w * scale, height: design.h * scale };
}
