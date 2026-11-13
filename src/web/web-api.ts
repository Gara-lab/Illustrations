import type { DeckApi } from "../app/shared/api-types.ts";
import { createDeckService } from "../app/shared/deck-service.ts";
import { createFixtureAssets } from "../model/fixtures/decks.ts";
import { createDomFilePorts } from "./web-files.ts";
import type { FilePorts } from "./web-files.ts";
import { createBrowserHost } from "./web-export-host.ts";
import { createWebExport } from "./web-export.ts";
import { createWebProject } from "./web-project.ts";

export function createWebApi(sampleContent: string, copy: (text: string) => Promise<void>, files: FilePorts = createDomFilePorts()): DeckApi {
  const project = createWebProject(files, createFixtureAssets());
  const service = createDeckService(project.assets);
  const exporter = createWebExport(() => project.assets, createBrowserHost());
  return {
    options: async () => service.choices(),
    defaults: async () => ({ content: sampleContent, options: service.defaultOptions() }),
    loadTextFile: () => project.loadTextFile(),
    generate: async (request) => {
      const made = service.generate(request);
      if (made.ok) project.reset();
      return made;
    },
    renderSlides: async (deck) => service.renderSlides(deck),
    ...exporter,
    copyText: copy,
    projectOpen: () => project.projectOpen(),
    projectSave: (file, deck) => project.projectSave(file, deck),
    projectSaveAs: (file, deck) => project.projectSave(file, deck),
    assetAdd: () => project.assetAdd(),
    recentList: async () => []
  };
}
