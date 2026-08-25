import type { MetadataRoute } from "next";

/**
 * Installed, SideQuest is a small appliance: it opens on the shelf, it keeps
 * the room's colour in the title bar, and it turns whichever way the screen
 * is turned — a desk is landscape and that is no longer a mistake.
 *
 * The screenshots matter more than they look: without a `wide` one, a desktop
 * browser offers a cramped phone-shaped install dialog instead of the real
 * app card.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "SideQuest",
    short_name: "SideQuest",
    description:
      "An intelligent gaming companion that logs your sessions and generates AI progress summaries — so you can pick up any game right where you stopped.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    orientation: "any",
    lang: "en",
    categories: ["games", "entertainment", "productivity"],
    // The room, not a cold black.
    background_color: "#191412",
    theme_color: "#191412",
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
    shortcuts: [
      {
        name: "Pull a cartridge",
        short_name: "Pull",
        description: "Pick tonight's game",
        url: "/play",
        icons: [{ src: "/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Open the shelf",
        short_name: "Shelf",
        description: "Browse the library",
        url: "/dashboard",
        icons: [{ src: "/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Read the saves",
        short_name: "Saves",
        description: "Where you left off",
        url: "/history",
        icons: [{ src: "/icon-192.png", sizes: "192x192" }],
      },
    ],
    screenshots: [
      {
        src: "/screenshots/desktop.png",
        sizes: "1440x900",
        type: "image/png",
        form_factor: "wide",
        label: "The deck, the panel and the shelf on a desktop",
      },
      {
        src: "/screenshots/phone.png",
        sizes: "780x1688",
        type: "image/png",
        form_factor: "narrow",
        label: "Pulling tonight's cartridge on a phone",
      },
    ],
  };
}
