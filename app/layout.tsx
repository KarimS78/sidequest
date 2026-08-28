import type { Metadata, Viewport } from "next";
import { ViewTransition } from "react";
import { Geist_Mono, Instrument_Sans } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { AppNav } from "@/components/nav";
import { EggHost } from "@/components/eggs";
import { InstallPrompt } from "@/components/install-prompt";
import { SwRegister } from "@/components/sw-register";
import { I18nProvider } from "@/i18n/context";
import { getLocale } from "@/i18n/server";
import { dictionary } from "@/i18n";

/**
 * Three families, three jobs.
 *
 * Clash Display is self-hosted rather than pulled from Fontshare at runtime:
 * it sets the first headline a visitor ever sees, and a display face that
 * arrives late is a layout that jumps. Three static weights, 45KB total, is
 * cheaper than the variable file and covers 500/600/700.
 */
const clash = localFont({
  variable: "--font-clash",
  display: "swap",
  src: [
    { path: "../public/fonts/ClashDisplay-Medium.woff2", weight: "500", style: "normal" },
    { path: "../public/fonts/ClashDisplay-Semibold.woff2", weight: "600", style: "normal" },
    { path: "../public/fonts/ClashDisplay-Bold.woff2", weight: "700", style: "normal" },
  ],
});

const instrument = Instrument_Sans({
  variable: "--font-instrument",
  subsets: ["latin"],
});

// Everything the engine computed: scores, hours, session lengths.
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const META = {
  en: {
    title: "SideQuest — Never forget where you left off",
    description:
      "You own 150 games and have one free hour. SideQuest reads your library and your mood, picks the one game to play tonight, and tells you why.",
  },
  fr: {
    title: "SideQuest — Ne perds plus jamais le fil",
    description:
      "Tu as 150 jeux et une heure devant toi. SideQuest lit ta bibliothèque et ton humeur, choisit le jeu de ce soir, et te dit pourquoi.",
  },
} as const;

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return {
    ...META[locale],
    applicationName: "SideQuest",
    icons: {
      icon: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }],
      apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    },
    appleWebApp: {
      capable: true,
      title: "SideQuest",
      statusBarStyle: "black-translucent",
    },
  };
}

export const viewport: Viewport = {
  // The same ground the app paints, so the phone's status bar belongs to the
  // page rather than floating above it.
  themeColor: "#0d1114",
  colorScheme: "dark",
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const d = dictionary(locale);

  return (
    <html
      lang={locale}
      className={`${clash.variable} ${instrument.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <I18nProvider initial={locale}>
          <AppNav />
          {/* Route changes cross-fade and rise eight pixels. Browsers without
              the API simply cut, which is the correct fallback. */}
          <ViewTransition default="page">
            <div className="flex min-h-full flex-1 flex-col">{children}</div>
          </ViewTransition>
          <InstallPrompt />
          <SwRegister />
          <EggHost />
        </I18nProvider>
        <span className="sr-only">{d.common.tagline}</span>
      </body>
    </html>
  );
}
