import type { DeckApi } from "../app/shared/api-types.ts";
import { PPTX_MIME, exportBaseName, exportDeck } from "../export/export-deck.ts";
import type { RenderHost } from "../export/export-deck.ts";
import { buildPptx } from "../export/pptx.ts";
import { summarisePptx } from "../export/pptx-summary.ts";
import { validateDeck } from "../model/deck.ts";
import type { AssetStore } from "../model/deck.ts";

export function createWebExport(getAssets: () => AssetStore, host: RenderHost): Pick<DeckApi, "exportDeck" | "pptxSummary" | "openPptx"> {
  let last: { name: string; data: Uint8Array } | null = null;
  return {
    exportDeck: async (format, deck) => exportDeck(deck, format, getAssets(), host),
    async pptxSummary(deck) {
      try {
        const valid = validateDeck(deck);
        if (!valid.ok) return { ok: false, error: valid.errors.join("; ") };
        const built = await buildPptx(valid.deck, getAssets());
        const name = `${exportBaseName(valid.deck)}.pptx`;
        last = { name, data: built.data };
        return { ok: true, summary: await summarisePptx(built.data), warnings: built.warnings, path: name };
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : String(error) };
      }
    },
    async openPptx() {
      if (!last) return "Build the PPTX first";
      try {
        host.download(last.name, last.data, PPTX_MIME);
        return `Downloaded ${last.name}. Open it in PowerPoint.`;
      } catch (error) {
        return `Download failed: ${error instanceof Error ? error.message : String(error)}`;
      }
    }
  };
}
