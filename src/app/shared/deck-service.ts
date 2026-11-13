import { looksLikeBrief, parseBriefText, validateBrief } from "../../brief/brief.ts";
import type { Brief } from "../../brief/brief.ts";
import { loadCatalog } from "../../catalog/catalog.ts";
import type { Catalog } from "../../catalog/types.ts";
import { designDeck } from "../../design/design-deck.ts";
import { DIRECTIONS, pickDirection } from "../../design/directions.ts";
import { validateOptions } from "../../input/options.ts";
import { parseContent } from "../../input/parse-content.ts";
import { textToBrief } from "../../input/text-to-brief.ts";
import type { TextPlan } from "../../input/text-to-brief.ts";
import type { Options } from "../../input/types.ts";
import { validateDeck } from "../../model/deck.ts";
import type { AssetStore, Deck } from "../../model/deck.ts";
import { FIXTURE_HIRES_ID, FIXTURE_LOGO_ID, FIXTURE_PHOTO_ID, createFixtureAssets } from "../../model/fixtures/decks.ts";
import { renderSlideHtml } from "../../render/html.ts";
import type { GenerateRequest, GenerateResult } from "./api-types.ts";
import { optionChoices, plainError } from "./option-labels.ts";
import type { OptionChoices } from "./option-labels.ts";

const DEFAULT_OPTIONS: Options = {
  presentationType: "business-pitch",
  objective: "raise-funding",
  lengthSlides: 10,
  tone: "professional",
  animation: "fade",
  aspect: "16:9",
  mode: "deterministic",
  seed: null,
  context: "",
  slideNumber: false,
  footerText: ""
};

function seedFromTitle(title: string): number {
  let h = 2166136261;
  for (let i = 0; i < title.length; i++) {
    h ^= title.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export interface DeckService {
  assets: AssetStore;
  catalog: Catalog;
  choices(): OptionChoices;
  defaultOptions(): Options;
  generate(request: unknown): GenerateResult;
  renderSlides(deck: unknown): string[];
}

function resolveBrief(content: string, plan: TextPlan): { ok: true; brief: Brief } | { ok: false; errors: string[] } {
  if (!looksLikeBrief(content)) return { ok: true, brief: textToBrief(parseContent(content, [FIXTURE_PHOTO_ID, FIXTURE_LOGO_ID, FIXTURE_HIRES_ID]), plan) };
  const parsed = parseBriefText(content);
  if (!parsed.ok) return { ok: false, errors: [parsed.error] };
  const checked = validateBrief(parsed.value);
  return checked.ok ? { ok: true, brief: checked.brief } : { ok: false, errors: checked.errors };
}

function checkDeck(deck: unknown): Deck {
  const valid = validateDeck(deck);
  if (!valid.ok) throw new Error(`Invalid deck: ${valid.errors.join("; ")}`);
  return valid.deck;
}

export function createDeckService(assets: AssetStore = createFixtureAssets()): DeckService {
  const catalog = loadCatalog();
  return {
    assets,
    catalog,
    choices: () => optionChoices(catalog),
    defaultOptions: () => ({ ...DEFAULT_OPTIONS }),
    generate(request) {
      const req = request as Partial<GenerateRequest> | null;
      const content = typeof req?.content === "string" ? req.content : "";
      const checked = validateOptions(req?.options, catalog);
      if (!checked.ok) return { ok: false, errors: checked.errors.map(plainError) };
      const { presentationType, objective, lengthSlides, tone } = checked.options;
      const structure = catalog.structures.find((s) => s.presentationType === presentationType && s.objective === objective);
      const resolved = resolveBrief(content, { agenda: structure?.roles.some((r) => r.role === "agenda") ?? false, target: lengthSlides });
      if (!resolved.ok) return { ok: false, errors: resolved.errors };
      const direction = DIRECTIONS.find((d) => d.id === req?.direction)?.id ?? pickDirection(tone, resolved.brief.mood, resolved.brief.audience);
      const seed = checked.options.seed ?? (checked.options.mode === "creative" ? Math.floor(Math.random() * 4294967296) : seedFromTitle(resolved.brief.title));
      const deck = designDeck(resolved.brief, { direction, seed, aspect: checked.options.aspect, animation: checked.options.animation, photoAssetId: FIXTURE_PHOTO_ID, slideNumber: checked.options.slideNumber, footerText: checked.options.footerText });
      const valid = validateDeck(deck);
      if (!valid.ok) return { ok: false, errors: valid.errors.map(plainError) };
      return { ok: true, deck: valid.deck };
    },
    renderSlides(deck) {
      const valid = checkDeck(deck);
      return valid.slides.map((_, i) => renderSlideHtml(valid, i, assets));
    }
  };
}
