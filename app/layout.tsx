import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { SessionProvider } from "@/components/session-provider";
import { RealtimeProvider } from "@/components/realtime-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ServiceWorkerRegistrar } from "@/components/service-worker";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mono-jb",
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  ),
  title: {
    default: "FillMate - Never argue about who filled the bottles",
    template: "%s | FillMate",
  },
  description:
    "A simple accountability system for shared hostel water. Record a refill with one photo, AI verifies it, everyone stays informed.",
  applicationName: "FillMate",
  keywords: [
    "hostel",
    "water cooler",
    "accountability",
    "roommates",
    "refill tracker",
    "student housing",
  ],
  authors: [{ name: "FillMate" }],
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "FillMate",
  },
  openGraph: {
    type: "website",
    title: "FillMate - Never argue about who filled the bottles",
    description:
      "Record a refill with one photo. AI verifies it. Everyone stays informed.",
    siteName: "FillMate",
    images: [{ url: "/opengraph-image", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "FillMate",
    description: "A simple accountability system for shared hostel water.",
    images: ["/opengraph-image"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f7f8" },
    { media: "(prefers-color-scheme: dark)", color: "#080b11" },
  ],
};

const themeScript = `
(function(){try{
  var stored = localStorage.getItem("fillmate-theme");
  var prefers = window.matchMedia("(prefers-color-scheme: dark)").matches;
  var theme = stored === "light" || stored === "dark" ? stored : (prefers ? "dark" : "light");
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.style.colorScheme = theme;
}catch(e){}})();
`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${mono.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
      </head>
      <body className="min-h-dvh antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-100 focus:rounded-md focus:bg-brand focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white"
        >
          Skip to content
        </a>
        <ThemeProvider>
          <SessionProvider>
            <RealtimeProvider>
              <TooltipProvider>{children}</TooltipProvider>
              <Toaster
                position="top-center"
                offset={12}
                toastOptions={{
                  classNames: {
                    toast:
                      "!rounded-lg !border !border-border !bg-surface !text-ink !shadow-e3 !text-[13px]",
                    description: "!text-ink-muted",
                    actionButton: "!bg-ink !text-surface",
                  },
                }}
              />
            </RealtimeProvider>
          </SessionProvider>
        </ThemeProvider>
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}