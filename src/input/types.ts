import type { Aspect } from "../model/deck.ts";

export type ContentBlock =
  | { kind: "heading"; text: string; level: 1 | 2 | 3 }
  | { kind: "paragraph"; text: string }
  | { kind: "bullets"; items: string[] }
  | { kind: "image"; assetId: string; caption: string | null }
  | { kind: "quote"; text: string; by: string | null }
  | { kind: "number"; value: string; label: string };

export interface Options {
  presentationType: string;
  objective: string;
  lengthSlides: number;
  tone: string;
  animation: string;
  aspect: Aspect;
  mode: "deterministic" | "creative";
  seed: number | null;
  context: string;
  slideNumber: boolean;
  footerText: string;
}

export interface Source {
  blocks: ContentBlock[];
  options: Options;
}
