import type { MetadataRoute } from "next";
import { dictionary } from "@/i18n";
import { getLocale } from "@/i18n/server";

/**
 * Installed, SideQuest is a small appliance: it opens on the shelf, it keeps
 * the room's colour in the title bar, and it turns whichever way the screen
 * is turned — a desk is landscape and that is no longer a mistake.
 *
 * The screenshots matter more than they look: without a `wide` one, a desktop
 * browser offers a cramped phone-shaped install dialog instead of the real
 * app card.
 *
 * It reads the locale cookie, which makes it a dynamic route instead of a
 * cached one. A few hundred bytes of JSON, served once at install time, in
 * the language the person installing it is reading — that trade is fine. The
 * previous version was English whatever the screen said, and its screenshot
 * labels still described a cartridge.
 */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const locale = await getLocale();
  const t = dictionary(locale).common.pwa;
  const icon = [{ src: "/icon-192.png", sizes: "192x192" }];

  return {
    id: "/",
    name: "SideQuest",
    short_name: "SideQuest",
    description: t.description,
    start_url: "/",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    orientation: "any",
    lang: locale,
    categories: ["games", "entertainment", "productivity"],
    // The same --background the app paints and the same value layout.tsx
    // gives the viewport, so the install splash matches the first paint.
    background_color: "#0d1114",
    theme_color: "#0d1114",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    // Long-press the installed icon: the three things worth doing directly.
    // One word per action, the same word the tab uses.
    shortcuts: [
      {
        name: t.shortcuts.draw.name,
        short_name: t.shortcuts.draw.short,
        description: t.shortcuts.draw.description,
        url: "/play",
        icons: icon,
      },
      {
        name: t.shortcuts.shelf.name,
        short_name: t.shortcuts.shelf.short,
        description: t.shortcuts.shelf.description,
        url: "/dashboard",
        icons: icon,
      },
      {
        name: t.shortcuts.saves.name,
        short_name: t.shortcuts.saves.short,
        description: t.shortcuts.saves.description,
        url: "/history",
        icons: icon,
      },
    ],
    screenshots: [
      {
        src: "/screenshots/desktop.png",
        sizes: "1440x900",
        type: "image/png",
        form_factor: "wide",
        label: t.screenshots.desktop,
      },
      {
        src: "/screenshots/phone.png",
        sizes: "780x1688",
        type: "image/png",
        form_factor: "narrow",
        label: t.screenshots.phone,
      },
    ],
  };
}
