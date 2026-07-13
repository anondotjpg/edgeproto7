"use client";

import { useLayoutEffect } from "react";

const GATE_ATTRIBUTE = "data-edge-scroll-gate";
const SESSION_KEY = "edge:safari-session-active";
const REQUIRED_STABLE_MS = 700;
const BROWSER_ZOOM_DURATION_MS = 460;
const STANDALONE_STATIC_HOLD_MS = 300;

declare global {
  interface Navigator {
    standalone?: boolean;
  }

  interface Window {
    __edgeSafariGateRunning?: boolean;
  }
}

function isStandaloneDisplayMode() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
}

function getNavigationType() {
  const entry = performance.getEntriesByType(
    "navigation",
  )[0] as PerformanceNavigationTiming | undefined;

  return entry?.type ?? null;
}

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

export default function SafariScrollGate() {
  useLayoutEffect(() => {
    const root = document.documentElement;
    const standalone = isStandaloneDisplayMode();
    const navigationType = getNavigationType();

    let hasExistingSession = false;

    try {
      hasExistingSession =
        window.sessionStorage.getItem(SESSION_KEY) === "true";

      window.sessionStorage.setItem(SESSION_KEY, "true");
    } catch {
      hasExistingSession = true;
    }

    const shouldRun =
      standalone ||
      (navigationType !== "reload" && !hasExistingSession);

    if (!shouldRun) {
      root.removeAttribute(GATE_ATTRIBUTE);
      return;
    }

    if (window.__edgeSafariGateRunning) return;
    window.__edgeSafariGateRunning = true;

    let cancelled = false;
    let animationFrameId = 0;
    let safetyTimerId = 0;
    let finishTimerId = 0;
    let stableSince: number | null = null;
    let endingStarted = false;

    const clearScheduledWork = () => {
      window.cancelAnimationFrame(animationFrameId);
      window.clearTimeout(safetyTimerId);
      window.clearTimeout(finishTimerId);
    };

    const finish = () => {
      if (cancelled) return;

      clearScheduledWork();
      forceDocumentToTop();
      root.removeAttribute(GATE_ATTRIBUTE);
      window.__edgeSafariGateRunning = false;
    };

    /*
     * Keep the two experiences completely separate.
     * Standalone never enters the browser zoom states.
     * Browser Safari never enters the standalone state.
     */
    root.setAttribute(
      GATE_ATTRIBUTE,
      standalone ? "standalone" : "browser",
    );

    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }

    forceDocumentToTop();

    const startEnding = () => {
      if (cancelled || endingStarted) return;
      endingStarted = true;

      window.clearTimeout(safetyTimerId);
      forceDocumentToTop();

      if (standalone) {
        /*
         * Home Screen app: logo remains completely static.
         */
        finishTimerId = window.setTimeout(() => {
          forceDocumentToTop();
          finish();
        }, STANDALONE_STATIC_HOLD_MS);

        return;
      }

      /*
       * Normal Safari: original direct scale animation.
       * No priming state, no opacity change, no shrink, and no visual-viewport
       * repositioning.
       */
      root.setAttribute(GATE_ATTRIBUTE, "browser-zooming");

      finishTimerId = window.setTimeout(() => {
        forceDocumentToTop();
        finish();
      }, BROWSER_ZOOM_DURATION_MS);
    };

    const verify = (now: number) => {
      if (cancelled || endingStarted) return;

      forceDocumentToTop();

      if (
        document.readyState === "complete" &&
        document.visibilityState === "visible" &&
        documentIsAtTop()
      ) {
        stableSince ??= now;

        if (now - stableSince >= REQUIRED_STABLE_MS) {
          startEnding();
          return;
        }
      } else {
        stableSince = null;
      }

      animationFrameId = window.requestAnimationFrame(verify);
    };

    animationFrameId = window.requestAnimationFrame(verify);

    safetyTimerId = window.setTimeout(() => {
      if (cancelled || endingStarted) return;

      forceDocumentToTop();
      startEnding();
    }, 2500);

    return () => {
      cancelled = true;
      clearScheduledWork();
      window.__edgeSafariGateRunning = false;

      if (!standalone || document.visibilityState === "visible") {
        root.removeAttribute(GATE_ATTRIBUTE);
      }
    };
  }, []);

  return (
    <div id="edge-scroll-gate-cover" aria-hidden="true">
      <img
        id="edge-scroll-gate-logo"
        src="/logo.png"
        alt=""
        draggable={false}
      />
    </div>
  );
}