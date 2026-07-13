"use client";

import { useLayoutEffect } from "react";

const GATE_ATTRIBUTE = "data-edge-scroll-gate";
const REQUIRED_STABLE_MS = 700;
const TAGLINE_ANIMATION_MS = 620;
const STANDALONE_STATIC_HOLD_MS = 300;

declare global {
  interface Window {
    __edgeSafariGateRunning?: boolean;
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

export default function SafariScrollGate() {
  useLayoutEffect(() => {
    const root = document.documentElement;

    /*
     * The inline head script decides the launch mode before first paint:
     * - "browser" for a fresh Safari session
     * - "standalone" for the Home Screen app
     * - no attribute for ordinary reloads/navigation
     */
    const initialMode = root.getAttribute(GATE_ATTRIBUTE);
    const shouldRun =
      initialMode === "browser" || initialMode === "standalone";
    const standalone = initialMode === "standalone";

    if (!shouldRun) return;
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
         * Home Screen app remains unchanged: static centered logo only.
         */
        finishTimerId = window.setTimeout(() => {
          forceDocumentToTop();
          finish();
        }, STANDALONE_STATIC_HOLD_MS);

        return;
      }

      /*
       * Fresh Safari:
       * expand the centered lockup so the logo glides left while the
       * tagline enters smoothly from its right.
       */
      root.setAttribute(GATE_ATTRIBUTE, "browser-tagline");

      finishTimerId = window.setTimeout(() => {
        forceDocumentToTop();
        finish();
      }, TAGLINE_ANIMATION_MS);
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
    };
  }, []);

  return (
    <div id="edge-scroll-gate-cover" aria-hidden="true">
      <div id="edge-scroll-gate-lockup">
        <img
          id="edge-scroll-gate-logo"
          src="/logo.png"
          alt=""
          draggable={false}
        />

        <div id="edge-scroll-gate-tagline-clip">
          <span id="edge-scroll-gate-tagline">Beat the Odds.</span>
        </div>
      </div>
    </div>
  );
}