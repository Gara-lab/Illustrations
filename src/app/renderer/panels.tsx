import { useEffect, useRef, useState } from "react";
import type { Options } from "../../input/types.ts";
import { elementBox } from "../../editor/edit.ts";
import type { Box } from "../../editor/edit.ts";
import type { Deck, Element } from "../../model/deck.ts";
import { DIRECTION_CHOICES } from "../../design/directions.ts";
import { MAX_FOOTER_TEXT } from "../../input/options.ts";
import { labelOf } from "../shared/option-labels.ts";
import type { Choice, OptionChoices } from "../shared/option-labels.ts";
import { SlideView, useBox } from "./slide-view.tsx";

const THUMB_HEIGHT = 170;
const THUMB_CHROME = 52;

const SWITCH_CHOICES: Choice[] = [
  { id: "off", label: "Off" },
  { id: "on", label: "On" }
];

function Select(props: { id: string; label: string; value: string; choices: Choice[]; onChange: (value: string) => void }) {
  return (
    <div className="field">
      <label htmlFor={props.id}>{props.label}</label>
      <select id={props.id} value={props.value} onChange={(e) => props.onChange(e.target.value)}>
        {props.choices.map((c) => (
          <option key={c.id} value={c.id}>
            {c.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export interface ProjectProps {
  file: string | null;
  recent: string[];
  canSave: boolean;
  busy: boolean;
  onOpen: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onOpenRecent: (file: string) => void;
}

function fileLabel(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).pop() ?? path;
}

export function ProjectBlock(props: ProjectProps) {
  return (
    <div className="field">
      <label htmlFor="recent">Project</label>
      <div className="exports">
        <button type="button" className="btn btn-small" disabled={props.busy} onClick={props.onOpen}>
          Open project
        </button>
        <button type="button" className="btn btn-small" disabled={!props.canSave} onClick={props.onSave}>
          Save project
        </button>
        <button type="button" className="btn btn-small" disabled={!props.canSave} onClick={props.onSaveAs}>
          Save as
        </button>
      </div>
      <span className="label" title={props.file ?? undefined}>
        {props.file ? `File: ${fileLabel(props.file)}` : "No project file yet"}
      </span>
      <select id="recent" value="" disabled={props.busy || props.recent.length === 0} onChange={(e) => e.target.value !== "" && props.onOpenRecent(e.target.value)}>
        <option value="">{props.recent.length === 0 ? "No recent projects" : "Recent projects"}</option>
        {props.recent.map((file) => (
          <option key={file} value={file} title={file}>
            {fileLabel(file)}
          </option>
        ))}
      </select>
    </div>
  );
}

export interface NewDeckProps {
  project: ProjectProps;
  choices: OptionChoices | null;
  options: Options;
  seedText: string;
  direction: string;
  content: string;
  fileName: string | null;
  errors: string[];
  busy: boolean;
  onOptions: (patch: Partial<Options>) => void;
  onSeedText: (text: string) => void;
  onDirection: (id: string) => void;
  onContent: (text: string) => void;
  onLoadFile: () => void;
  onCopyPrompt: () => void;
  onGenerate: () => void;
}

export function NewDeckPanel(props: NewDeckProps) {
  const { choices, options } = props;
  const [copied, setCopied] = useState(false);
  const errorsRef = useRef<HTMLUListElement | null>(null);
  useEffect(() => {
    errorsRef.current?.scrollIntoView({ block: "nearest" });
  }, [props.errors]);
  if (!choices) return <div className="panel-body">Loading options</div>;
  const objectives = choices.objectivesByType[options.presentationType] ?? [];
  return (
    <div className="panel-body">
      <ProjectBlock {...props.project} />
      <div className="field">
        <label htmlFor="content">Content</label>
        <textarea
          id="content"
          className="content"
          spellCheck={false}
          value={props.content}
          onChange={(e) => props.onContent(e.target.value)}
        />
        <span className="label">Paste text, Markdown or an AI brief (JSON).</span>
      </div>
      <div className="field">
        <button type="button" className="btn btn-small" onClick={props.onLoadFile}>
          Load .md or .txt file
        </button>
        <button
          type="button"
          className="btn btn-small"
          onClick={() => {
            props.onCopyPrompt();
            setCopied(true);
            window.setTimeout(() => setCopied(false), 2000);
          }}
        >
          {copied ? "Prompt copied" : "Copy prompt for your AI"}
        </button>
        {props.fileName ? <span className="label">Loaded: {props.fileName}</span> : null}
      </div>
      <div className="field">
        <Select id="direction" label="Design direction" value={props.direction} choices={DIRECTION_CHOICES} onChange={props.onDirection} />
        <span className="label">Automatic picks the look from the tone and the mood of the content.</span>
      </div>
      <Select
        id="type"
        label="Type"
        value={options.presentationType}
        choices={choices.presentationTypes}
        onChange={(value) => {
          const first = choices.objectivesByType[value]?.[0]?.id ?? "";
          props.onOptions({ presentationType: value, objective: first });
        }}
      />
      <Select id="objective" label="Objective" value={options.objective} choices={objectives} onChange={(value) => props.onOptions({ objective: value })} />
      <div className="grid2">
        <div className="field">
          <label htmlFor="length">Length (slides)</label>
          <input
            id="length"
            type="number"
            min={1}
            max={60}
            value={Number.isNaN(options.lengthSlides) ? "" : options.lengthSlides}
            onChange={(e) => props.onOptions({ lengthSlides: e.target.value === "" ? Number.NaN : Number(e.target.value) })}
          />
        </div>
        <Select id="tone" label="Tone" value={options.tone} choices={choices.tones} onChange={(value) => props.onOptions({ tone: value })} />
      </div>
      <div className="grid2">
        <Select id="animation" label="Animation" value={options.animation} choices={choices.animations} onChange={(value) => props.onOptions({ animation: value })} />
        <Select id="aspect" label="Aspect" value={options.aspect} choices={choices.aspects} onChange={(value) => props.onOptions({ aspect: value as Options["aspect"] })} />
      </div>
      <div className="grid2">
        <Select id="mode" label="Mode" value={options.mode} choices={choices.modes} onChange={(value) => props.onOptions({ mode: value as Options["mode"] })} />
        <div className="field">
          <label htmlFor="seed">Seed</label>
          <input id="seed" type="text" inputMode="numeric" placeholder="None" value={props.seedText} onChange={(e) => props.onSeedText(e.target.value)} />
        </div>
      </div>
      <div className="grid2">
        <Select
          id="slideNumber"
          label="Slide number"
          value={options.slideNumber ? "on" : "off"}
          choices={SWITCH_CHOICES}
          onChange={(value) => props.onOptions({ slideNumber: value === "on" })}
        />
        <div className="field">
          <label htmlFor="footerText">Footer text</label>
          <input id="footerText" type="text" maxLength={MAX_FOOTER_TEXT} placeholder="None" value={options.footerText} onChange={(e) => props.onOptions({ footerText: e.target.value })} />
        </div>
      </div>
      <div className="field">
        <label htmlFor="context">Context</label>
        <textarea id="context" value={options.context} onChange={(e) => props.onOptions({ context: e.target.value })} />
      </div>
      <button type="button" className="btn btn-cta" disabled={props.busy} onClick={props.onGenerate}>
        {props.busy ? "Generating" : "Generate deck"}
      </button>
      {props.errors.length > 0 ? (
        <ul className="errors" role="alert" ref={errorsRef}>
          {props.errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export interface SlideActions {
  onMoveUp(): void;
  onMoveDown(): void;
  onDuplicate(): void;
  onDelete(): void;
}

export function ThumbStrip(props: { deck: Deck | null; slides: string[]; selected: number; onSelect: (index: number) => void; actions?: SlideActions }) {
  const currentRef = useRef<HTMLButtonElement | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const body = useBox(bodyRef);
  const thumbBox = { width: Math.max(0, body.width - THUMB_CHROME), height: THUMB_HEIGHT };
  useEffect(() => {
    currentRef.current?.scrollIntoView({ block: "nearest" });
  }, [props.selected, props.slides]);
  if (!props.deck || props.slides.length === 0) return <div className="panel-body" ref={bodyRef}>No slides yet</div>;
  const deck = props.deck;
  return (
    <div className="panel-body" data-testid="thumbs" ref={bodyRef}>
      {deck.slides.map((slide, i) => {
        const current = i === props.selected;
        const layout = slide.layoutId ? labelOf(slide.layoutId) : "No layout";
        const last = deck.slides.length - 1;
        return (
          <div key={slide.id} className="thumb-item">
            <button
              ref={current ? currentRef : null}
              type="button"
              className="thumb"
              aria-current={current}
              title={`Slide ${i + 1}: ${layout}`}
              onClick={() => props.onSelect(i)}
            >
              <SlideView html={props.slides[i] ?? ""} design={deck.size} box={thumbBox} label={`Thumbnail of slide ${i + 1}`} />
              <span className="thumb-label">
                {i + 1} · {layout}
              </span>
            </button>
            {current && props.actions ? (
              <div className="thumb-actions">
                <button type="button" className="btn btn-small" disabled={i <= 0} onClick={props.actions.onMoveUp}>
                  Move up
                </button>
                <button type="button" className="btn btn-small" disabled={i >= last} onClick={props.actions.onMoveDown}>
                  Move down
                </button>
                <button type="button" className="btn btn-small" onClick={props.actions.onDuplicate}>
                  Duplicate slide
                </button>
                <button type="button" className="btn btn-small" disabled={last <= 0} onClick={props.actions.onDelete}>
                  Delete slide
                </button>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

const HINT = "Click an element on the slide to select it. Drag it to move it and drag a handle to resize it. Arrow keys nudge by 1 pixel, with Shift by 10.";

function BoxField(props: { id: string; label: string; value: number; onApply: (value: number) => Promise<void> }) {
  const [draft, setDraft] = useState(String(props.value));
  useEffect(() => setDraft(String(props.value)), [props.value]);
  const apply = () => {
    const n = Number(draft);
    if (draft.trim() === "" || !Number.isFinite(n)) {
      setDraft(String(props.value));
      return;
    }
    void props.onApply(Math.round(n)).finally(() => setDraft(String(props.value)));
  };
  return (
    <div className="field">
      <label htmlFor={props.id}>{props.label}</label>
      <input
        id={props.id}
        type="text"
        inputMode="numeric"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={apply}
        onKeyDown={(e) => e.key === "Enter" && apply()}
      />
    </div>
  );
}

export interface AddActions {
  onAddImage(): void;
  onAddText(): void;
  onAddRectangle(): void;
  onAddEllipse(): void;
  onDelete(): void;
}

function AddBlock(props: { actions: AddActions; hasDeck: boolean; hasSelection: boolean }) {
  const { actions, hasDeck } = props;
  return (
    <div className="field">
      <span className="label">Add to this slide</span>
      <div className="add-actions">
        <button type="button" className="btn btn-small" disabled={!hasDeck} onClick={actions.onAddImage}>
          Add image
        </button>
        <button type="button" className="btn btn-small" disabled={!hasDeck} onClick={actions.onAddText}>
          Add text box
        </button>
        <button type="button" className="btn btn-small" disabled={!hasDeck} onClick={actions.onAddRectangle}>
          Add rectangle
        </button>
        <button type="button" className="btn btn-small" disabled={!hasDeck} onClick={actions.onAddEllipse}>
          Add ellipse
        </button>
        <button type="button" className="btn btn-small" disabled={!props.hasSelection} onClick={actions.onDelete}>
          Delete element
        </button>
      </div>
    </div>
  );
}

export function PropertiesPanel(props: { project: ProjectProps; add: AddActions; element: Element | null; hasDeck: boolean; onApply: (id: string, box: Box) => Promise<void> }) {
  const el = props.element;
  const box = el ? elementBox(el) : null;
  return (
    <div className="panel-body">
      <ProjectBlock {...props.project} />
      <AddBlock actions={props.add} hasDeck={props.hasDeck} hasSelection={el !== null} />
      {el && box ? (
        <div key={el.id} data-testid="properties">
          <div className="grid2">
            <div className="field">
              <span className="label">Kind</span>
              <span>{labelOf(el.type)}</span>
            </div>
            <div className="field">
              <span className="label">Role</span>
              <span>{el.role ? labelOf(el.role) : "None"}</span>
            </div>
          </div>
          <div className="grid2">
            <BoxField id="prop-x" label="X" value={box.x} onApply={(x) => props.onApply(el.id, { ...box, x })} />
            <BoxField id="prop-y" label="Y" value={box.y} onApply={(y) => props.onApply(el.id, { ...box, y })} />
            <BoxField id="prop-w" label="Width" value={box.w} onApply={(w) => props.onApply(el.id, { ...box, w })} />
            <BoxField id="prop-h" label="Height" value={box.h} onApply={(h) => props.onApply(el.id, { ...box, h })} />
          </div>
        </div>
      ) : (
        <p className="hint">{props.hasDeck ? HINT : "Open the Preview tab to generate a deck or open a project, then come back to edit it."}</p>
      )}
    </div>
  );
}
