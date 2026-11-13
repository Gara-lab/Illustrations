import sampleContent from "../../scripts/sample-content.md";
import { createWebApi } from "./web-api.ts";

window.deckApi = createWebApi(sampleContent, (text) => navigator.clipboard.writeText(text));
