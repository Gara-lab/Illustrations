import { BRIEF_LIMITS as L } from "./brief.ts";
import type { Options } from "../input/types.ts";
import type { Brief } from "./brief.ts";
import { ICON_IDS } from "../catalog/icon-catalog.ts";

const EXAMPLE: Brief = {
  version: 1,
  title: "Solar for every roof",
  subtitle: "Investor update, autumn",
  audience: "Seed investors who know energy but not our product",
  purpose: "Win a follow-up meeting",
  mood: ["confident", "warm"],
  slides: [
    { intent: "statement", headline: "Rooftop solar is still too hard to buy", body: "Homeowners wait weeks for a quote and most never get one." },
    { intent: "number", headline: "The wait is the problem", number: { value: "21 days", label: "average time to get a first quote today" } },
    { intent: "points", headline: "We cut the quote to one afternoon", points: ["Satellite survey instead of a site visit", "Instant price from a live parts list", "One page the owner can sign"] },
    { intent: "steps", headline: "How a customer goes live", points: ["Enter the address", "Review the design", "Sign online", "Install in two days"] },
    { intent: "quote", headline: "What early customers say", quote: { text: "I had a price before my coffee went cold.", by: "Pilot customer" } },
    { intent: "image", headline: "A typical install", image: { file: "install-photo.jpg", caption: "Pilot install, 6 kilowatts" } },
    { intent: "closing", headline: "Let us book the next meeting" },
  ],
};

export type PromptOptions = Pick<Options, "presentationType" | "objective" | "lengthSlides" | "tone" | "context">;

function words(id: string): string {
  return id.replace(/-/g, " ");
}

function aboutDeck(o: PromptOptions): string[] {
  const lines = [
    "About this deck",
    `- Type: ${words(o.presentationType)}. Objective: ${words(o.objective)}. Write the purpose field to match the objective.`,
    `- Length: about ${o.lengthSlides} slides.`,
    `- Tone: ${o.tone}. Use it for the mood field.`
  ];
  if (o.context.trim() !== "") lines.push(`- Background from the user, use it to write the audience field: ${o.context.trim()}`);
  return [...lines, ""];
}

export function briefPrompt(options?: PromptOptions): string {
  return [
    "Write a presentation brief as one JSON object. Reply with the JSON only, with no text before or after it.",
    "",
    "Format",
    "The object has these fields. Use the field names exactly as written.",
    "- version: the number 1. Required.",
    `- title: the deck title, 1 to ${L.title} characters. Required.`,
    `- subtitle: at most ${L.subtitle} characters. Optional.`,
    `- audience: who will watch, at most ${L.audience} characters. Optional. Name the group in plain words, such as executives, customers, engineers or researchers: executives and the public get larger text, engineers and researchers denser text.`,
    `- purpose: what the deck must achieve, at most ${L.purpose} characters. Optional. Start with a verb such as persuade, decide, approve, teach or explain: persuading decks get stronger statement, number and closing slides, teaching decks calmer lists and steps.`,
    `- mood: a list of at most ${L.moodEntries} words, each 1 to ${L.moodEntry} characters. Optional.`,
    `- slides: a list of 1 to ${L.slides} slides. Required.`,
    "",
    "Each slide has an intent and a headline, plus the fields its intent needs.",
    `- intent: one of title, section, statement, points, steps, quote, number, image, chart, table, closing.`,
    `- headline: 1 to ${L.headline} characters. Required on every slide.`,
    `- emphasis: high, normal or low. Optional on every slide. High makes the headline of that slide larger, low smaller; use high on the one or two key slides.`,
    `- icon: an icon name for the graphic panel of that slide, or none to show no icon. Optional. Pick one only when it truly matches what the slide is about, the deck purpose and its mood; when unsure leave it out, because a matching icon is chosen automatically and a wrong one is worse than none. Names: ${ICON_IDS.join(", ")}.`,
    `- notes: speaker notes, at most ${L.notes} characters. Optional on every slide.`,
    "",
    "What each intent needs. Any other field is an error.",
    "- title: only the headline. The deck title already opens the deck, so a title slide is optional.",
    "- section: only the headline.",
    "- closing: only the headline.",
    `- statement: needs body, at most ${L.body} characters.`,
    `- points: needs points, a list of 1 to ${L.points} items of 1 to ${L.point} characters. It may also have a body, at most ${L.body} characters.`,
    "- steps: the same as points, but the items are in order.",
    `- quote: needs quote, an object with text of 1 to ${L.quoteText} characters and an optional by of at most ${L.quoteBy} characters.`,
    `- number: needs number, an object with value of 1 to ${L.numberValue} characters and label of 1 to ${L.numberLabel} characters.`,
    `- image: needs image, an object with either file (1 to ${L.imageFile} characters, the name of a picture the user will supply) and an optional caption of at most ${L.imageText} characters, or draw (a short description of a graphic to draw, at most ${L.imageText} characters).`,
    `- chart: needs chart, an object with kind (bar, line, pie or donut), series (a list of ${L.chartPointsMin} to ${L.chartPoints} items, each with a label of 1 to ${L.chartLabel} characters and a value that is a plain number of zero or more), an optional unit of at most ${L.chartUnit} characters (such as % or kWh) and an optional caption of at most ${L.chartCaption} characters. Use a chart only when the user asked for one.`,
    `- table: needs table, an object with columns (a list of ${L.tableColumnsMin} to ${L.tableColumns} short texts), rows (a list of 1 to ${L.tableRows} rows, each a list with exactly one text per column, each at most ${L.tableCell} characters) and an optional caption of at most ${L.chartCaption} characters. Use a table only when the user asked for one.`,
    "",
    "Example",
    JSON.stringify(EXAMPLE, null, 2),
    "",
    "Writing guidance",
    "- One idea per slide. If an idea does not fit the limits above, split it into two slides instead of writing long text.",
    "- Slide text is for the audience to take in at a glance. A body is one or two short sentences, about 25 words at most. A point is a short phrase of about 12 words at most. Do not write paragraphs on slides.",
    "- Put the explanation, nuance, evidence and sources in notes, which the presenter reads. Notes may be long.",
    "- Write headlines that make a claim, not labels such as Overview or Market.",
    "- A number slide shows the figure itself in value, such as 42%, 3x, 1990 or 21 days, never a sentence or a comparison in words. The label says what the figure means.",
    "- Vary the intents. Do not use the same intent many times in a row, and use statement slides sparingly: prefer points, steps, number, quote and image.",
    "- Do not put citations, links or Markdown (such as [name](address) or double asterisks) anywhere in the JSON, not even after a text. If you cite a source, write it in plain words inside the notes of that slide.",
    "- The reply must be strictly valid JSON: never put a double quote inside a text (use single quotes instead), no line breaks inside a text, no trailing commas, no comments, and no code fence around it.",
    "- Prefer concrete numbers over adjectives.",
    "- No filler slides, and no slide that only repeats the previous one.",
    "- A quote needs a real speaker or source in by, not a vague description.",
    "- The headline must match what the slide holds. A plural headline such as what customers say needs several slides of quotes, each from a different named person, so write it in the singular when you have only one quote. Never call a chart a table or a table a chart.",
    "- Use steps only for a real sequence and points for items of equal rank. Keep every list flat: never write a sub-item as its own item, fold the detail into its parent item instead.",
    "- Give every slide enough to show. A slide with one short line is only for title, section or closing slides, and those headlines should stay under about 6 words. Never put a section slide next to a title or another section slide.",
    "- A quote is a full sentence of about 8 words or more, and by holds a name with a role, such as Maria Costa, bakery owner.",
    "- If the user asks for a number of slides, follow it. If the source is long, follow its structure: chapters or parts become section slides, and each part gets only its strongest ideas.",
    "",
    ...(options === undefined ? [] : aboutDeck(options)),
  ].join("\n");
}
