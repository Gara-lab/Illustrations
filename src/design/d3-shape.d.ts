declare module "d3-shape" {
  export interface PieSlice {
    startAngle: number;
    endAngle: number;
    index: number;
  }
  export interface PathContext {
    moveTo(x: number, y: number): void;
    lineTo(x: number, y: number): void;
    arc(x: number, y: number, r: number, a0: number, a1: number, ccw?: boolean): void;
    closePath(): void;
    rect(x: number, y: number, w: number, h: number): void;
    bezierCurveTo(x1: number, y1: number, x2: number, y2: number, x: number, y: number): void;
    quadraticCurveTo(x1: number, y1: number, x: number, y: number): void;
  }
  export interface ArcGenerator {
    (slice: { startAngle: number; endAngle: number }): string | null;
    innerRadius(r: number): ArcGenerator;
    outerRadius(r: number): ArcGenerator;
    context(ctx: PathContext): ArcGenerator;
  }
  export interface PieGenerator {
    (data: number[]): PieSlice[];
    sort(compare: null): PieGenerator;
    value(read: (d: number) => number): PieGenerator;
  }
  export function arc(): ArcGenerator;
  export function pie(): PieGenerator;
}
