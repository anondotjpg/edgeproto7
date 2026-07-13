"use client";

import { useLayoutEffect } from "react";

const GATE_ATTRIBUTE = "data-edge-scroll-gate";
const SESSION_KEY = "edge:safari-session-active";
const REQUIRED_STABLE_MS = 700;

function forceDocumentToTop() {
  window.scrollTo({
    top: 0,
    left: 0,
    behavior: "instant",
  });

  const scrollingElement =
    document.scrollingElement ?? document.documentElement;

  scrollingElement.scrollTop = 0;
  scrollingElement.scrollLeft = 0;

  document.documentElement.scrollTop = 0;
  document.documentElement.scrollLeft = 0;

  if (document.body) {
    document.body.scrollTop = 0;
    document.body.scrollLeft = 0;
  }
}

function documentIsAtTop() {
  const scrollingElement =
    document.scrollingElement ?? document.documentElement;

  return (
    Math.abs(window.scrollY) < 1 &&
    Math.abs(window.scrollX) < 1 &&
    Math.abs(scrollingElement.scrollTop) < 1 &&
    Math.abs(scrollingElement.scrollLeft) < 1 &&
    Math.abs(document.documentElement.scrollTop) < 1 &&
    Math.abs(document.body?.scrollTop ?? 0) < 1 &&
    Math.abs(window.visualViewport?.pageTop ?? 0) < 1
  );
}

function getNavigationType() {
  const entry = performance.getEntriesByType(
    "navigation",
  )[0] as PerformanceNavigationTiming | undefined;

  return entry?.type ?? null;
}

export default function SafariScrollGate() {
  useLayoutEffect(() => {
    const root = document.documentElement;
    const navigationType = getNavigationType();

    let hasExistingSession = false;

    try {
      hasExistingSession =
        window.sessionStorage.getItem(SESSION_KEY) === "true";

      window.sessionStorage.setItem(SESSION_KEY, "true");
    } catch {
      hasExistingSession = true;
    }

    /*
     * Never run the gate on a normal reload or an in-session navigation.
     * This preserves the exact layout and viewport behavior you already had.
     */
    const shouldRunGate =
      navigationType !== "reload" && !hasExistingSession;

    if (!shouldRunGate) {
      root.removeAttribute(GATE_ATTRIBUTE);
      return;
    }

    let cancelled = false;
    let animationFrameId = 0;
    let stableSince: number | null = null;

    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }

    root.setAttribute(GATE_ATTRIBUTE, "locked");
    forceDocumentToTop();

    const verify = (now: number) => {
      if (cancelled) return;

      forceDocumentToTop();

      if (
        document.readyState === "complete" &&
        document.visibilityState === "visible" &&
        documentIsAtTop()
      ) {
        stableSince ??= now;

        if (now - stableSince >= REQUIRED_STABLE_MS) {
          forceDocumentToTop();

          animationFrameId = window.requestAnimationFrame(() => {
            if (cancelled) return;

            forceDocumentToTop();
            root.removeAttribute(GATE_ATTRIBUTE);
          });

          return;
        }
      } else {
        stableSince = null;
      }

      animationFrameId = window.requestAnimationFrame(verify);
    };

    animationFrameId = window.requestAnimationFrame(verify);

    const safetyTimer = window.setTimeout(() => {
      if (cancelled) return;

      forceDocumentToTop();
      root.removeAttribute(GATE_ATTRIBUTE);
    }, 2500);

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(animationFrameId);
      window.clearTimeout(safetyTimer);
      root.removeAttribute(GATE_ATTRIBUTE);
    };
  }, []);

  return <div id="edge-scroll-gate-cover" aria-hidden="true" />;
}