import type { ExportFormat } from "../../export/export-deck.ts";
import type { PptxSummary } from "../../export/pptx-summary.ts";
import type { Options } from "../../input/types.ts";
import type { Deck } from "../../model/deck.ts";
import type { OptionChoices } from "./option-labels.ts";

export interface GenerateRequest {
  content: string;
  options: Options;
  direction?: string;
}

export type GenerateResult = { ok: true; deck: Deck } | { ok: false; errors: string[] };

export type PptxReport =
  | { ok: true; summary: PptxSummary; warnings: string[]; path: string }
  | { ok: false; error: string };

export type ExportOutcome =
  | { ok: true; path: string; warnings: string[] }
  | { ok: false; error: string }
  | { ok: false; cancelled: true };

export type ProjectOpenOutcome =
  | { ok: true; file: string; deck: Deck; assetIds: string[]; missingAssetIds: string[] }
  | { ok: false; error: string }
  | { ok: false; cancelled: true };

export type ProjectSaveOutcome =
  | { ok: true; file: string; warning?: string }
  | { ok: false; error: string }
  | { ok: false; cancelled: true };

export type AssetAddOutcome = { ok: true; id: string; w: number; h: number } | { ok: false; error: string } | { ok: false; cancelled: true };

export interface Defaults {
  content: string;
  options: Options;
}

export interface DeckApi {
  options(): Promise<OptionChoices>;
  defaults(): Promise<Defaults>;
  loadTextFile(): Promise<{ name: string; text: string } | null>;
  generate(request: GenerateRequest): Promise<GenerateResult>;
  renderSlides(deck: Deck): Promise<string[]>;
  pptxSummary(deck: Deck): Promise<PptxReport>;
  openPptx(): Promise<string | null>;
  exportDeck(format: ExportFormat, deck: Deck): Promise<ExportOutcome>;
  copyText(text: string): Promise<void>;
  projectOpen(file: string | null): Promise<ProjectOpenOutcome>;
  projectSave(file: string | null, deck: Deck): Promise<ProjectSaveOutcome>;
  projectSaveAs(file: string | null, deck: Deck): Promise<ProjectSaveOutcome>;
  assetAdd(): Promise<AssetAddOutcome>;
  recentList(): Promise<string[]>;
}
