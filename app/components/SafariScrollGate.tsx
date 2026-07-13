"use client";

import { useLayoutEffect } from "react";

const GATE_ATTRIBUTE = "data-edge-scroll-gate";
const LOCKED_VALUE = "locked";
const REQUIRED_STABLE_MS = 900;
const MINIMUM_LOCK_MS = 450;

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

  const visualPageTop = window.visualViewport?.pageTop ?? 0;
  const visualPageLeft = window.visualViewport?.pageLeft ?? 0;

  return (
    Math.abs(window.scrollY) < 1 &&
    Math.abs(window.scrollX) < 1 &&
    Math.abs(scrollingElement.scrollTop) < 1 &&
    Math.abs(scrollingElement.scrollLeft) < 1 &&
    Math.abs(document.documentElement.scrollTop) < 1 &&
    Math.abs(document.documentElement.scrollLeft) < 1 &&
    Math.abs(document.body?.scrollTop ?? 0) < 1 &&
    Math.abs(document.body?.scrollLeft ?? 0) < 1 &&
    Math.abs(visualPageTop) < 1 &&
    Math.abs(visualPageLeft) < 1
  );
}

export default function SafariScrollGate() {
  useLayoutEffect(() => {
    const root = document.documentElement;

    let disposed = false;
    let animationFrameId = 0;
    let runId = 0;

    const lock = () => {
      root.setAttribute(GATE_ATTRIBUTE, LOCKED_VALUE);
    };

    const unlock = () => {
      root.removeAttribute(GATE_ATTRIBUTE);
    };

    const cancelCurrentRun = () => {
      runId += 1;

      if (animationFrameId) {
        window.cancelAnimationFrame(animationFrameId);
        animationFrameId = 0;
      }
    };

    const startTopVerification = () => {
      cancelCurrentRun();

      const currentRunId = runId;
      const startedAt = performance.now();
      let stableSince: number | null = null;

      lock();

      if ("scrollRestoration" in window.history) {
        window.history.scrollRestoration = "manual";
      }

      forceDocumentToTop();

      const verify = (now: number) => {
        if (disposed || currentRunId !== runId) return;

        forceDocumentToTop();

        const pageCanBeShown =
          document.visibilityState === "visible" &&
          document.readyState === "complete";

        if (pageCanBeShown && documentIsAtTop()) {
          if (stableSince === null) {
            stableSince = now;
          }

          const minimumLockFinished =
            now - startedAt >= MINIMUM_LOCK_MS;
          const stayedAtTopLongEnough =
            now - stableSince >= REQUIRED_STABLE_MS;

          if (minimumLockFinished && stayedAtTopLongEnough) {
            forceDocumentToTop();

            animationFrameId = window.requestAnimationFrame(() => {
              if (disposed || currentRunId !== runId) return;

              forceDocumentToTop();

              animationFrameId = window.requestAnimationFrame(() => {
                if (disposed || currentRunId !== runId) return;

                forceDocumentToTop();

                if (documentIsAtTop()) {
                  unlock();
                  animationFrameId = 0;
                  return;
                }

                stableSince = null;
                animationFrameId = window.requestAnimationFrame(verify);
              });
            });

            return;
          }
        } else {
          stableSince = null;
        }

        animationFrameId = window.requestAnimationFrame(verify);
      };

      animationFrameId = window.requestAnimationFrame(verify);
    };

    const prepareForSuspension = () => {
      cancelCurrentRun();
      lock();

      if ("scrollRestoration" in window.history) {
        window.history.scrollRestoration = "manual";
      }

      forceDocumentToTop();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        /*
         * Safari can restore the complete frozen DOM after the app is
         * relaunched. Lock the persistent cover before that snapshot is made.
         */
        prepareForSuspension();
        return;
      }

      startTopVerification();
    };

    const handlePageHide = () => {
      prepareForSuspension();
    };

    const handlePageShow = () => {
      /*
       * pageshow also runs when iOS restores a frozen page or bfcache entry.
       * Re-run the gate even when React itself was never remounted.
       */
      startTopVerification();
    };

    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("pageshow", handlePageShow);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    window.visualViewport?.addEventListener(
      "scroll",
      forceDocumentToTop,
      { passive: true },
    );

    startTopVerification();

    return () => {
      disposed = true;
      cancelCurrentRun();

      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("pageshow", handlePageShow);
      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange,
      );

      window.visualViewport?.removeEventListener(
        "scroll",
        forceDocumentToTop,
      );

      unlock();
    };
  }, []);

  /*
   * Keep this element mounted permanently. When Safari restores a frozen page,
   * the existing DOM and React state can be reused without remounting.
   */
  return (
    <div
      id="edge-scroll-gate-cover"
      aria-hidden="true"
    />
  );
}