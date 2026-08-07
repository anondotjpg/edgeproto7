// components/ResponsiveToaster.tsx
"use client";

import { Toaster } from "sonner";
import { useEffect, useState } from "react";
import { FaCheck, FaXmark } from "react-icons/fa6";

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
        icons={{
          success: (
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
              <FaCheck className="h-[14px] w-[14px]" />
            </span>
          ),
          error: (
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500/15 text-red-400">
              <FaXmark className="h-[15px] w-[15px]" />
            </span>
          ),
        }}
        toastOptions={{
          duration: 3000,
          classNames: {
            toast:
              "relative !rounded-full border border-zinc-800 !bg-zinc-950 !px-5 !py-3.5 !text-zinc-100 shadow-2xl",
            title:
              "!w-full !text-[14px] !font-medium !leading-[1.3] !text-zinc-100",
            description:
              "!mt-0.5 !w-full !text-[13px] !leading-[1.3] !text-zinc-500",
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
          position: relative !important;
          background: #09090b !important;
          color: #f4f4f5 !important;
          border-color: #27272a !important;
          border-radius: 9999px !important;
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.45) !important;

          padding-left: 20px !important;
          padding-right: 20px !important;
        }

        /*
         * Success/error need extra room for the right-side status badge.
         */
        [data-sonner-toast][data-type="success"],
        [data-sonner-toast][data-type="error"] {
          padding-right: 62px !important;
        }

        [data-sonner-toast] [data-content] {
          width: 100% !important;
          min-width: 0 !important;
        }

        [data-sonner-toast] [data-title] {
          width: 100% !important;
          color: #f4f4f5 !important;
          font-weight: 500 !important;
          line-height: 1.3 !important;
        }

        [data-sonner-toast] [data-description] {
          width: 100% !important;
          margin-top: 2px !important;
          color: #71717a !important;
          line-height: 1.3 !important;
        }

        /*
         * Move success/error icon from Sonner's normal left position
         * to the right side of the pill.
         */
        [data-sonner-toast][data-type="success"] [data-icon],
        [data-sonner-toast][data-type="error"] [data-icon] {
          position: absolute !important;
          top: 50% !important;
          right: 14px !important;
          left: auto !important;

          width: 32px !important;
          height: 32px !important;

          margin: 0 !important;
          transform: translateY(-50%) !important;

          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
        }

        /*
         * No icon for normal/info/warning toasts.
         */
        [data-sonner-toast]:not([data-type="success"]):not(
            [data-type="error"]
          )
          [data-icon] {
          display: none !important;
        }

        [data-sonner-toast] [data-close-button] {
          display: none !important;
        }

        @media (max-width: 639px) {
          [data-sonner-toaster] {
            width: calc(100vw - 32px) !important;
            max-width: 390px !important;
          }

          [data-sonner-toast] {
            width: 100% !important;
          }
        }
      `}</style>
    </>
  );
}