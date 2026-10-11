import type { Metadata, Viewport } from "next";
import { ViewTransition } from "react";
import { Geist, Unbounded } from "next/font/google";
import "./globals.css";
import { AppNav } from "@/components/nav";
import { EggHost } from "@/components/eggs";
import { InstallPrompt } from "@/components/install-prompt";
import { SwRegister } from "@/components/sw-register";
import { I18nProvider } from "@/i18n/context";
import { getLocale } from "@/i18n/server";
import { dictionary } from "@/i18n";

/**
 * Two families — the landing's (handoff of 2026-10-11), now worn by the whole
 * app: Unbounded for the posters, Geist for everything else, numbers included
 * (tabular figures). No monospace anywhere: Karim's rule.
 */
const unbounded = Unbounded({
  variable: "--font-unbounded",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
});

const META = {
  en: {
    title: "SideQuest · Tonight, you play this",
    description:
      "SideQuest reads the Steam games you already own, the hour you actually have and the mood you are in, then comes back with one game for tonight. Not a shortlist. One.",
  },
  fr: {
    title: "SideQuest · Ce soir, tu joues à ça",
    description:
      "SideQuest lit les jeux Steam que tu possèdes déjà, l'heure que tu as vraiment devant toi et ton humeur, puis revient avec un jeu pour ce soir. Pas une liste. Un.",
  },
} as const;

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return {
    ...META[locale],
    openGraph: {
      ...META[locale],
      siteName: "SideQuest",
      type: "website",
    },
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
  themeColor: "#0a0b0d",
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
      className={`${unbounded.variable} ${geist.variable} h-full antialiased`}
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
