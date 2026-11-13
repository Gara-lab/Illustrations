export type Aspect = "16:9" | "9:16";

export interface GradientStop { color: string; at: number; alpha?: number }
export type Fill =
  | { kind: "solid"; color: string; alpha?: number }
  | { kind: "none" }
  | { kind: "image"; assetId: string; fit: "cover" | "contain" }
  | { kind: "gradient"; angle: number; stops: GradientStop[] };
export interface Stroke { color: string; width: number; alpha?: number; linecap?: "butt" | "round" | "square"; linejoin?: "miter" | "round" | "bevel" }
export interface Shadow { dx: number; dy: number; blur: number; color: string; alpha: number }
export interface Animation { preset: string; order: number; delayMs: number }
export interface Transition { preset: string; durationMs: number }

export interface ElBase {
  id: string;
  x: number; y: number; w: number; h: number;
  rotation: number;
  animation: Animation | null;
  role: string | null;
}

export interface Run { text: string; bold?: boolean; italic?: boolean; color?: string }
export interface Paragraph { runs: Run[]; bullet: boolean; level: number }

export interface TextEl extends ElBase {
  type: "text";
  paragraphs: Paragraph[];
  fontFamily: string;
  fontSize: number;
  color: string;
  align: "left" | "center" | "right";
  valign: "top" | "middle" | "bottom";
  lineHeight: number;
  shadow?: Shadow;
}
export interface ShapeEl extends ElBase { type: "shape"; shape: "rect" | "ellipse"; fill: Fill; stroke: Stroke | null; radius: number; shadow?: Shadow }
export interface ImageEl extends ElBase { type: "image"; assetId: string; fit: "cover" | "contain"; shadow?: Shadow }
export interface LineEl extends ElBase { type: "line"; stroke: Stroke }

export type PathCommand =
  | ["M", number, number]
  | ["L", number, number]
  | ["C", number, number, number, number, number, number]
  | ["Z"];
export type PathFill = Exclude<Fill, { kind: "image" }>;
export interface PathEl extends ElBase { type: "path"; commands: PathCommand[]; fill: PathFill; stroke: Stroke | null; shadow?: Shadow }

export type Element = TextEl | ShapeEl | ImageEl | LineEl | PathEl;

export interface Slide {
  id: string;
  layoutId: string | null;
  background: Fill;
  elements: Element[];
  transition: Transition | null;
  notes: string;
}

export interface Deck {
  version: 1;
  id: string;
  title: string;
  aspect: Aspect;
  size: { w: number; h: number };
  themeId: string;
  seed: number | null;
  mode: "deterministic" | "creative";
  slides: Slide[];
}

export interface AssetStore {
  get(assetId: string): { mime: string; data: Uint8Array } | null;
}

export type ValidationResult = { ok: true; deck: Deck } | { ok: false; errors: string[] };

const ID_PATTERN = /^[A-Za-z0-9_.:-]+$/;
const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;
const MAX_SHADOW_OFFSET = 1000;
const MAX_SHADOW_BLUR = 500;
const MAX_ANGLE = 360;
const SHADOW_TYPES = ["text", "shape", "image", "path"];
const MAX_PATH_COMMANDS = 200;
const PATH_MARGIN = 0.5;
export const PATH_ARITY: Record<string, number> = { M: 2, L: 2, C: 6, Z: 0 };
const SIZES: Record<Aspect, { w: number; h: number }> = {
  "16:9": { w: 1280, h: 720 },
  "9:16": { w: 720, h: 1280 }
};

export function sizeFor(aspect: Aspect): { w: number; h: number } {
  return { ...SIZES[aspect] };
}

type Obj = Record<string, unknown>;

function isObj(v: unknown): v is Obj {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isNum(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

export function validateDeck(input: unknown): ValidationResult {
  const errors: string[] = [];
  const err = (where: string, msg: string): void => {
    errors.push(`${where}: ${msg}`);
  };

  const str = (o: Obj, k: string, where: string): boolean => {
    if (typeof o[k] !== "string") {
      err(where, `"${k}" must be a string`);
      return false;
    }
    return true;
  };
  const num = (o: Obj, k: string, where: string): boolean => {
    if (!isNum(o[k])) {
      err(where, `"${k}" must be a finite number`);
      return false;
    }
    return true;
  };
  const positive = (o: Obj, k: string, where: string): void => {
    if (num(o, k, where) && (o[k] as number) <= 0) err(where, `"${k}" must be greater than 0`);
  };
  const colour = (v: unknown, where: string, label: string): void => {
    if (typeof v !== "string" || !HEX_COLOR.test(v)) {
      err(where, `${label} must be a colour like #1A2B3C, got ${JSON.stringify(v)}`);
    }
  };
  const idFormat = (v: string, where: string, label: string): void => {
    if (!ID_PATTERN.test(v)) err(where, `${label} ${JSON.stringify(v)} may only use letters, digits, underscore, dot, colon and hyphen`);
  };
  const oneOf = (o: Obj, k: string, allowed: readonly string[], where: string): void => {
    if (typeof o[k] !== "string" || !allowed.includes(o[k] as string)) {
      err(where, `"${k}" must be one of ${allowed.join(", ")}, got ${JSON.stringify(o[k])}`);
    }
  };
  const alpha = (o: Obj, where: string, label: string): void => {
    if (o.alpha !== undefined && (!isNum(o.alpha) || o.alpha < 0 || o.alpha > 1)) {
      err(where, `${label} alpha must be a number from 0 to 1, got ${JSON.stringify(o.alpha)}`);
    }
  };
  const gradient = (v: Obj, where: string): void => {
    if (!isNum(v.angle) || v.angle < -MAX_ANGLE || v.angle > MAX_ANGLE) {
      err(where, `gradient angle must be a number from -${MAX_ANGLE} to ${MAX_ANGLE}, got ${JSON.stringify(v.angle)}`);
    }
    if (!Array.isArray(v.stops) || v.stops.length < 2 || v.stops.length > 3) {
      return err(where, "gradient stops must be an array of 2 or 3 stops");
    }
    let previous = 0;
    v.stops.forEach((st: unknown, k: number) => {
      const sw = `${where} gradient stop ${k + 1}`;
      if (!isObj(st)) return err(sw, "must be an object");
      colour(st.color, sw, "stop colour");
      alpha(st, sw, "stop");
      if (!isNum(st.at) || st.at < 0 || st.at > 1) return err(sw, `"at" must be a number from 0 to 1, got ${JSON.stringify(st.at)}`);
      if (st.at < previous) err(sw, `"at" ${st.at} must not be lower than the previous stop (${previous})`);
      previous = st.at;
    });
  };
  const shadow = (v: unknown, where: string): void => {
    if (!isObj(v)) return err(where, "shadow must be an object");
    const sw = `${where} shadow`;
    (["dx", "dy"] as const).forEach((k) => {
      if (num(v, k, sw) && Math.abs(v[k] as number) > MAX_SHADOW_OFFSET) err(sw, `"${k}" must be between -${MAX_SHADOW_OFFSET} and ${MAX_SHADOW_OFFSET}`);
    });
    if (num(v, "blur", sw) && ((v.blur as number) < 0 || (v.blur as number) > MAX_SHADOW_BLUR)) err(sw, `"blur" must be from 0 to ${MAX_SHADOW_BLUR}`);
    colour(v.color, sw, "shadow colour");
    if (!isNum(v.alpha) || v.alpha < 0 || v.alpha > 1) err(sw, `shadow alpha must be a number from 0 to 1, got ${JSON.stringify(v.alpha)}`);
  };
  const pathCommands = (e: Obj, where: string): void => {
    const list = e.commands;
    if (!Array.isArray(list)) return err(where, `"commands" must be an array`);
    if (list.length > MAX_PATH_COMMANDS) return err(where, `"commands" may have at most ${MAX_PATH_COMMANDS} entries, got ${list.length}`);
    const w = isNum(e.w) ? e.w : 0;
    const h = isNum(e.h) ? e.h : 0;
    let drawn = 0;
    let current = false;
    list.forEach((c: unknown, k: number) => {
      const cw = `${where} command ${k + 1}`;
      const op = Array.isArray(c) && typeof c[0] === "string" && Object.hasOwn(PATH_ARITY, c[0]) ? c[0] : null;
      if (op === null || (c as unknown[]).length !== (PATH_ARITY[op] as number) + 1) return err(cw, `must be ["M", x, y], ["L", x, y], ["C", x1, y1, x2, y2, x, y] or ["Z"]`);
      if (op !== "M" && !current) err(cw, k === 0 ? "the first command must be M" : "the command after Z must be M");
      current = op !== "Z";
      if (op === "L" || op === "C") drawn += 1;
      (c as unknown[]).slice(1).forEach((v, n) => {
        const span = n % 2 === 0 ? w : h;
        if (!isNum(v)) err(cw, "coordinates must be finite numbers");
        else if (span > 0 && (v < -PATH_MARGIN * span || v > (1 + PATH_MARGIN) * span)) err(cw, `coordinate ${v} lies too far outside the element box (limit ${PATH_MARGIN * 100}% beyond each side)`);
      });
    });
    const openStroke = drawn === 1 && isObj(e.fill) && e.fill.kind === "none" && isObj(e.stroke);
    if (drawn < 2 && !openStroke) err(where, "a path needs at least 2 drawing commands (L or C), or one when it has a stroke and no fill");
  };
  const fill = (v: unknown, where: string): void => {
    if (!isObj(v)) return err(where, "fill must be an object");
    if (v.kind === "solid") {
      colour(v.color, where, "fill colour");
      alpha(v, where, "fill");
    } else if (v.kind === "gradient") gradient(v, where);
    else if (v.kind === "image") {
      if (str(v, "assetId", where)) idFormat(v.assetId as string, where, "fill assetId");
      oneOf(v, "fit", ["cover", "contain"], where);
    } else if (v.kind !== "none") err(where, `fill kind must be solid, gradient, none or image, got ${JSON.stringify(v.kind)}`);
  };
  const stroke = (v: unknown, where: string): void => {
    if (!isObj(v)) return err(where, "stroke must be an object");
    colour(v.color, where, "stroke colour");
    alpha(v, where, "stroke");
    positive(v, "width", `${where} stroke`);
    if (v.linecap !== undefined) oneOf(v, "linecap", ["butt", "round", "square"], where);
    if (v.linejoin !== undefined) oneOf(v, "linejoin", ["miter", "round", "bevel"], where);
  };

  if (!isObj(input)) return { ok: false, errors: ["deck: must be an object"] };

  if (input.version !== 1) err("deck", `unsupported version ${JSON.stringify(input.version)}, expected 1`);
  if (str(input, "id", "deck")) idFormat(input.id as string, "deck", "deck id");
  str(input, "title", "deck");
  str(input, "themeId", "deck");
  oneOf(input, "mode", ["deterministic", "creative"], "deck");
  if (input.seed !== null && !isNum(input.seed)) err("deck", `"seed" must be a number or null`);

  let size: { w: number; h: number } | null = null;
  const aspectOk = input.aspect === "16:9" || input.aspect === "9:16";
  if (!aspectOk) err("deck", `"aspect" must be one of 16:9, 9:16, got ${JSON.stringify(input.aspect)}`);
  if (!isObj(input.size)) err("deck", `"size" must be an object with w and h`);
  else {
    positive(input.size, "w", "deck size");
    positive(input.size, "h", "deck size");
    if (isNum(input.size.w) && isNum(input.size.h) && input.size.w > 0 && input.size.h > 0) {
      size = { w: input.size.w, h: input.size.h };
      if (aspectOk) {
        const expected = sizeFor(input.aspect as Aspect);
        if (size.w !== expected.w || size.h !== expected.h) {
          err("deck", `size ${size.w}x${size.h} does not match aspect ${String(input.aspect)}, expected ${expected.w}x${expected.h}`);
        }
      }
    }
  }

  const slideIds = new Set<string>();
  const elementIds = new Set<string>();

  const validateElement = (e: unknown, ew: string): void => {
    if (!isObj(e)) return err(ew, "must be an object");
    if (str(e, "id", ew)) {
      idFormat(e.id as string, ew, "element id");
      if (elementIds.has(e.id as string)) err(ew, `duplicate element id "${String(e.id)}"`);
      elementIds.add(e.id as string);
    }
    const nums = ["x", "y", "w", "h", "rotation"].map((k) => num(e, k, ew));
    if (isNum(e.w) && e.w <= 0) err(ew, `"w" must be greater than 0`);
    if (isNum(e.h) && e.h <= 0) err(ew, `"h" must be greater than 0`);
    if (nums.every(Boolean) && size) {
      const x = e.x as number, y = e.y as number, w = e.w as number, h = e.h as number;
      if (x < 0 || y < 0 || x + w > size.w || y + h > size.h) {
        err(ew, `lies outside the ${size.w}x${size.h} slide area (x ${x}, y ${y}, w ${w}, h ${h})`);
      }
    }
    if (e.role !== null && typeof e.role !== "string") err(ew, `"role" must be a string or null`);
    if (e.animation !== null) {
      if (!isObj(e.animation)) err(ew, "animation must be an object or null");
      else {
        str(e.animation, "preset", `${ew} animation`);
        num(e.animation, "order", `${ew} animation`);
        if (num(e.animation, "delayMs", `${ew} animation`) && (e.animation.delayMs as number) < 0) {
          err(`${ew} animation`, `"delayMs" must not be negative`);
        }
      }
    }
    if (e.shadow !== undefined) {
      if (SHADOW_TYPES.includes(e.type as string)) shadow(e.shadow, ew);
      else err(ew, `shadow is only supported on text, shape, image and path elements, not ${String(e.type)}`);
    }
    switch (e.type) {
      case "text":
        str(e, "fontFamily", ew);
        positive(e, "fontSize", ew);
        positive(e, "lineHeight", ew);
        colour(e.color, ew, "text colour");
        oneOf(e, "align", ["left", "center", "right"], ew);
        oneOf(e, "valign", ["top", "middle", "bottom"], ew);
        if (!Array.isArray(e.paragraphs)) err(ew, `"paragraphs" must be an array`);
        else {
          e.paragraphs.forEach((p: unknown, k: number) => {
            const pw = `${ew} paragraph ${k + 1}`;
            if (!isObj(p)) return err(pw, "must be an object");
            if (typeof p.bullet !== "boolean") err(pw, `"bullet" must be true or false`);
            if (!isNum(p.level) || !Number.isInteger(p.level) || p.level < 0 || p.level > 8) {
              err(pw, `"level" must be a whole number from 0 to 8`);
            }
            if (!Array.isArray(p.runs)) return err(pw, `"runs" must be an array`);
            p.runs.forEach((r: unknown, m: number) => {
              const rw = `${pw} run ${m + 1}`;
              if (!isObj(r)) return err(rw, "must be an object");
              str(r, "text", rw);
              if (r.bold !== undefined && typeof r.bold !== "boolean") err(rw, `"bold" must be true or false`);
              if (r.italic !== undefined && typeof r.italic !== "boolean") err(rw, `"italic" must be true or false`);
              if (r.color !== undefined) colour(r.color, rw, "run colour");
            });
          });
        }
        break;
      case "shape":
        oneOf(e, "shape", ["rect", "ellipse"], ew);
        fill(e.fill, ew);
        if (e.stroke !== null) stroke(e.stroke, ew);
        if (num(e, "radius", ew) && (e.radius as number) < 0) err(ew, `"radius" must not be negative`);
        break;
      case "image":
        str(e, "assetId", ew);
        oneOf(e, "fit", ["cover", "contain"], ew);
        break;
      case "line":
        stroke(e.stroke, ew);
        break;
      case "path":
        if (isObj(e.fill) && e.fill.kind === "image") err(ew, "a path fill cannot be an image");
        else fill(e.fill, ew);
        if (e.stroke !== null) stroke(e.stroke, ew);
        pathCommands(e, ew);
        break;
      case "icon":
        err(ew, "is an old icon element, which this version no longer reads; icons are now drawn as path elements, so regenerate the deck from its brief");
        break;
      default:
        err(ew, `unknown element type ${JSON.stringify(e.type)}`);
    }
  };

  const validateSlide = (s: unknown, i: number): void => {
    const sw = `slide ${i + 1}`;
    if (!isObj(s)) return err(sw, "must be an object");
    if (str(s, "id", sw)) {
      idFormat(s.id as string, sw, "slide id");
      if (slideIds.has(s.id as string)) err(sw, `duplicate slide id "${String(s.id)}"`);
      slideIds.add(s.id as string);
    }
    if (s.layoutId !== null && typeof s.layoutId !== "string") err(sw, `"layoutId" must be a string or null`);
    str(s, "notes", sw);
    fill(s.background, `${sw} background`);
    if (s.transition !== null) {
      if (!isObj(s.transition)) err(sw, "transition must be an object or null");
      else {
        str(s.transition, "preset", `${sw} transition`);
        if (num(s.transition, "durationMs", `${sw} transition`) && (s.transition.durationMs as number) < 0) {
          err(`${sw} transition`, `"durationMs" must not be negative`);
        }
      }
    }
    if (!Array.isArray(s.elements)) return err(sw, `"elements" must be an array`);
    s.elements.forEach((e: unknown, j: number) => validateElement(e, `${sw} element ${j + 1}`));
  };

  if (!Array.isArray(input.slides)) err("deck", `"slides" must be an array`);
  else input.slides.forEach(validateSlide);

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, deck: input as unknown as Deck };
}
