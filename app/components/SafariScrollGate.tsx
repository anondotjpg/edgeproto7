"use client";

import { useLayoutEffect } from "react";

const GATE_ATTRIBUTE = "data-edge-scroll-gate";
const SESSION_KEY = "edge:safari-session-active";
const REQUIRED_STABLE_MS = 700;
const LOGO_ZOOM_DURATION_MS = 460;
const STANDALONE_LOGO_HOLD_MS = 300;

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

    /*
     * Home Screen always uses the gate because iOS can restore a frozen
     * standalone document at an old scroll position.
     *
     * Normal Safari only uses it for a genuinely new browser session.
     */
    const shouldRunGate =
      standalone ||
      (navigationType !== "reload" && !hasExistingSession);

    if (!shouldRunGate) {
      root.removeAttribute(GATE_ATTRIBUTE);
      return;
    }

    window.__edgeSafariGateRun ??= {
      running: false,
      finished: false,
      runId: 0,
    };

    const gateRun = window.__edgeSafariGateRun;

    if (gateRun.running) return;

    gateRun.running = true;
    gateRun.finished = false;
    gateRun.runId += 1;

    const activeRunId = gateRun.runId;

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

    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }

    root.setAttribute(
      GATE_ATTRIBUTE,
      standalone ? "standalone" : "locked",
    );
    forceDocumentToTop();

    const finish = () => {
      if (
        cancelled ||
        activeRunId !== gateRun.runId ||
        gateRun.finished
      ) {
        return;
      }

      gateRun.finished = true;
      gateRun.running = false;

      clearScheduledWork();
      forceDocumentToTop();
      root.removeAttribute(GATE_ATTRIBUTE);
    };

    const startEnding = () => {
      if (
        cancelled ||
        activeRunId !== gateRun.runId ||
        endingStarted ||
        gateRun.finished
      ) {
        return;
      }

      endingStarted = true;
      window.clearTimeout(safetyTimerId);
      forceDocumentToTop();

      /*
       * Home Screen: keep the logo completely static for 300ms,
       * then reveal the app. No transform, transition, or animation.
       */
      if (standalone) {
        root.setAttribute(GATE_ATTRIBUTE, "standalone");

        finishTimerId = window.setTimeout(() => {
          forceDocumentToTop();
          finish();
        }, STANDALONE_LOGO_HOLD_MS);

        return;
      }

      /*
       * Normal Safari: this is the original working animation exactly:
       * scale 1 directly to scale 32 over 460ms.
       */
      root.setAttribute(GATE_ATTRIBUTE, "zooming");

      const keepAtTop = () => {
        if (
          cancelled ||
          activeRunId !== gateRun.runId ||
          gateRun.finished
        ) {
          return;
        }

        forceDocumentToTop();
        animationFrameId = window.requestAnimationFrame(keepAtTop);
      };

      animationFrameId = window.requestAnimationFrame(keepAtTop);

      finishTimerId = window.setTimeout(() => {
        forceDocumentToTop();
        finish();
      }, LOGO_ZOOM_DURATION_MS);
    };

    const verify = (now: number) => {
      if (
        cancelled ||
        activeRunId !== gateRun.runId ||
        endingStarted ||
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
        cancelled ||
        activeRunId !== gateRun.runId ||
        endingStarted ||
        gateRun.finished
      ) {
        return;
      }

      forceDocumentToTop();
      startEnding();
    }, 2500);

    const handleVisibilityChange = () => {
      if (!standalone) return;

      if (document.visibilityState === "hidden") {
        clearScheduledWork();
        gateRun.runId += 1;
        gateRun.running = false;
        gateRun.finished = false;

        root.setAttribute(GATE_ATTRIBUTE, "standalone");
        forceDocumentToTop();
      }
    };

    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange,
    );

    return () => {
      cancelled = true;
      clearScheduledWork();

      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange,
      );

      /*
       * Keep the standalone cover in place if iOS is suspending the app.
       * Otherwise clean it up normally.
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