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
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#09090b",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
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
    root.removeAttribute(gateAttribute);

    var navigationType = getNavigationType();
    var userAgent = window.navigator.userAgent;

    var isSafari =
      /Safari/i.test(userAgent) &&
      !/Chrome|CriOS|FxiOS|EdgiOS|OPiOS|Android/i.test(userAgent);

    var standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true;

    if (standalone) {
      root.setAttribute("data-edge-standalone", "true");
    } else {
      root.removeAttribute("data-edge-standalone");
    }

    var hasExistingSession =
      sessionStorage.getItem(sessionKey) === "true";

    var shouldRun =
      (isSafari || standalone) &&
      navigationType === "navigate" &&
      !hasExistingSession;

    sessionStorage.setItem(sessionKey, "true");

    if (!shouldRun) {
      return;
    }

    root.setAttribute(
      gateAttribute,
      standalone ? "standalone" : "browser"
    );

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
      className={`${inter.variable} ${geistMono.variable} h-full bg-[#09090b] antialiased`}
    >
      <head>
        <script
          id="edge-early-scroll-gate"
          dangerouslySetInnerHTML={{ __html: earlyGateScript }}
        />

        <link rel="preload" as="image" href="/logo.png" />

        <meta name="theme-color" content="#09090b" />
        <meta name="color-scheme" content="dark" />

        <link rel="apple-touch-icon" href="/apple-icon.png" />
        <link rel="apple-touch-startup-image" href="/splash.png" />
      </head>

      <body className="relative min-h-[100dvh] overflow-x-hidden bg-[#09090b] font-sans text-white">
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

          <div className="edge-app-shell min-h-[100dvh]">
            <AppSidebar />
            <TopRightAuth />

            <main className="min-h-[100dvh] bg-[#09090b] md:pl-[240px]">
              {children}
            </main>

            <ResponsiveToaster />
          </div>
        </Providers>
      </body>
    </html>
  );
}