// components/ResponsiveToaster.tsx
"use client";

import { Toaster } from "sonner";
import { useEffect, useState } from "react";

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    function check() {
      setIsMobile(window.innerWidth < 640);
    }

    check();
    window.addEventListener("resize", check);

    return () => window.removeEventListener("resize", check);
  }, []);

  return isMobile;
}

export default function ResponsiveToaster() {
  const isMobile = useIsMobile();

  return (
    <>
      <Toaster
        theme="dark"
        position={isMobile ? "top-center" : "bottom-right"}
        closeButton
        toastOptions={{
          duration: 3000,
          classNames: {
            toast:
              "relative rounded-2xl border border-zinc-800 !bg-zinc-950 px-4 py-3 pr-10 !text-zinc-100 shadow-2xl",
            title: "!text-sm !font-medium !text-zinc-100",
            description: "mt-0.5 !text-[13px] !text-zinc-500",
            icon: "hidden",
            closeButton:
              "!border-0 !bg-transparent !text-zinc-500 hover:!text-zinc-200",
            success: "!border-zinc-800 !bg-zinc-950 !text-zinc-100",
            error: "!border-zinc-800 !bg-zinc-950 !text-zinc-100",
            warning: "!border-zinc-800 !bg-zinc-950 !text-zinc-100",
            info: "!border-zinc-800 !bg-zinc-950 !text-zinc-100",
          },
        }}
      />

      <style jsx global>{`
        [data-sonner-toaster][data-theme="dark"] {
          --normal-bg: #09090b !important;
          --normal-border: #27272a !important;
          --normal-text: #f4f4f5 !important;
          --success-bg: #09090b !important;
          --success-border: #27272a !important;
          --success-text: #f4f4f5 !important;
          --error-bg: #09090b !important;
          --error-border: #27272a !important;
          --error-text: #f4f4f5 !important;
          --warning-bg: #09090b !important;
          --warning-border: #27272a !important;
          --warning-text: #f4f4f5 !important;
        }

        [data-sonner-toast] {
          background: #09090b !important;
          color: #f4f4f5 !important;
          border-color: #27272a !important;
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.45) !important;
        }

        [data-sonner-toast] [data-title] {
          color: #f4f4f5 !important;
          font-weight: 500 !important;
        }

        [data-sonner-toast] [data-description] {
          color: #71717a !important;
        }

        [data-sonner-toast] [data-icon] {
          display: none !important;
        }

        [data-sonner-toast] [data-close-button] {
          position: absolute !important;
          top: 8px !important;
          right: 8px !important;
          left: auto !important;
          transform: none !important;
          width: 22px !important;
          height: 22px !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          border: 0 !important;
          border-radius: 9999px !important;
          background: transparent !important;
          color: #71717a !important;
        }

        [data-sonner-toast] [data-close-button]:hover {
          color: #e4e4e7 !important;
          background: transparent !important;
        }

        [data-sonner-toast] [data-close-button] svg {
          width: 14px !important;
          height: 14px !important;
        }
      `}</style>
    </>
  );
}