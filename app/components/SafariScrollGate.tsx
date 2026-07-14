"use client";

import { useLayoutEffect } from "react";

const GATE_ATTRIBUTE = "data-edge-scroll-gate";
const REQUIRED_STABLE_MS = 700;
const TAGLINE_ANIMATION_MS = 620;
const STANDALONE_LOGO_HOLD_MS = 1400;

declare global {
  interface Window {
    __edgeSafariGateRunning?: boolean;
  }
}

function restoreNativeScrollBehavior() {
  if ("scrollRestoration" in window.history) {
    window.history.scrollRestoration = "auto";
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

function pinStandaloneLogoToVisualViewport() {
  const viewport = window.visualViewport;

  const centerX = viewport
    ? viewport.offsetLeft + viewport.width / 2
    : window.innerWidth / 2;

  const centerY = viewport
    ? viewport.offsetTop + viewport.height / 2
    : window.innerHeight / 2;

  document.documentElement.style.setProperty(
    "--edge-standalone-logo-x",
    `${centerX}px`,
  );

  document.documentElement.style.setProperty(
    "--edge-standalone-logo-y",
    `${centerY}px`,
  );
}

export default function SafariScrollGate() {
  useLayoutEffect(() => {
    const root = document.documentElement;
    const initialMode = root.getAttribute(GATE_ATTRIBUTE);

    const shouldRun =
      initialMode === "browser" || initialMode === "standalone";

    /*
     * On reloads and every other normal navigation, do absolutely nothing.
     * This preserves Safari's native scroll position and restoration.
     */
    if (!shouldRun) return;
    if (window.__edgeSafariGateRunning) return;

    const standalone = initialMode === "standalone";

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
      restoreNativeScrollBehavior();

      root.removeAttribute(GATE_ATTRIBUTE);
      window.__edgeSafariGateRunning = false;
    };

    /*
     * This only executes when the early script has explicitly activated
     * the gate for a fresh Safari session.
     */
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }

    forceDocumentToTop();

    if (standalone) {
      pinStandaloneLogoToVisualViewport();
    }

    const startEnding = () => {
      if (cancelled || endingStarted) return;

      endingStarted = true;
      window.clearTimeout(safetyTimerId);
      forceDocumentToTop();

      if (standalone) {
        pinStandaloneLogoToVisualViewport();
        root.setAttribute(GATE_ATTRIBUTE, "standalone-visible");

        finishTimerId = window.setTimeout(() => {
          forceDocumentToTop();
          finish();
        }, STANDALONE_LOGO_HOLD_MS);

        return;
      }

      root.setAttribute(GATE_ATTRIBUTE, "browser-tagline");

      finishTimerId = window.setTimeout(() => {
        forceDocumentToTop();
        finish();
      }, TAGLINE_ANIMATION_MS);
    };

    const verify = (now: number) => {
      if (cancelled || endingStarted) return;

      forceDocumentToTop();

      if (standalone) {
        pinStandaloneLogoToVisualViewport();
      }

      const ready =
        document.readyState === "complete" &&
        document.visibilityState === "visible" &&
        documentIsAtTop();

      if (ready) {
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

      if (standalone) {
        pinStandaloneLogoToVisualViewport();
      }

      startEnding();
    }, 2500);

    return () => {
      cancelled = true;
      clearScheduledWork();
      restoreNativeScrollBehavior();
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