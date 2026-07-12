"use client";

import { useEffect, useLayoutEffect, useRef } from "react";

export default function ResetInitialScroll() {
  const userInteractedRef = useRef(false);

  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }

    const markUserInteraction = () => {
      userInteractedRef.current = true;
    };

    const resetToTop = () => {
      if (userInteractedRef.current) return;

      if (window.scrollX !== 0 || window.scrollY !== 0) {
        window.scrollTo({
          top: 0,
          left: 0,
          behavior: "instant",
        });
      }
    };

    resetToTop();

    window.addEventListener("touchstart", markUserInteraction, {
      passive: true,
    });
    window.addEventListener("pointerdown", markUserInteraction, {
      passive: true,
    });
    window.addEventListener("wheel", markUserInteraction, {
      passive: true,
    });
    window.addEventListener("keydown", markUserInteraction);
    window.addEventListener("pageshow", resetToTop);

    const animationFrame = window.requestAnimationFrame(resetToTop);

    const resetTimers = [
      window.setTimeout(resetToTop, 0),
      window.setTimeout(resetToTop, 50),
      window.setTimeout(resetToTop, 100),
      window.setTimeout(resetToTop, 200),
      window.setTimeout(resetToTop, 350),
      window.setTimeout(resetToTop, 500),
      window.setTimeout(resetToTop, 750),
    ];

    return () => {
      window.cancelAnimationFrame(animationFrame);

      resetTimers.forEach((timer) => {
        window.clearTimeout(timer);
      });

      window.removeEventListener("touchstart", markUserInteraction);
      window.removeEventListener("pointerdown", markUserInteraction);
      window.removeEventListener("wheel", markUserInteraction);
      window.removeEventListener("keydown", markUserInteraction);
      window.removeEventListener("pageshow", resetToTop);
    };
  }, []);

  return null;
}