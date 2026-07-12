import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Geist_Mono, Inter } from "next/font/google";
import "./globals.css";
import AppSidebar from "./components/AppSidebar";
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
  viewportFit: "cover",
};

const initialScrollScript = `
(function () {
  var root = document.documentElement;
  var revealed = false;

  function forceTop() {
    try {
      window.scrollTo(0, 0);

      var scrollingElement =
        document.scrollingElement || document.documentElement;

      if (scrollingElement) {
        scrollingElement.scrollTop = 0;
        scrollingElement.scrollLeft = 0;
      }

      if (document.body) {
        document.body.scrollTop = 0;
        document.body.scrollLeft = 0;
      }
    } catch (_) {}
  }

  function reveal() {
    if (revealed) return;
    revealed = true;
    forceTop();
    root.classList.remove("initial-scroll-reset");
  }

  try {
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }

    root.classList.add("initial-scroll-reset");
    forceTop();

    window.addEventListener(
      "pageshow",
      function () {
        revealed = false;
        root.classList.add("initial-scroll-reset");
        forceTop();

        window.requestAnimationFrame(function () {
          forceTop();

          window.requestAnimationFrame(function () {
            forceTop();
            reveal();
          });
        });
      },
      { passive: true }
    );

    window.requestAnimationFrame(function () {
      forceTop();

      window.requestAnimationFrame(function () {
        forceTop();
        reveal();
      });
    });

    window.setTimeout(reveal, 250);
  } catch (_) {
    root.classList.remove("initial-scroll-reset");
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
      className={`${inter.variable} ${geistMono.variable} initial-scroll-reset h-full bg-[#09090b] antialiased`}
    >
      <head>
        <Script
          id="initial-scroll-position"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: initialScrollScript }}
        />

        <meta name="theme-color" content="#09090b" />
        <meta name="color-scheme" content="dark" />

        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="Edge" />
        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="black-translucent"
        />

        <link rel="apple-touch-icon" href="/apple-icon.png" />
        <link rel="apple-touch-startup-image" href="/splash.png" />
      </head>

      <body className="relative min-h-screen overflow-x-hidden bg-[#09090b] font-sans text-white">
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