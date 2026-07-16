import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Geist_Mono } from "next/font/google";
import "./globals.css";
import AppSidebar from "./components/AppSidebar";
import PrivyUserSync from "./components/PrivyUserSync";
import SafariScrollGate from "./components/SafariScrollGate";
import TopRightAuth from "./components/TopRightAuth";
import Providers from "./providers";
import ResponsiveToaster from "./components/ResponsiveToaster";

const sfProRounded = localFont({
  src: [
    {
      path: "../public/SF-Pro-Rounded-Thin.otf",
      weight: "100",
      style: "normal",
    },
    {
      path: "../public/SF-Pro-Rounded-Light.otf",
      weight: "300",
      style: "normal",
    },
    {
      path: "../public/SF-Pro-Rounded-Regular.otf",
      weight: "400",
      style: "normal",
    },
    {
      path: "../public/SF-Pro-Rounded-Medium.otf",
      weight: "500",
      style: "normal",
    },
    {
      path: "../public/SF-Pro-Rounded-Semibold.otf",
      weight: "600",
      style: "normal",
    },
    {
      path: "../public/SF-Pro-Rounded-Bold.otf",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-sf-pro-rounded",
  display: "swap",
  fallback: ["ui-rounded", "system-ui", "sans-serif"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Edge",
  description: "Beat the odds.",
  icons: {
    icon: "/icon.png",
    apple: "/apple-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#09090b",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

const earlyGateScript = `
(function () {
  var root = document.documentElement;
  var gateAttribute = "data-edge-scroll-gate";
  var sessionKey = "edge:safari-session-active";

  function getNavigationType() {
    try {
      if (typeof performance.getEntriesByType === "function") {
        var entries = performance.getEntriesByType("navigation");
        var entry = entries && entries[0];

        if (entry && entry.type) {
          return entry.type;
        }
      }

      if (performance.navigation) {
        if (performance.navigation.type === 1) {
          return "reload";
        }

        if (performance.navigation.type === 2) {
          return "back_forward";
        }
      }
    } catch (_) {}

    return "navigate";
  }

  try {
    /*
     * The server-rendered HTML never starts with the gate enabled.
     * The gate is added here only during a true fresh Safari session.
     */
    root.removeAttribute(gateAttribute);

    var navigationType = getNavigationType();
    var userAgent = window.navigator.userAgent;

    var isSafari =
      /Safari/i.test(userAgent) &&
      !/Chrome|CriOS|FxiOS|EdgiOS|OPiOS|Android/i.test(userAgent);

    var hasExistingSession =
      sessionStorage.getItem(sessionKey) === "true";

    var shouldRun =
      isSafari &&
      navigationType === "navigate" &&
      !hasExistingSession;

    /*
     * Mark the current Safari tab/session as active. Reloads and normal
     * navigation during this session will not run the opening gate.
     */
    sessionStorage.setItem(sessionKey, "true");

    /*
     * Regular reloads, back/forward navigation and normal app navigation
     * remain completely untouched, including native scroll restoration.
     */
    if (!shouldRun) {
      return;
    }

    root.setAttribute(gateAttribute, "browser");

    /*
     * Manual restoration is used only while the fresh-session gate runs.
     * SafariScrollGate restores this to "auto" when the gate finishes.
     */
    if ("scrollRestoration" in history) {
      history.scrollRestoration = "manual";
    }
  } catch (_) {
    root.removeAttribute(gateAttribute);
  }
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${sfProRounded.variable} ${geistMono.variable} h-full bg-[#09090b] antialiased`}
    >
      <head>
        <script
          id="edge-early-scroll-gate"
          dangerouslySetInnerHTML={{ __html: earlyGateScript }}
        />

        <link rel="preload" as="image" href="/logo.png" />
        <link rel="apple-touch-icon" href="/apple-icon.png" />
      </head>

      <body className="relative min-h-screen overflow-x-hidden bg-[#09090b] font-sans text-white">
        <SafariScrollGate />

        <Providers>
          <PrivyUserSync />

          <style>{`
            @keyframes buttonShimmer {
              0% {
                transform: translateX(0) skewX(-20deg);
                opacity: 0;
              }

              8% {
                opacity: 0.42;
              }

              24% {
                opacity: 0.42;
              }

              38% {
                transform: translateX(520%) skewX(-20deg);
                opacity: 0;
              }

              100% {
                transform: translateX(520%) skewX(-20deg);
                opacity: 0;
              }
            }
          `}</style>

          <AppSidebar />
          <TopRightAuth />

          <main className="min-h-screen bg-[#09090b] md:pl-[240px]">
            {children}
          </main>

          <ResponsiveToaster />
        </Providers>
      </body>
    </html>
  );
}