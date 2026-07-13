"use client";

import { useLayoutEffect, useState } from "react";

function forceEveryScrollerToTop() {
  window.scrollTo(0, 0);

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

function pageIsFullyAtTop() {
  const scrollingElement =
    document.scrollingElement ?? document.documentElement;

  return (
    Math.abs(window.scrollY) < 1 &&
    Math.abs(window.scrollX) < 1 &&
    Math.abs(scrollingElement.scrollTop) < 1 &&
    Math.abs(scrollingElement.scrollLeft) < 1 &&
    Math.abs(document.documentElement.scrollTop) < 1 &&
    (!document.body || Math.abs(document.body.scrollTop) < 1)
  );
}

export default function InitialTopRenderGate() {
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    let cancelled = false;
    let animationFrame = 0;
    let stableFrames = 0;
    const startedAt = performance.now();

    const html = document.documentElement;
    const body = document.body;

    const previousHtmlOverflow = html.style.overflow;
    const previousBodyOverflow = body.style.overflow;

    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }

    html.style.overflow = "hidden";
    body.style.overflow = "hidden";

    const finish = () => {
      if (cancelled) return;

      forceEveryScrollerToTop();

      html.style.overflow = previousHtmlOverflow;
      body.style.overflow = previousBodyOverflow;

      setReady(true);
    };

    const verify = () => {
      if (cancelled) return;

      forceEveryScrollerToTop();

      const documentFinishedLoading = document.readyState === "complete";
      const minimumHiddenTimePassed = performance.now() - startedAt >= 180;

      if (
        documentFinishedLoading &&
        minimumHiddenTimePassed &&
        pageIsFullyAtTop()
      ) {
        stableFrames += 1;
      } else {
        stableFrames = 0;
      }

      // Require the viewport to remain exactly at the top for 12
      // consecutive painted frames before revealing the app.
      if (stableFrames >= 12) {
        finish();
        return;
      }

      animationFrame = window.requestAnimationFrame(verify);
    };

    const restartVerification = () => {
      stableFrames = 0;
      forceEveryScrollerToTop();
    };

    window.addEventListener("pageshow", restartVerification);
    window.addEventListener("load", restartVerification);
    window.addEventListener("resize", restartVerification);
    window.visualViewport?.addEventListener("resize", restartVerification);
    window.visualViewport?.addEventListener("scroll", restartVerification);

    forceEveryScrollerToTop();
    animationFrame = window.requestAnimationFrame(verify);

    // Safety fallback: still force the page to the top before revealing.
    const fallbackTimer = window.setTimeout(() => {
      forceEveryScrollerToTop();

      window.requestAnimationFrame(() => {
        forceEveryScrollerToTop();
        finish();
      });
    }, 4000);

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(animationFrame);
      window.clearTimeout(fallbackTimer);

      window.removeEventListener("pageshow", restartVerification);
      window.removeEventListener("load", restartVerification);
      window.removeEventListener("resize", restartVerification);
      window.visualViewport?.removeEventListener(
        "resize",
        restartVerification,
      );
      window.visualViewport?.removeEventListener(
        "scroll",
        restartVerification,
      );

      html.style.overflow = previousHtmlOverflow;
      body.style.overflow = previousBodyOverflow;
    };
  }, []);

  if (ready) return null;

  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2147483647,
        background: "#09090b",
        pointerEvents: "all",
      }}
    />
  );
}