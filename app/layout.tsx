import type { Metadata, Viewport } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import "./globals.css";
import AppSidebar from "./components/AppSidebar";
import SafariScrollGate from "./components/SafariScrollGate";
import TopRightAuth from "./components/TopRightAuth";
import Providers from "./providers";
import ResponsiveToaster from "./components/ResponsiveToaster";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Edge",
  description: "Beat the odds.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/icon.png",
    apple: "/apple-icon.png",
  },
  appleWebApp: {
    capable: true,
    title: "Edge",
    statusBarStyle: "black",
  },
};

export const viewport: Viewport = {
  themeColor: "#09090b",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

const earlyGateScript = `
(function () {
  var root = document.documentElement;
  var sessionKey = "edge:safari-session-active";

  try {
    var navigationEntry =
      typeof performance.getEntriesByType === "function"
        ? performance.getEntriesByType("navigation")[0]
        : null;

    var navigationType = navigationEntry ? navigationEntry.type : null;
    var isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true;
    var hasExistingSession =
      sessionStorage.getItem(sessionKey) === "true";

    /*
     * Standalone iOS apps can restore a frozen document at an old scroll
     * position, even when sessionStorage still exists. Keep the gate locked
     * for every standalone document launch. In normal Safari, leave regular
     * reloads and same-session navigation untouched.
     */
    var shouldLock =
      isStandalone ||
      (navigationType !== "reload" && !hasExistingSession);

    if (!shouldLock) {
      root.removeAttribute("data-edge-scroll-gate");
      return;
    }

    root.setAttribute("data-edge-scroll-gate", "locked");

    if ("scrollRestoration" in history) {
      history.scrollRestoration = "manual";
    }
  } catch (_) {
    root.removeAttribute("data-edge-scroll-gate");
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
      data-edge-scroll-gate="locked"
      suppressHydrationWarning
      className={`${inter.variable} ${geistMono.variable} h-full bg-[#09090b] antialiased`}
    >
      <head>
        <script
          id="edge-early-scroll-gate"
          dangerouslySetInnerHTML={{ __html: earlyGateScript }}
        />

        <meta name="theme-color" content="#09090b" />
        <meta name="color-scheme" content="dark" />

        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="Edge" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black" />

        <link rel="apple-touch-icon" href="/apple-icon.png" />
        <link rel="apple-touch-startup-image" href="/splash.png" />
      </head>

      <body className="relative min-h-screen overflow-x-hidden bg-[#09090b] font-sans text-white">
        <SafariScrollGate />

        <Providers>
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