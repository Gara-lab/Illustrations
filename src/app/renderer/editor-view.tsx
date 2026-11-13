import { useEffect, useRef, useState } from "react";
import type { CSSProperties, MouseEvent, PointerEvent } from "react";
import { HANDLES, elementBox, hitTest, minSizeFor, moveBox, resizeBox, sameBox } from "../../editor/edit.ts";
import type { Box, Handle } from "../../editor/edit.ts";
import type { Deck, TextEl } from "../../model/deck.ts";
import { MAX_TEXT_LENGTH, elementText, textOverflows } from "../../editor/text.ts";
import { fitScale } from "../shared/fit-scale.ts";
import { SlideView } from "./slide-view.tsx";

interface Drag {
  id: string;
  handle: Handle | null;
  clientX: number;
  clientY: number;
  x: number;
  y: number;
  box: Box;
  active: boolean;
  live: Box | null;
}

const DRAG_THRESHOLD_PX = 3;
const EDGE_HANDLE_MIN_PX = 36;

const HANDLE_POSITION: Record<Handle, CSSProperties> = {
  nw: { left: "0%", top: "0%", cursor: "nwse-resize" },
  n: { left: "50%", top: "0%", cursor: "ns-resize" },
  ne: { left: "100%", top: "0%", cursor: "nesw-resize" },
  e: { left: "100%", top: "50%", cursor: "ew-resize" },
  se: { left: "100%", top: "100%", cursor: "nwse-resize" },
  s: { left: "50%", top: "100%", cursor: "ns-resize" },
  sw: { left: "0%", top: "100%", cursor: "nesw-resize" },
  w: { left: "0%", top: "50%", cursor: "ew-resize" }
};

export interface EditCanvasProps {
  deck: Deck;
  slideIndex: number;
  html: string;
  box: { width: number; height: number };
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onCommit: (id: string, box: Box) => Promise<void>;
  onCommitText: (id: string, text: string) => Promise<void>;
  textRequest: string | null;
  onTextRequestHandled: () => void;
}

interface TextEdit {
  id: string;
  text: string;
  saving: boolean;
}

function isLight(color: string): boolean {
  const m = /^#([0-9a-f]{6})$/i.exec(color.trim());
  if (!m) return false;
  const n = parseInt(m[1] as string, 16);
  return ((n >> 16) & 255) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114 > 150;
}

const SANS_FALLBACK = "'Helvetica Neue', Arial, 'Segoe UI', sans-serif";
const SERIF_FALLBACK = "Georgia, 'Times New Roman', serif";
const MONO_FALLBACK = "ui-monospace, Consolas, monospace";

function editorFontStack(name: string): string {
  const clean = name.replace(/["';\{}]/g, "").trim();
  const fallback = /mono|code|courier/i.test(clean) ? MONO_FALLBACK : /playfair|lora|serif|georgia|times/i.test(clean) ? SERIF_FALLBACK : SANS_FALLBACK;
  return clean ? `'${clean}', ${fallback}` : fallback;
}

export function EditCanvas(props: EditCanvasProps) {
  const { deck, slideIndex, selectedId } = props;
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const [live, setLive] = useState<Box | null>(null);
  const [textEdit, setTextEdit] = useState<TextEdit | null>(null);
  const finishedRef = useRef(false);
  const areaRef = useRef<HTMLTextAreaElement | null>(null);
  const selectOnOpenRef = useRef(false);
  const fit = fitScale(props.box, deck.size);
  const slide = deck.slides[slideIndex];
  const selected = slide?.elements.find((e) => e.id === selectedId) ?? null;
  const shown = live ?? (selected ? elementBox(selected) : null);
  const hideHorizontal = shown !== null && shown.w * fit.scale < EDGE_HANDLE_MIN_PX;
  const hideVertical = shown !== null && shown.h * fit.scale < EDGE_HANDLE_MIN_PX;

  const editElement = textEdit ? slide?.elements.find((e) => e.id === textEdit.id) : undefined;
  const editing: TextEl | null = editElement && editElement.type === "text" ? editElement : null;

  const toSlide = (event: PointerEvent): { x: number; y: number } => {
    const rect = (overlayRef.current as HTMLDivElement).getBoundingClientRect();
    return { x: ((event.clientX - rect.left) * deck.size.w) / rect.width, y: ((event.clientY - rect.top) * deck.size.h) / rect.height };
  };

  useEffect(() => {
    finishedRef.current = true;
    setTextEdit(null);
  }, [slideIndex]);

  useEffect(() => {
    const id = props.textRequest;
    if (!id) return;
    props.onTextRequestHandled();
    const target = slide?.elements.find((e) => e.id === id);
    if (!target || target.type !== "text") return;
    dragRef.current = null;
    setLive(null);
    finishedRef.current = false;
    setTextEdit({ id, text: elementText(target), saving: false });
    selectOnOpenRef.current = true;
  }, [props.textRequest]);

  useEffect(() => {
    if (!selectOnOpenRef.current || !editing || !areaRef.current) return;
    selectOnOpenRef.current = false;
    areaRef.current.select();
  }, [textEdit, editing]);

  useEffect(() => {
    if (textEdit && !editing && !textEdit.saving) setTextEdit(null);
  }, [textEdit, editing]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!dragRef.current) return;
      event.stopImmediatePropagation();
      event.preventDefault();
      if (event.key !== "Escape") return;
      dragRef.current = null;
      setLive(null);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  const finishText = (commit: boolean) => {
    const current = textEdit;
    if (!current || current.saving || finishedRef.current || !editing) return;
    finishedRef.current = true;
    if (!commit || current.text === elementText(editing)) {
      setTextEdit(null);
      return;
    }
    setTextEdit({ ...current, saving: true });
    void props.onCommitText(current.id, current.text).finally(() => setTextEdit(null));
  };

  const onDoubleClick = (event: MouseEvent<HTMLDivElement>) => {
    if (textEdit || !slide || !overlayRef.current) return;
    const rect = overlayRef.current.getBoundingClientRect();
    const target = hitTest(slide, ((event.clientX - rect.left) * deck.size.w) / rect.width, ((event.clientY - rect.top) * deck.size.h) / rect.height);
    if (!target || target.type !== "text") return;
    dragRef.current = null;
    setLive(null);
    props.onSelect(target.id);
    finishedRef.current = false;
    setTextEdit({ id: target.id, text: elementText(target), saving: false });
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (textEdit) return;
    if (event.button !== 0 || !slide || !overlayRef.current) return;
    const point = toSlide(event);
    const handle = (event.target as HTMLElement).dataset.handle as Handle | undefined;
    let target = handle && selected ? selected : null;
    if (!target) target = hitTest(slide, point.x, point.y);
    if (!target) {
      props.onSelect(null);
      return;
    }
    props.onSelect(target.id);
    dragRef.current = { id: target.id, handle: target === selected && handle ? handle : null, clientX: event.clientX, clientY: event.clientY, x: point.x, y: point.y, box: elementBox(target), active: false, live: null };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    if (!drag.active) {
      if (Math.hypot(event.clientX - drag.clientX, event.clientY - drag.clientY) < DRAG_THRESHOLD_PX) return;
      drag.active = true;
    }
    const point = toSlide(event);
    const dx = Math.round(point.x - drag.x);
    const dy = Math.round(point.y - drag.y);
    drag.live = drag.handle ? resizeBox(drag.box, drag.handle, dx, dy, deck.size, minSizeFor(drag.box)) : moveBox(drag.box, dx, dy, deck.size);
    setLive(drag.live);
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    const result = drag?.live ?? null;
    if (!drag || !result || sameBox(result, drag.box)) {
      setLive(null);
      return;
    }
    void props.onCommit(drag.id, result).finally(() => setLive(null));
  };

  const onPointerCancel = () => {
    dragRef.current = null;
    setLive(null);
  };

  return (
    <div className="edit-wrap" style={{ width: fit.width, height: fit.height }}>
      <SlideView html={props.html} design={deck.size} box={props.box} label={`Slide ${slideIndex + 1}`} />
      <div
        ref={overlayRef}
        className="edit-overlay"
        data-testid="edit-overlay"
        onDoubleClick={onDoubleClick}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
      >
        {shown ? (
          <div
            className={editing ? "sel sel-editing" : "sel"}
            data-testid="selection"
            style={{ left: `${(shown.x / deck.size.w) * 100}%`, top: `${(shown.y / deck.size.h) * 100}%`, width: `${(shown.w / deck.size.w) * 100}%`, height: `${(shown.h / deck.size.h) * 100}%` }}
          >
            {editing && textEdit ? (
              <>
                <textarea
                  ref={areaRef}
                  autoFocus
                  className="sel-input"
                  data-testid="text-editor"
                  aria-label="Edit text"
                  value={textEdit.text}
                  readOnly={textEdit.saving}
                  maxLength={MAX_TEXT_LENGTH}
                  spellCheck={false}
                  style={{
                    fontFamily: editorFontStack(editing.fontFamily),
                    fontWeight: editing.paragraphs[0]?.runs[0]?.bold ? 700 : 400,
                    fontSize: editing.fontSize * fit.scale,
                    lineHeight: editing.lineHeight,
                    textAlign: editing.align,
                    color: editing.color,
                    background: isLight(editing.color) ? "#1b1b1b" : "#ffffff"
                  }}
                  onChange={(event) => setTextEdit({ ...textEdit, text: event.target.value })}
                  onBlur={() => finishText(true)}
                  onKeyDown={(event) => {
                    event.stopPropagation();
                    if (event.key === "Escape") {
                      event.preventDefault();
                      finishText(false);
                    } else if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
                      event.preventDefault();
                      finishText(true);
                    }
                  }}
                  onPointerDown={(event) => event.stopPropagation()}
                  onPointerMove={(event) => event.stopPropagation()}
                  onPointerUp={(event) => event.stopPropagation()}
                  onDoubleClick={(event) => event.stopPropagation()}
                />
                {textOverflows(textEdit.text, editing) ? <span className="sel-warn" role="status">Text may not fit this box</span> : null}
              </>
            ) : null}
            {editing ? null : HANDLES.filter((handle) => !(hideVertical && (handle === "n" || handle === "s")) && !(hideHorizontal && (handle === "e" || handle === "w"))).map((handle) => (
              <span key={handle} className="handle" data-handle={handle} style={HANDLE_POSITION[handle]} />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
