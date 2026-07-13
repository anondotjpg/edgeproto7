"use client";

import { useLayoutEffect } from "react";

const GATE_ATTRIBUTE = "data-edge-scroll-gate";
const SESSION_KEY = "edge:safari-session-active";
const REQUIRED_STABLE_MS = 700;
const LOGO_ZOOM_DURATION_MS = 460;

type GateRunState = {
  running: boolean;
  finished: boolean;
  runId: number;
};

declare global {
  interface Navigator {
    standalone?: boolean;
  }

  interface Window {
    __edgeSafariGateRun?: GateRunState;
  }
}

function isStandaloneDisplayMode() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
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

    const shouldRunOnMount =
      standalone ||
      (navigationType !== "reload" && !hasExistingSession);

    window.__edgeSafariGateRun ??= {
      running: false,
      finished: false,
      runId: 0,
    };

    const gateRun = window.__edgeSafariGateRun;

    let disposed = false;
    let animationFrameId = 0;
    let safetyTimerId = 0;
    let zoomFallbackTimerId = 0;

    const clearScheduledWork = () => {
      window.cancelAnimationFrame(animationFrameId);
      window.clearTimeout(safetyTimerId);
      window.clearTimeout(zoomFallbackTimerId);
    };

    const runGate = () => {
      if (disposed || gateRun.running) return;

      gateRun.running = true;
      gateRun.finished = false;
      gateRun.runId += 1;

      const activeRunId = gateRun.runId;
      let stableSince: number | null = null;
      let zoomStarted = false;

      clearScheduledWork();

      if ("scrollRestoration" in window.history) {
        window.history.scrollRestoration = "manual";
      }

      root.setAttribute(GATE_ATTRIBUTE, "locked");
      forceDocumentToTop();

      const finish = () => {
        if (
          disposed ||
          activeRunId !== gateRun.runId ||
          gateRun.finished
        ) {
          return;
        }

        gateRun.finished = true;
        gateRun.running = false;
        zoomStarted = false;

        clearScheduledWork();
        forceDocumentToTop();
        root.removeAttribute(GATE_ATTRIBUTE);
      };

      const startLogoZoom = () => {
        if (
          disposed ||
          activeRunId !== gateRun.runId ||
          zoomStarted ||
          gateRun.finished
        ) {
          return;
        }

        zoomStarted = true;
        window.clearTimeout(safetyTimerId);

        forceDocumentToTop();
        root.setAttribute(GATE_ATTRIBUTE, "zooming");

        const keepAtTop = () => {
          if (
            disposed ||
            activeRunId !== gateRun.runId ||
            !zoomStarted ||
            gateRun.finished
          ) {
            return;
          }

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

        zoomFallbackTimerId = window.setTimeout(() => {
          logo?.removeEventListener("animationend", handleAnimationEnd);
          finish();
        }, LOGO_ZOOM_DURATION_MS + 120);
      };

      const verify = (now: number) => {
        if (
          disposed ||
          activeRunId !== gateRun.runId ||
          zoomStarted ||
          gateRun.finished
        ) {
          return;
        }

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
        if (
          disposed ||
          activeRunId !== gateRun.runId ||
          zoomStarted ||
          gateRun.finished
        ) {
          return;
        }

        forceDocumentToTop();
        startLogoZoom();
      }, 2500);
    };

    const lockBeforeStandaloneSuspends = () => {
      if (!standalone || disposed) return;

      clearScheduledWork();
      gateRun.runId += 1;
      gateRun.running = false;
      gateRun.finished = false;

      root.setAttribute(GATE_ATTRIBUTE, "locked");

      if ("scrollRestoration" in window.history) {
        window.history.scrollRestoration = "manual";
      }

      forceDocumentToTop();
    };

    const handleVisibilityChange = () => {
      if (!standalone) return;

      if (document.visibilityState === "hidden") {
        lockBeforeStandaloneSuspends();
        return;
      }

      runGate();
    };

    const handlePageHide = () => {
      lockBeforeStandaloneSuspends();
    };

    const handlePageShow = () => {
      if (standalone) {
        runGate();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("pageshow", handlePageShow);

    if (shouldRunOnMount) {
      runGate();
    } else {
      root.removeAttribute(GATE_ATTRIBUTE);
    }

    return () => {
      disposed = true;
      clearScheduledWork();

      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange,
      );
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("pageshow", handlePageShow);

      /*
       * Do not forcibly remove the lock while a standalone app is being
       * suspended. iOS may reuse the frozen DOM on the next launch.
       */
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