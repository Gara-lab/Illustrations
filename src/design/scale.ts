const MIN_BODY = 24;
const DOMINANT_MIN = 48;

export interface Scale {
  ratio: number;
  sizes: number[];
  domMin: number;
  step(k: number): number;
}

export function makeScale(ratio: number): Scale {
  const sizes: number[] = [];
  for (let k = -1; k <= 8; k++) sizes.push(Math.round(MIN_BODY * ratio ** k));
  const domMin = sizes.find((s) => s >= DOMINANT_MIN) as number;
  return {
    ratio,
    sizes,
    domMin,
    step(k: number): number {
      return sizes[Math.max(-1, Math.min(8, k)) + 1] as number;
    }
  };
}

export function sizesBetween(scale: Scale, lo: number, hi: number): number[] {
  const found = scale.sizes.filter((s) => s >= lo && s <= hi).reverse();
  return found.length > 0 ? found : [lo];
}
