import { useCallback, useEffect, useRef, useState } from "react";
import { setElementText } from "../../editor/text.ts";
import { changedTarget, setElementBox } from "../../editor/edit.ts";
import { addImageElement, addShapeElement, addTextElement, deleteElement } from "../../editor/add.ts";
import type { Added } from "../../editor/add.ts";
import { changedSlideIndex, deleteSlide, duplicateSlide, moveSlide, selectionAfterDelete } from "../../editor/slides.ts";
import type { Box } from "../../editor/edit.ts";
import { canRedo, canUndo, createHistory, isDirty, markSaved, pushHistory, rebase, redoHistory, undoHistory } from "../../editor/history.ts";
import type { History } from "../../editor/history.ts";
import type { ExportFormat } from "../../export/export-deck.ts";
import type { Options } from "../../input/types.ts";
import type { Deck } from "../../model/deck.ts";
import type { DeckApi } from "../shared/api-types.ts";
import { labelOf } from "../shared/option-labels.ts";
import type { OptionChoices } from "../shared/option-labels.ts";
import { DEFAULT_PANELS, togglePanel } from "../shared/panel-state.ts";
import type { PanelState, Side } from "../shared/panel-state.ts";
import { deckJson } from "../shared/json-view.ts";
import { EditCanvas } from "./editor-view.tsx";
import { briefPrompt } from "../../brief/prompt.ts";
import { NewDeckPanel, PropertiesPanel, ProjectBlock, ThumbStrip } from "./panels.tsx";
import { SlideView, useBox } from "./slide-view.tsx";
import { JsonTab, PptxTab } from "./tabs.tsx";
import type { PptxState } from "./tabs.tsx";

declare global {
  interface Window {
    deckApi: DeckApi;
    __bench: { state(): string; dirty(): boolean; layout(): unknown; locate(target: string): { x: number; y: number } | null };
  }
}

const api = (): DeckApi => window.deckApi;

const EXPORTS: { format: ExportFormat; label: string }[] = [
  { format: "html", label: "HTML" },
  { format: "pptx", label: "PPTX" },
  { format: "pdf", label: "PDF" },
  { format: "png", label: "PNG" },
  { format: "md", label: "Markdown" }
];

type TabId = "preview" | "edit" | "json" | "pptx";

const TAB_LABELS: { id: TabId; label: string }[] = [
  { id: "preview", label: "Preview" },
  { id: "edit", label: "Edit" },
  { id: "json", label: "deck.json" },
  { id: "pptx", label: "PPTX" }
];

const FALLBACK_OPTIONS: Options = {
  presentationType: "",
  objective: "",
  lengthSlides: 10,
  tone: "",
  animation: "",
  aspect: "16:9",
  mode: "deterministic",
  seed: null,
  context: "", slideNumber: false, footerText: ""
};

function rectOf(selector: string): { x: number; y: number; width: number; height: number; right: number; bottom: number } | null {
  const el = document.querySelector(selector);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom };
}

function inside(inner: ReturnType<typeof rectOf>, outer: ReturnType<typeof rectOf>): boolean {
  if (!inner || !outer) return false;
  const e = 0.5;
  return inner.x >= outer.x - e && inner.y >= outer.y - e && inner.right <= outer.right + e && inner.bottom <= outer.bottom + e;
}

function plainMessage(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error);
  return text.replace(/^Error invoking remote method '[^']*': (Error: )?/, "");
}

function center(el: Element | null | undefined): { x: number; y: number } | null {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

const HANDLE_ROOM = 12;
const CONFIRM_DISCARD = "You have unsaved changes that will be lost. Continue?";

export function App() {
  const [choices, setChoices] = useState<OptionChoices | null>(null);
  const [options, setOptions] = useState<Options>(FALLBACK_OPTIONS);
  const [seedText, setSeedText] = useState("");
  const [direction, setDirection] = useState("auto");
  const [content, setContent] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [hist, setHist] = useState<History | null>(null);
  const [selection, setSelection] = useState<{ slide: number; id: string } | null>(null);
  const [slides, setSlides] = useState<string[]>([]);
  const [selected, setSelected] = useState(0);
  const [tab, setTab] = useState<TabId>("preview");
  const [panels, setPanels] = useState<PanelState>(DEFAULT_PANELS);
  const [pptx, setPptx] = useState<PptxState>({ status: "idle" });
  const [opened, setOpened] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [projectFile, setProjectFile] = useState<string | null>(null);
  const [recent, setRecent] = useState<string[]>([]);
  const [textRequest, setTextRequest] = useState<string | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const box = useBox(stageRef);
  const deck = hist?.present ?? null;
  const dirty = hist !== null && isDirty(hist);
  const selectedId = selection && selection.slide === selected ? selection.id : null;
  const queue = useRef<Promise<void>>(Promise.resolve());
  const pending = useRef(0);
  const latest = useRef({ deck, selected, tab, panels, hist, selectedId });
  latest.current = { deck, selected, tab, panels, hist, selectedId };
  const adopt = useCallback((next: History) => {
    latest.current.hist = next;
    setHist(next);
  }, []);

  const generate = useCallback(async (text: string, opts: Options, seedValue: string, select: number | null, directionId?: string): Promise<Deck | null> => {
    const seed = seedValue.trim() === "" ? null : Number(seedValue.trim());
    setBusy(true);
    setErrors([]);
    try {
      const result = await api().generate({ content: text, options: { ...opts, seed }, direction: directionId });
      if (!result.ok) {
        setErrors(result.errors);
        return null;
      }
      const html = await api().renderSlides(result.deck);
      adopt(createHistory(result.deck));
      setSelection(null);
      setSlides(html);
      setPptx({ status: "idle" });
      setOpened(null);
      setStatus(null);
      setProjectFile(null);
      setSelected(select === null ? 0 : Math.min(Math.max(select - 1, 0), result.deck.slides.length - 1));
      return result.deck;
    } catch (error) {
      setErrors([error instanceof Error ? error.message : String(error)]);
      return null;
    } finally {
      setBusy(false);
    }
  }, [adopt]);

  const refreshRecent = useCallback(async () => {
    setRecent(await api().recentList());
  }, []);

  const edit = useCallback((change: (current: History) => History, follow: boolean, after?: () => void): Promise<void> => {
    const run = async () => {
      const current = latest.current.hist;
      if (!current) return;
      const next = change(current);
      if (next === current) return;
      try {
        const html = await api().renderSlides(next.present);
        const merged = latest.current.hist ? rebase(latest.current.hist, current, next) : null;
        if (!merged) {
          setStatus("Edit discarded because the project changed");
          return;
        }
        adopt(merged);
        setSlides(html);
        setPptx({ status: "idle" });
        setOpened(null);
        if (follow) {
          const slideIndex = changedSlideIndex(current.present, next.present);
          const target = slideIndex === null ? changedTarget(current.present, next.present) : null;
          if (slideIndex !== null) {
            setSelected(slideIndex);
            setSelection(null);
          } else if (target) {
            setSelected(target.slideIndex);
            setSelection({ slide: target.slideIndex, id: target.elementId });
          } else {
            setSelected((s) => Math.min(s, next.present.slides.length - 1));
          }
        }
        after?.();
      } catch (error) {
        setStatus(`Edit failed: ${plainMessage(error)}`);
      }
    };
    const task = queue.current.then(run);
    queue.current = task.catch(() => undefined);
    return task;
  }, [adopt]);

  const commitBox = useCallback(
    (id: string, box: Box) => edit((h) => pushHistory(h, setElementBox(h.present, latest.current.selected, id, box)), false),
    [edit]
  );
  const commitText = useCallback(
    (id: string, text: string): Promise<void> => {
      const current = latest.current.hist;
      const slideIndex = latest.current.selected;
      if (!current || setElementText(current.present, slideIndex, id, text) === current.present) return Promise.resolve();
      pending.current += 1;
      return edit((h) => pushHistory(h, setElementText(h.present, slideIndex, id, text)), false).finally(() => {
        pending.current -= 1;
      });
    },
    [edit]
  );
  const slideEdit = useCallback(
    (id: string, change: (deck: Deck, index: number) => Deck, nextSelected: (remaining: number, index: number) => number): Promise<void> => {
      const current = latest.current.hist;
      let at = -1;
      const apply = (deck: Deck): Deck => {
        at = deck.slides.findIndex((slide) => slide.id === id);
        return at < 0 ? deck : change(deck, at);
      };
      if (!current || apply(current.present) === current.present) return Promise.resolve();
      pending.current += 1;
      return edit(
        (h) => pushHistory(h, apply(h.present)),
        false,
        () => {
          setSelected(nextSelected(latest.current.hist?.present.slides.length ?? 1, at));
          setSelection(null);
        }
      ).finally(() => {
        pending.current -= 1;
      });
    },
    [edit]
  );
  const elementEdit = useCallback(
    (slideId: string | null, build: (deck: Deck, index: number) => Added | null, then: "select" | "text" | "clear"): Promise<boolean> => {
      const current = latest.current.hist;
      let at = -1;
      let id: string | null = null;
      let applied = false;
      const apply = (deck: Deck): Deck => {
        at = deck.slides.findIndex((slide) => slide.id === slideId);
        const result = at < 0 ? null : build(deck, at);
        id = result?.id ?? null;
        return result?.deck ?? deck;
      };
      if (!current || !slideId || apply(current.present) === current.present) return Promise.resolve(false);
      pending.current += 1;
      return edit(
        (h) => pushHistory(h, apply(h.present)),
        false,
        () => {
          applied = true;
          setSelected(at);
          setSelection(then === "clear" || !id ? null : { slide: at, id });
          if (then === "text" && id) setTextRequest(id);
        }
      )
        .then(() => applied)
        .finally(() => {
          pending.current -= 1;
        });
    },
    [edit]
  );
  const selectedSlideId = (): string | null => latest.current.hist?.present.slides[latest.current.selected]?.id ?? null;
  const slideActions = {
    onMoveUp: () => {
      const id = selectedSlideId();
      if (id) void slideEdit(id, (d, i) => moveSlide(d, i, i - 1), (_, i) => i - 1);
    },
    onMoveDown: () => {
      const id = selectedSlideId();
      if (id) void slideEdit(id, (d, i) => moveSlide(d, i, i + 1), (_, i) => i + 1);
    },
    onDuplicate: () => {
      const id = selectedSlideId();
      if (id) void slideEdit(id, (d, i) => duplicateSlide(d, i), (_, i) => i + 1);
    },
    onDelete: () => {
      const id = selectedSlideId();
      if (id) void slideEdit(id, (d, i) => deleteSlide(d, i), (remaining, i) => selectionAfterDelete(i, remaining));
    }
  };
  const addActions = {
    onAddImage: () => {
      const slideId = selectedSlideId();
      if (!slideId) return;
      void (async () => {
        setStatus("Adding image");
        try {
          const picked = await api().assetAdd();
          if ("cancelled" in picked) setStatus("Add image cancelled");
          else if (!picked.ok) setStatus(`Add image failed: ${picked.error}`);
          else if (await elementEdit(slideId, (d, i) => addImageElement(d, i, picked.id, { w: picked.w, h: picked.h }), "select")) setStatus(`Added image ${picked.id}`);
          else setStatus("The image could not be added to this slide");
        } catch (error) {
          setStatus(`Add image failed: ${plainMessage(error)}`);
        }
      })();
    },
    onAddText: () => void elementEdit(selectedSlideId(), (d, i) => addTextElement(d, i), "text"),
    onAddRectangle: () => void elementEdit(selectedSlideId(), (d, i) => addShapeElement(d, i, "rect"), "select"),
    onAddEllipse: () => void elementEdit(selectedSlideId(), (d, i) => addShapeElement(d, i, "ellipse"), "select"),
    onDelete: () => {
      const id = latest.current.selectedId;
      if (id) void elementEdit(selectedSlideId(), (d, i) => ({ deck: deleteElement(d, i, id), id }), "clear");
    }
  };
  const undo = useCallback(() => edit(undoHistory, true), [edit]);
  const redo = useCallback(() => edit(redoHistory, true), [edit]);
  const nudge = useCallback(
    (dx: number, dy: number) =>
      edit((h) => {
        const id = latest.current.selectedId;
        const current = id ? h.present.slides[latest.current.selected]?.elements.find((e) => e.id === id) : undefined;
        return current ? pushHistory(h, setElementBox(h.present, latest.current.selected, current.id, { x: current.x + dx, y: current.y + dy, w: current.w, h: current.h })) : h;
      }, false),
    [edit]
  );
  const actions = useRef({ undo, redo, nudge, remove: addActions.onDelete });
  actions.current = { undo, redo, nudge, remove: addActions.onDelete };

  const saveProject = useCallback(
    async (file: string | null, target: Deck | null, saveAs = false) => {
      if (!target) return false;
      setStatus("Saving project");
      try {
        const result = await (saveAs ? api().projectSaveAs(file, target) : api().projectSave(file, target));
        if ("cancelled" in result) setStatus("Save cancelled");
        else if (!result.ok) setStatus(`Save failed: ${result.error}`);
        else {
          setProjectFile(result.file);
          const known = latest.current.hist;
          if (known && [known.present, ...known.past, ...known.future].includes(target)) adopt(markSaved(known, target));
          setStatus(`Saved project to ${result.file}${result.warning ? `. ${result.warning}` : ""}`);
          await refreshRecent();
          return true;
        }
      } catch (error) {
        setStatus(`Save failed: ${error instanceof Error ? error.message : String(error)}`);
      }
      return false;
    },
    [adopt, refreshRecent]
  );

  const openProject = useCallback(
    async (file: string | null) => {
      setStatus("Opening project");
      try {
        const result = await api().projectOpen(file);
        if ("cancelled" in result) {
          setStatus("Open cancelled");
          return false;
        }
        if (!result.ok) {
          setStatus(`Open failed: ${result.error}`);
          return false;
        }
        const html = await api().renderSlides(result.deck);
        adopt(createHistory(result.deck));
        setSelection(null);
        setSlides(html);
        setSelected(0);
        setPptx({ status: "idle" });
        setOpened(null);
        setErrors([]);
        setProjectFile(result.file);
        setStatus(`Opened project ${result.file}${result.missingAssetIds.length > 0 ? ` (${result.missingAssetIds.length} images are missing from the file)` : ""}`);
        await refreshRecent();
        return true;
      } catch (error) {
        setStatus(`Open failed: ${error instanceof Error ? error.message : String(error)}`);
        return false;
      }
    },
    [adopt, refreshRecent]
  );

  useEffect(() => {
    void (async () => {
      const [ch, defaults] = await Promise.all([api().options(), api().defaults()]);
      setChoices(ch);
      setOptions(defaults.options);
      setContent(defaults.content);
      await refreshRecent();
    })();
  }, [refreshRecent]);

  useEffect(() => {
    if (tab !== "pptx" || !deck || pptx.status !== "idle") return;
    setPptx({ status: "loading" });
    void api()
      .pptxSummary(deck)
      .then((report) => setPptx({ status: "done", report }))
      .catch((error: unknown) => setPptx({ status: "done", report: { ok: false, error: error instanceof Error ? error.message : String(error) } }));
  }, [tab, deck, pptx.status]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName ?? "";
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      const count = latest.current.deck?.slides.length ?? 0;
      if (count === 0) return;
      if (latest.current.tab === "edit") {
        const key = event.key.toLowerCase();
        if ((event.ctrlKey || event.metaKey) && (key === "z" || key === "y")) {
          event.preventDefault();
          if (key === "y" || event.shiftKey) void actions.current.redo();
          else void actions.current.undo();
          return;
        }
        if (event.key === "Escape") {
          setSelection(null);
          return;
        }
        if (event.key === "Delete" && !document.querySelector(".sel-input")) {
          event.preventDefault();
          actions.current.remove();
          return;
        }
        const step = event.shiftKey ? 10 : 1;
        const arrow: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
        const move = arrow[event.key];
        if (move && latest.current.selectedId) {
          event.preventDefault();
          void actions.current.nudge(move[0], move[1]);
          return;
        }
      }
      if (event.key === "ArrowRight" || event.key === "ArrowDown") setSelected((s) => Math.min(s + 1, count - 1));
      else if (event.key === "ArrowLeft" || event.key === "ArrowUp") setSelected((s) => Math.max(s - 1, 0));
      else return;
      event.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    window.__bench = {
      dirty: () => pending.current > 0 || (latest.current.hist !== null && isDirty(latest.current.hist)),
      state: () => (latest.current.deck ? deckJson(latest.current.deck) : "null"),
      locate: (target) => {
        const at = target.indexOf(":");
        const kind = target.slice(0, at);
        const arg = target.slice(at + 1);
        if (kind === "slide") {
          const overlay = document.querySelector(".edit-overlay");
          const design = latest.current.deck?.size;
          if (!overlay || !design) return null;
          const r = overlay.getBoundingClientRect();
          const [x, y] = arg.split(",").map(Number) as [number, number];
          return { x: r.left + (x * r.width) / design.w, y: r.top + (y * r.height) / design.h };
        }
        if (kind === "handle") return center(document.querySelector(`[data-handle="${arg}"]`));
        if (kind === "button") return center(Array.from(document.querySelectorAll("button")).find((b) => b.textContent?.trim() === arg));
        if (kind === "field") {
          const label = Array.from(document.querySelectorAll("label")).find((l) => l.textContent?.trim() === arg);
          return center(label?.htmlFor ? document.getElementById(label.htmlFor) : null);
        }
        return null;
      },
      layout: () => {
        const stage = rectOf(".stage");
        const fit = rectOf(".stage-fit");
        const frame = rectOf(".stage .slide-frame");
        const canvas = rectOf(".canvas");
        const root = document.documentElement;
        return {
          window: { width: window.innerWidth, height: window.innerHeight },
          panels: latest.current.panels,
          tab: latest.current.tab,
          selected: latest.current.selected,
          canvas,
          stage,
          stageFit: fit,
          slideFrame: frame,
          leftPanel: rectOf(".panel-left"),
          rightPanel: rectOf(".panel-right"),
          slideFrameInsideStageFit: frame === null ? null : inside(frame, fit),
          stageFitInsideCanvas: inside(fit, canvas),
          canvasInsideWindow: inside(canvas, { x: 0, y: 0, width: window.innerWidth, height: window.innerHeight, right: window.innerWidth, bottom: window.innerHeight }),
          pageScroll: {
            documentScrollWidth: root.scrollWidth,
            documentClientWidth: root.clientWidth,
            documentScrollHeight: root.scrollHeight,
            documentClientHeight: root.clientHeight,
            bodyScrollWidth: document.body.scrollWidth,
            bodyScrollHeight: document.body.scrollHeight
          }
        };
      }
    };
  }, []);

  const select = (index: number) => setSelected(index);
  const editing = tab === "edit";
  const leftName = editing ? "Properties" : "New deck";
  const confirmDiscard = () => !(dirty || pending.current > 0) || window.confirm(CONFIRM_DISCARD);
  const projectProps = {
    file: projectFile,
    recent,
    canSave: deck !== null && !busy,
    busy,
    onOpen: () => confirmDiscard() && void openProject(null),
    onSave: () => void saveProject(projectFile, deck),
    onSaveAs: () => void saveProject(projectFile, deck, true),
    onOpenRecent: (file: string) => confirmDiscard() && void openProject(file)
  };
  const selectedElement = deck?.slides[selected]?.elements.find((e) => e.id === selectedId) ?? null;
  const toggle = (side: Side) => setPanels((p) => togglePanel(p, side));
  const count = deck?.slides.length ?? 0;
  const slide = deck?.slides[selected];

  const runExport = async (format: ExportFormat) => {
    if (!deck) return;
    setStatus(`Exporting ${format.toUpperCase()}`);
    try {
      const result = await api().exportDeck(format, deck);
      if ("cancelled" in result) setStatus("Export cancelled");
      else if (!result.ok) setStatus(`Export failed: ${result.error}`);
      else setStatus(format === "pdf" ? `Print dialog opened. ${result.warnings.join(" ")}` : `Saved ${format.toUpperCase()} to ${result.path}${result.warnings.length > 0 ? ` (${result.warnings.length} warnings)` : ""}`);
    } catch (error) {
      setStatus(`Export failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const columns = [panels.left ? "auto" : null, "minmax(0, 1fr)", panels.right ? "auto" : null].filter(Boolean).join(" ");

  return (
    <div className="app" style={{ gridTemplateColumns: columns }}>
      {panels.left ? (
        <section className="panel panel-left" aria-label={leftName}>
          <div className="panel-head">{leftName}</div>
          {editing ? (
            <PropertiesPanel project={projectProps} add={addActions} element={selectedElement} hasDeck={deck !== null} onApply={commitBox} />
          ) : (
          <NewDeckPanel
            project={projectProps}
            choices={choices}
            options={options}
            seedText={seedText}
            direction={direction}
            onDirection={setDirection}
            content={content}
            fileName={fileName}
            errors={errors}
            busy={busy}
            onOptions={(patch) => setOptions((o) => ({ ...o, ...patch }))}
            onSeedText={setSeedText}
            onContent={setContent}
            onLoadFile={() =>
              void api()
                .loadTextFile()
                .then((file) => {
                  if (file) {
                    setContent(file.text);
                    setFileName(file.name);
                  }
                })
            }
            onCopyPrompt={() => void api().copyText(briefPrompt(options))}
            onGenerate={() => confirmDiscard() && void generate(content, options, seedText, null, direction)}
          />
          )}
        </section>
      ) : null}

      <main className="canvas" aria-label="Canvas">
        <div className="canvas-head">
          <button
            type="button"
            className="btn btn-small"
            aria-pressed={panels.left}
            title={`${panels.left ? "Hide" : "Show"} the ${leftName.toLowerCase()} panel`}
            onClick={() => toggle("left")}
          >
            {panels.left ? "‹" : "›"} {leftName}
          </button>
          <div className="tabs" role="tablist">
            {TAB_LABELS.map((t) => (
              <button key={t.id} type="button" role="tab" className="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}>
                {t.label}
              </button>
            ))}
          </div>
          {editing ? (
            <div className="edit-actions">
              <button type="button" className="btn btn-small" disabled={!hist || !canUndo(hist)} title="Undo (Ctrl+Z)" onClick={() => void undo()}>
                Undo
              </button>
              <button type="button" className="btn btn-small" disabled={!hist || !canRedo(hist)} title="Redo (Ctrl+Y)" onClick={() => void redo()}>
                Redo
              </button>
            </div>
          ) : null}
          <button
            type="button"
            className="btn btn-small"
            aria-pressed={panels.right}
            title={panels.right ? "Hide the slides panel" : "Show the slides panel"}
            onClick={() => toggle("right")}
          >
            {panels.right ? "Slides ›" : "‹ Slides"}
          </button>
        </div>

        <div className="stage" ref={stageRef}>
          {!deck || !slide ? (
            <div className="empty">Generate a deck to see it here</div>
          ) : tab === "preview" ? (
            <div className="stage-fit">
              <SlideView html={slides[selected] ?? ""} design={deck.size} box={box.width > 28 ? { width: box.width - 28, height: box.height - 28 } : { width: 0, height: 0 }} label={`Slide ${selected + 1}`} />
            </div>
          ) : tab === "edit" ? (
            <div className="stage-fit">
              <EditCanvas
                deck={deck}
                slideIndex={selected}
                html={slides[selected] ?? ""}
                box={box.width > 28 + HANDLE_ROOM ? { width: box.width - 28 - HANDLE_ROOM, height: box.height - 28 - HANDLE_ROOM } : { width: 0, height: 0 }}
                selectedId={selectedId}
                onSelect={(id) => setSelection(id ? { slide: selected, id } : null)}
                onCommit={commitBox}
                onCommitText={commitText}
                textRequest={textRequest}
                onTextRequestHandled={() => setTextRequest(null)}
              />
            </div>
          ) : tab === "json" ? (
            <JsonTab deck={deck} selected={selected} onCopy={(text) => void api().copyText(text)} />
          ) : (
            <PptxTab
              state={pptx}
              selected={selected}
              opened={opened}
              onOpen={() => void api().openPptx().then((message) => setOpened(message ?? "Downloaded the PPTX"))}
            />
          )}
        </div>

        <div className="canvas-foot">
          <div className="notes" role="status">
            {deck && slide ? (
              <>
                <b>Slide {selected + 1} of {count}</b> · id {slide.id} · layout {slide.layoutId ? labelOf(slide.layoutId) : "none"} · theme {labelOf(deck.themeId)}
                {dirty ? <span className="dirty"> · Unsaved changes</span> : null}
              </>
            ) : (
              "No deck yet"
            )}
          </div>
          <div className="nav">
            <button type="button" className="btn btn-small" disabled={!deck || selected <= 0} onClick={() => select(selected - 1)}>
              ‹ Previous
            </button>
            <button type="button" className="btn btn-small" disabled={!deck || selected >= count - 1} onClick={() => select(selected + 1)}>
              Next ›
            </button>
          </div>
          <div className="exports" aria-label="Export">
            {EXPORTS.map((e) => (
              <button key={e.format} type="button" className="btn btn-small" disabled={!deck} onClick={() => void runExport(e.format)}>
                {e.label}
              </button>
            ))}
          </div>
          {status ? (
            <div className="status" role="status">
              {status}
            </div>
          ) : null}
        </div>
      </main>

      {panels.right ? (
        <section className="panel panel-right" aria-label="Slides">
          <div className="panel-head">Slides{deck ? ` (${count})` : ""}</div>
          <ThumbStrip deck={deck} slides={slides} selected={selected} onSelect={select} actions={slideActions} />
        </section>
      ) : null}
    </div>
  );
}
