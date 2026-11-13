import { BRIEF_LIMITS } from "../brief/brief.ts";
import type { Brief, BriefSlide } from "../brief/brief.ts";
import type { ContentBlock } from "./types.ts";

const UNTITLED = "Untitled presentation";
const CONTINUED = " (continued)";
const ELLIPSIS = "…";

function clip(text: string, max: number, full?: string[]): string {
  if (text.length <= max) return text;
  full?.push(text);
  const head = text.slice(0, max - 1);
  const space = head.lastIndexOf(" ");
  return `${(space > max / 2 ? head.slice(0, space) : head).trimEnd()}${ELLIPSIS}`;
}

export interface TextPlan {
  agenda: boolean;
  target: number | null;
}

const DROP_RANK: Record<string, number> = { section: 0, statement: 1, image: 2, quote: 3, number: 4, points: 5 };

function fitCount(slides: BriefSlide[], target: number): void {
  const dropped: string[] = [];
  while (slides.length + 1 > target) {
    let at = -1;
    let best = Infinity;
    slides.forEach((s, i) => {
      const rank = DROP_RANK[s.intent];
      if (rank !== undefined && rank <= best) {
        best = rank;
        at = i;
      }
    });
    if (at < 0) break;
    dropped.push((slides.splice(at, 1)[0] as BriefSlide).headline);
  }
  const last = slides.at(-1);
  if (dropped.length > 0 && last !== undefined) last.notes = clip(`${last.notes ?? ""}\nOmitted to fit the slide count: ${dropped.join("; ")}`.trim(), BRIEF_LIMITS.notes);
}

function agendaSlide(slides: BriefSlide[]): BriefSlide | null {
  const heads = [...new Set(slides.filter((s) => s.intent !== "closing").map((s) => s.headline.replace(CONTINUED, "")))];
  if (heads.length < 3) return null;
  return { intent: "points", headline: "Agenda", points: heads.slice(0, BRIEF_LIMITS.points).map((h) => clip(h, BRIEF_LIMITS.point)) };
}

export function textToBrief(blocks: ContentBlock[], plan: TextPlan = { agenda: false, target: null }): Brief {
  const first = blocks[0];
  const hasTitle = first?.kind === "heading" && first.level === 1;
  const title = clip(hasTitle ? first.text : UNTITLED, BRIEF_LIMITS.title);
  const rest = hasTitle ? blocks.slice(1) : blocks;
  const intro = rest[0];
  const subtitle = hasTitle && intro?.kind === "paragraph" ? clip(intro.text, BRIEF_LIMITS.subtitle) : undefined;
  const body = subtitle === undefined ? rest : rest.slice(1);

  const slides: BriefSlide[] = [];
  let head = title;
  let used = 0;
  let pending = false;

  const push = (slide: Omit<BriefSlide, "headline">, full: string[]): void => {
    const headline = clip(used === 0 ? head : `${head}${CONTINUED}`, BRIEF_LIMITS.headline);
    slides.push({ headline, ...slide, ...(full.length === 0 ? {} : { notes: clip(full.join("\n"), BRIEF_LIMITS.notes) }) });
    used++;
    pending = false;
  };
  const settle = (): void => {
    if (pending) slides.push({ intent: "section", headline: clip(head, BRIEF_LIMITS.headline) });
    pending = false;
  };

  for (let i = 0; i < body.length; i++) {
    const block = body[i] as ContentBlock;
    const full: string[] = [];
    if (block.kind === "heading") {
      settle();
      const last = !body.slice(i + 1).some((b) => b.kind === "heading");
      const next = body[i + 1];
      if (block.level === 1 && last && slides.length > 0) {
        const note = next?.kind === "paragraph" ? next.text : "";
        slides.push({ intent: "closing", headline: clip(block.text, BRIEF_LIMITS.headline), ...(note === "" ? {} : { notes: clip(note, BRIEF_LIMITS.notes) }) });
        if (note !== "") i++;
        head = title;
        used = 0;
      } else {
        head = block.text;
        used = 0;
        pending = true;
      }
    } else if (block.kind === "paragraph") {
      push({ intent: "statement", body: clip(block.text, BRIEF_LIMITS.body, full) }, full);
    } else if (block.kind === "bullets") {
      for (let at = 0; at < block.items.length; at += BRIEF_LIMITS.points) {
        const points = block.items.slice(at, at + BRIEF_LIMITS.points).map((p) => clip(p, BRIEF_LIMITS.point, full));
        push({ intent: "points", points }, full.splice(0));
      }
    } else if (block.kind === "quote") {
      const quote = { text: clip(block.text, BRIEF_LIMITS.quoteText, full), ...(block.by === null ? {} : { by: clip(block.by, BRIEF_LIMITS.quoteBy, full) }) };
      push({ intent: "quote", quote }, full);
    } else if (block.kind === "number") {
      if (block.value.length <= BRIEF_LIMITS.numberValue) {
        push({ intent: "number", number: { value: block.value, label: clip(block.label, BRIEF_LIMITS.numberLabel, full) } }, full);
      } else {
        push({ intent: "statement", body: clip(`${block.value} ${block.label}`, BRIEF_LIMITS.body, full) }, full);
      }
    } else {
      const image = { file: block.assetId, ...(block.caption === null ? {} : { caption: clip(block.caption, BRIEF_LIMITS.imageText, full) }) };
      push({ intent: "image", image }, full);
    }
  }
  settle();

  if (slides.length === 0) slides.push({ intent: "section", headline: title });
  if (plan.target !== null) fitCount(slides, plan.target - (plan.agenda ? 1 : 0));
  const agenda = plan.agenda ? agendaSlide(slides) : null;
  if (agenda !== null) slides.unshift(agenda);
  if (slides.length > BRIEF_LIMITS.slides) {
    const dropped = slides.length - BRIEF_LIMITS.slides;
    slides.length = BRIEF_LIMITS.slides;
    const lastSlide = slides[BRIEF_LIMITS.slides - 1] as BriefSlide;
    lastSlide.notes = clip(`${lastSlide.notes ?? ""}\nOmitted ${dropped} more slides.`.trim(), BRIEF_LIMITS.notes);
  }
  return { version: 1, title, ...(subtitle === undefined ? {} : { subtitle }), slides };
}
