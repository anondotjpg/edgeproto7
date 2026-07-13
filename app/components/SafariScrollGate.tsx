"use client";

import { useLayoutEffect } from "react";

const GATE_ATTRIBUTE = "data-edge-scroll-gate";
const SESSION_KEY = "edge:safari-session-active";
const REQUIRED_STABLE_MS = 700;
const STANDALONE_LOGO_HOLD_MS = 300;
const BROWSER_LOGO_HOLD_MS = 300;
const LOGO_SHRINK_DURATION_MS = 180;
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

function pinLogoToVisualViewportCenter() {
  const viewport = window.visualViewport;
  const centerX = viewport
    ? viewport.offsetLeft + viewport.width / 2
    : window.innerWidth / 2;
  const centerY = viewport
    ? viewport.offsetTop + viewport.height / 2
    : window.innerHeight / 2;

  document.documentElement.style.setProperty(
    "--edge-gate-logo-x",
    `${centerX}px`,
  );
  document.documentElement.style.setProperty(
    "--edge-gate-logo-y",
    `${centerY}px`,
  );
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
    let stageTimerId = 0;
    let fallbackTimerId = 0;

    const clearScheduledWork = () => {
      window.cancelAnimationFrame(animationFrameId);
      window.clearTimeout(safetyTimerId);
      window.clearTimeout(stageTimerId);
      window.clearTimeout(fallbackTimerId);
    };

    const runGate = () => {
      if (disposed || gateRun.running) return;

      gateRun.running = true;
      gateRun.finished = false;
      gateRun.runId += 1;

      const activeRunId = gateRun.runId;
      let stableSince: number | null = null;
      let endingStarted = false;

      clearScheduledWork();

      if ("scrollRestoration" in window.history) {
        window.history.scrollRestoration = "manual";
      }

      pinLogoToVisualViewportCenter();
      root.setAttribute(
        GATE_ATTRIBUTE,
        standalone ? "standalone" : "locked",
      );
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
        endingStarted = false;

        clearScheduledWork();
        forceDocumentToTop();
        root.removeAttribute(GATE_ATTRIBUTE);
      };

      const startEnding = () => {
        if (
          disposed ||
          activeRunId !== gateRun.runId ||
          endingStarted ||
          gateRun.finished
        ) {
          return;
        }

        endingStarted = true;
        window.clearTimeout(safetyTimerId);

        forceDocumentToTop();
        pinLogoToVisualViewportCenter();

        if (standalone) {
          root.setAttribute(GATE_ATTRIBUTE, "standalone");

          stageTimerId = window.setTimeout(() => {
            forceDocumentToTop();
            finish();
          }, STANDALONE_LOGO_HOLD_MS);

          return;
        }

        /*
         * Normal Safari cold-open:
         * 1. Hold the logo still for 300ms.
         * 2. Shrink it slightly with a smooth ease.
         * 3. Expand it rapidly to fill the screen.
         */
        root.setAttribute(GATE_ATTRIBUTE, "primed");

        stageTimerId = window.setTimeout(() => {
          if (
            disposed ||
            activeRunId !== gateRun.runId ||
            gateRun.finished
          ) {
            return;
          }

          forceDocumentToTop();
          pinLogoToVisualViewportCenter();
          root.setAttribute(GATE_ATTRIBUTE, "shrinking");

          stageTimerId = window.setTimeout(() => {
            if (
              disposed ||
              activeRunId !== gateRun.runId ||
              gateRun.finished
            ) {
              return;
            }

            forceDocumentToTop();
            pinLogoToVisualViewportCenter();
            root.setAttribute(GATE_ATTRIBUTE, "zooming");
          }, LOGO_SHRINK_DURATION_MS);
        }, BROWSER_LOGO_HOLD_MS);

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

        fallbackTimerId = window.setTimeout(() => {
          logo?.removeEventListener("animationend", handleAnimationEnd);
          finish();
        }, BROWSER_LOGO_HOLD_MS + LOGO_SHRINK_DURATION_MS + LOGO_ZOOM_DURATION_MS + 220);
      };

      const verify = (now: number) => {
        if (
          disposed ||
          activeRunId !== gateRun.runId ||
          endingStarted ||
          gateRun.finished
        ) {
          return;
        }

        forceDocumentToTop();
        pinLogoToVisualViewportCenter();

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
        if (
          disposed ||
          activeRunId !== gateRun.runId ||
          endingStarted ||
          gateRun.finished
        ) {
          return;
        }

        forceDocumentToTop();
        startEnding();
      }, 2500);
    };

    const lockBeforeStandaloneSuspends = () => {
      if (!standalone || disposed) return;

      clearScheduledWork();
      gateRun.runId += 1;
      gateRun.running = false;
      gateRun.finished = false;

      pinLogoToVisualViewportCenter();
      root.setAttribute(GATE_ATTRIBUTE, "standalone");

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