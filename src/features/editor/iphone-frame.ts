"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Orientation } from "@/types/project";

export const IPHONE_16_VIEWPORT = { w: 393, h: 852 } as const;
export const IPHONE_BEZEL_PX = 10;

export function iphoneLogicalSize(orientation: Orientation) {
  return orientation === "portrait"
    ? { w: IPHONE_16_VIEWPORT.w, h: IPHONE_16_VIEWPORT.h }
    : { w: IPHONE_16_VIEWPORT.h, h: IPHONE_16_VIEWPORT.w };
}

export function iphoneOuterSize(logical: { w: number; h: number }) {
  return {
    w: logical.w + IPHONE_BEZEL_PX * 2,
    h: logical.h + IPHONE_BEZEL_PX * 2,
  };
}

export function iphoneFitScale(
  availW: number,
  availH: number,
  outer: { w: number; h: number },
) {
  if (availW <= 0 || availH <= 0 || outer.w <= 0 || outer.h <= 0) return 1;
  const scale = Math.min(availW / outer.w, availH / outer.h);
  return Number.isFinite(scale) && scale > 0 ? scale : 1;
}

function contentBoxSize(el: HTMLElement) {
  const cs = getComputedStyle(el);
  const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
  const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
  return {
    w: el.clientWidth - (Number.isFinite(padX) ? padX : 0),
    h: el.clientHeight - (Number.isFinite(padY) ? padY : 0),
  };
}

export function useFittedIphoneFrame(orientation: Orientation, active = true) {
  const [node, setNode] = useState<HTMLDivElement | null>(null);
  const logical = useMemo(() => iphoneLogicalSize(orientation), [orientation]);
  const outer = useMemo(() => iphoneOuterSize(logical), [logical]);
  const [scale, setScale] = useState(1);
  const [fitted, setFitted] = useState(false);
  const containerRef = useCallback((el: HTMLDivElement | null) => {
    setNode(el);
  }, []);

  useEffect(() => {
    if (!active || !node) {
      setFitted(false);
      return;
    }

    let raf = 0;
    const measure = () => {
      const { w, h } = contentBoxSize(node);
      if (w <= 0 || h <= 0) return false;
      setScale(iphoneFitScale(Math.max(0, w - 4), Math.max(0, h - 4), outer));
      setFitted(true);
      return true;
    };

    const waitForLayout = () => {
      if (!measure()) raf = requestAnimationFrame(waitForLayout);
    };
    waitForLayout();

    const ro = new ResizeObserver(() => {
      measure();
    });
    ro.observe(node);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [node, outer, active]);

  return { containerRef, logical, outer, scale, fitted };
}
