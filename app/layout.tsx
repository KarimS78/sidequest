import type { Metadata, Viewport } from "next";
import { Big_Shoulders, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { BottomNav } from "@/components/nav";
import { EggHost } from "@/components/eggs";
import { InstallPrompt } from "@/components/install-prompt";
import { SwRegister } from "@/components/sw-register";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// The label face: condensed industrial signage, the way a cartridge sticker is
// set. Variable, so the whole weight range is available for one download.
const bigShoulders = Big_Shoulders({
  variable: "--font-big-shoulders",
  subsets: ["latin"],
  // Next has no metric overrides for this family, so it can't synthesise a
  // matching fallback. Name a condensed one ourselves and opt out, rather than
  // let it swap from a wide default and shove the layout around.
  adjustFontFallback: false,
  fallback: ["Arial Narrow", "Helvetica Neue Condensed", "sans-serif"],
});

export const metadata: Metadata = {
  title: "SideQuest AI — Never forget where you left off",
  description:
    "Your intelligent gaming companion. SideQuest AI remembers your progress so you can pick up any game exactly where you stopped.",
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

export const viewport: Viewport = {
  // The room, not a cold black — the same --ground the app paints, so the
  // phone's status bar and the desktop title bar belong to the shelf.
  themeColor: "#191412",
  colorScheme: "dark",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${bigShoulders.variable} h-full antialiased`}
    >
      {/* app-shell clears the desktop rail; under lg it is a no-op. */}
      <body className="app-shell flex min-h-full flex-col">
        {children}
        <BottomNav />
        <InstallPrompt />
        <SwRegister />
        <EggHost />
      </body>
    </html>
  );
}
