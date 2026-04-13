"use client";

import { useCallback, useRef, useState } from "react";

interface UseResizeHandleOptions {
  initialWidth: number;
  minWidth: number;
  maxWidth: number;
  /** "left" means dragging the left edge (panel is on the right), "right" means dragging the right edge */
  side: "left" | "right";
}

export function useResizeHandle({ initialWidth, minWidth, maxWidth, side }: UseResizeHandleOptions) {
  const [width, setWidth] = useState(initialWidth);
  const dragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      dragging.current = true;
      startX.current = e.clientX;
      startWidth.current = width;

      const onMouseMove = (ev: MouseEvent) => {
        if (!dragging.current) return;
        const dx = ev.clientX - startX.current;
        const newWidth = side === "right"
          ? startWidth.current + dx
          : startWidth.current - dx;
        setWidth(Math.min(maxWidth, Math.max(minWidth, newWidth)));
      };

      const onMouseUp = () => {
        dragging.current = false;
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [width, minWidth, maxWidth, side]
  );

  return { width, onMouseDown };
}
