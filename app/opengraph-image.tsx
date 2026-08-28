import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * The social card.
 *
 * This is the one place the full lockup appears — mark plus wordmark plus the
 * line — because it is the one surface wide enough to read it. Every square
 * output (favicon, PWA icons) is the mark alone: an 8px baseline of capitals
 * under a 32px icon is a grey smear, and that rule survives the redesign.
 *
 * Generated rather than painted, so it cannot drift from the mark in
 * components/logo.tsx the way a checked-in PNG would. English by default: a
 * crawler sends no cookie, and the link preview is the first thing a stranger
 * sees.
 */

export const alt = "SideQuest — Never forget where you left off";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const ACCENT = "#7c5cff";
const ACCENT_SOFT = "#a794ff";
const GROUND = "#0d1114";

export default async function Image() {
  const clash = await readFile(
    join(process.cwd(), "assets/ClashDisplay-Semibold.ttf")
  );

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          background: GROUND,
          padding: "0 96px",
          position: "relative",
        }}
      >
        {/* The violet wash.

            A linear gradient, not the radial pool the hero uses: the image
            renderer draws `radial-gradient(closest-side, …)` with a dark hole
            punched through the middle of it, twice, whether the stops end on
            `transparent` or on a transparent violet. A diagonal wash reads the
            same at this size and cannot go wrong. */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(115deg, rgba(124,92,255,0) 38%, rgba(124,92,255,0.16) 72%, rgba(124,92,255,0.28) 100%)",
          }}
        />

        <div style={{ display: "flex", alignItems: "center", gap: 26 }}>
          <svg width="92" height="92" viewBox="0 0 32 32">
            <rect
              x="5.5"
              y="5.5"
              width="21"
              height="21"
              rx="3"
              transform="rotate(45 16 16)"
              fill={ACCENT}
            />
            <path
              d="M19.8 12.9C19.8 11 18.1 10.2 16 10.2C13.9 10.2 12.2 11.1 12.2 12.9C12.2 16.4 19.8 15.3 19.8 19.1C19.8 21 18 21.9 16 21.9C13.9 21.9 12.2 21 12.2 19.3"
              stroke={GROUND}
              strokeWidth="2.6"
              strokeLinecap="round"
              fill="none"
            />
          </svg>
          <div
            style={{
              display: "flex",
              fontFamily: "Clash",
              fontSize: 60,
              letterSpacing: "0.01em",
              color: "#e8ecf4",
            }}
          >
            <span>SIDE</span>
            <span style={{ color: ACCENT_SOFT }}>QUEST</span>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            fontFamily: "Clash",
            fontSize: 96,
            lineHeight: 1.04,
            letterSpacing: "0.01em",
            color: "#e8ecf4",
            marginTop: 56,
          }}
        >
          TONIGHT, YOU PLAY THIS.
        </div>

        <div
          style={{
            display: "flex",
            fontSize: 30,
            color: "#99a3b3",
            marginTop: 30,
            maxWidth: 860,
          }}
        >
          Your Steam library, the hour you have and the mood you are in — one
          game, and the reasons it scored.
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [{ name: "Clash", data: clash, style: "normal", weight: 600 }],
    }
  );
}
