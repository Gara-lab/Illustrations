import { useEffect, useRef } from "react";
import type { Deck } from "../../model/deck.ts";
import type { PptxReport } from "../shared/api-types.ts";
import { deckJson, splitJsonAt } from "../shared/json-view.ts";

export type PptxState = { status: "idle" } | { status: "loading" } | { status: "done"; report: PptxReport };

export function JsonTab(props: { deck: Deck; selected: number; onCopy: (text: string) => void }) {
  const markRef = useRef<HTMLElement | null>(null);
  const parts = splitJsonAt(props.deck, props.selected);
  useEffect(() => {
    markRef.current?.scrollIntoView({ block: "start" });
  }, [props.selected, props.deck]);
  return (
    <>
      <div className="copy-bar">
        <button type="button" className="btn btn-small" onClick={() => props.onCopy(deckJson(props.deck))}>
          Copy deck.json
        </button>
      </div>
      <div className="scroll-area" data-testid="json-scroll">
        <pre className="code">
          {parts.before}
          <mark ref={markRef}>{parts.current}</mark>
          {parts.after}
        </pre>
      </div>
    </>
  );
}

export function PptxTab(props: { state: PptxState; selected: number; opened: string | null; onOpen: () => void }) {
  const { state } = props;
  if (state.status !== "done") return <div className="empty">{state.status === "loading" ? "Building the PPTX" : "Generate a deck to see its PPTX"}</div>;
  const report = state.report;
  if (!report.ok) return <div className="empty">PPTX export failed: {report.error}</div>;
  const { summary, warnings } = report;
  return (
    <div className="scroll-area report" data-testid="pptx-report">
      <div className="summary">
        <span>{summary.slides.length} slides</span>
        <span>{summary.imageCount} images</span>
        <span>Fonts: {summary.fonts.length > 0 ? summary.fonts.join(", ") : "none"}</span>
        <button type="button" className="btn btn-small" onClick={props.onOpen}>
          Download PPTX
        </button>
      </div>
      {props.opened ? <p role="status">{props.opened}</p> : null}
      <h3>Warnings from export</h3>
      {warnings.length > 0 ? (
        <ul>
          {warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      ) : (
        <p>None</p>
      )}
      <h3>Slides and elements</h3>
      {summary.slides.map((slide) => (
        <div key={slide.index} className="slide-block" aria-current={slide.index - 1 === props.selected}>
          <b>Slide {slide.index}</b> ({slide.elements.length} elements)
          <ul>
            {slide.elements.map((el, i) => (
              <li key={`${el.name}-${i}`}>
                <span className={`chip chip-${el.kind}`}>{el.kind}</span>
                {el.name}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
