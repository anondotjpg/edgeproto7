"use client";

import { useLayoutEffect } from "react";

const GATE_ATTRIBUTE = "data-edge-scroll-gate";
const SESSION_KEY = "edge:safari-session-active";
const REQUIRED_STABLE_MS = 700;
const LOGO_ZOOM_DURATION_MS = 460;

declare global {
  interface Window {
    __edgeSafariGateRun?: {
      started: boolean;
      finished: boolean;
    };
  }
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

function getNavigationType() {
  const entry = performance.getEntriesByType(
    "navigation",
  )[0] as PerformanceNavigationTiming | undefined;

  return entry?.type ?? null;
}

export default function SafariScrollGate() {
  useLayoutEffect(() => {
    const root = document.documentElement;
    const logo = document.getElementById("edge-scroll-gate-logo");
    const navigationType = getNavigationType();

    let hasExistingSession = false;

    try {
      hasExistingSession =
        window.sessionStorage.getItem(SESSION_KEY) === "true";

      window.sessionStorage.setItem(SESSION_KEY, "true");
    } catch {
      hasExistingSession = true;
    }

    const shouldRunGate =
      navigationType !== "reload" && !hasExistingSession;

    if (!shouldRunGate) {
      root.removeAttribute(GATE_ATTRIBUTE);
      return;
    }

    /*
     * Prevent React Strict Mode, hydration remounts, or route remounts from
     * starting the same cold-open animation more than once in this document.
     */
    window.__edgeSafariGateRun ??= {
      started: false,
      finished: false,
    };

    const gateRun = window.__edgeSafariGateRun;

    if (gateRun.started || gateRun.finished) {
      if (gateRun.finished) {
        root.removeAttribute(GATE_ATTRIBUTE);
      }

      return;
    }

    gateRun.started = true;

    let cancelled = false;
    let animationFrameId = 0;
    let safetyTimerId = 0;
    let zoomFallbackTimerId = 0;
    let stableSince: number | null = null;
    let zoomStarted = false;

    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }

    root.setAttribute(GATE_ATTRIBUTE, "locked");
    forceDocumentToTop();

    const finish = () => {
      if (cancelled || gateRun.finished) return;

      gateRun.finished = true;
      zoomStarted = false;

      window.cancelAnimationFrame(animationFrameId);
      window.clearTimeout(safetyTimerId);
      window.clearTimeout(zoomFallbackTimerId);

      forceDocumentToTop();
      root.removeAttribute(GATE_ATTRIBUTE);
    };

    const startLogoZoom = () => {
      if (cancelled || zoomStarted || gateRun.finished) return;

      zoomStarted = true;
      window.clearTimeout(safetyTimerId);

      forceDocumentToTop();
      root.setAttribute(GATE_ATTRIBUTE, "zooming");

      const keepAtTop = () => {
        if (cancelled || !zoomStarted || gateRun.finished) return;

        forceDocumentToTop();
        animationFrameId = window.requestAnimationFrame(keepAtTop);
      };

      animationFrameId = window.requestAnimationFrame(keepAtTop);

      const handleAnimationEnd = (event: AnimationEvent) => {
        if (
          event.animationName !== "edgeGateLogoZoom" ||
          event.target !== logo
        ) {
          return;
        }

        logo?.removeEventListener("animationend", handleAnimationEnd);
        finish();
      };

      logo?.addEventListener("animationend", handleAnimationEnd);

      /*
       * Fallback only if Safari fails to dispatch animationend.
       * finish() is guarded, so it cannot reveal twice.
       */
      zoomFallbackTimerId = window.setTimeout(() => {
        logo?.removeEventListener("animationend", handleAnimationEnd);
        finish();
      }, LOGO_ZOOM_DURATION_MS + 120);
    };

    const verify = (now: number) => {
      if (cancelled || zoomStarted || gateRun.finished) return;

      forceDocumentToTop();

      if (
        document.readyState === "complete" &&
        document.visibilityState === "visible" &&
        documentIsAtTop()
      ) {
        stableSince ??= now;

        if (now - stableSince >= REQUIRED_STABLE_MS) {
          startLogoZoom();
          return;
        }
      } else {
        stableSince = null;
      }

      animationFrameId = window.requestAnimationFrame(verify);
    };

    animationFrameId = window.requestAnimationFrame(verify);

    safetyTimerId = window.setTimeout(() => {
      if (cancelled || zoomStarted || gateRun.finished) return;

      forceDocumentToTop();
      startLogoZoom();
    }, 2500);

    return () => {
      cancelled = true;

      window.cancelAnimationFrame(animationFrameId);
      window.clearTimeout(safetyTimerId);
      window.clearTimeout(zoomFallbackTimerId);

      /*
       * Do not reset gateRun.started here. React Strict Mode intentionally
       * mounts, cleans up, and mounts again in development. Keeping the global
       * flag prevents that second mount from replaying the animation.
       */
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