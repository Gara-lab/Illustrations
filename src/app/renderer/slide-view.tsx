import { useLayoutEffect, useState } from "react";
import type { RefObject } from "react";
import { fitScale } from "../shared/fit-scale.ts";

export interface Size {
  w: number;
  h: number;
}

export function useBox(ref: RefObject<HTMLElement | null>): { width: number; height: number } {
  const [box, setBox] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setBox({ width: el.clientWidth, height: el.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return box;
}

export function SlideView(props: { html: string; design: Size; box: { width: number; height: number }; label: string }) {
  const fit = fitScale(props.box, props.design);
  return (
    <div className="slide-frame" data-testid="slide-frame" style={{ width: fit.width, height: fit.height }}>
      <iframe
        title={props.label}
        sandbox="allow-same-origin"
        onLoad={(e) => e.currentTarget.setAttribute("data-loaded", "1")}
        tabIndex={-1}
        srcDoc={props.html}
        style={{ width: props.design.w, height: props.design.h, transform: `scale(${fit.scale})` }}
      />
    </div>
  );
}
