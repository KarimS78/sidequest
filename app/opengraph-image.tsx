import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * The social card.
 *
 * This is the one place the full lockup appears — compass, wordmark and
 * tagline — because it is the one surface wide enough to read it. Every square
 * output (favicon, PWA icons) is the emblem alone: an 8px line of capitals
 * under a 32px icon is a grey smear.
 *
 * The lockup is `assets/og-lockup.png`, written by scripts/generate-brand.mjs
 * from the same master every icon comes from, so the card cannot drift from the
 * rest of the brand.
 *
 * English by default: a crawler sends no cookie, and the link preview is the
 * first thing a stranger sees.
 */

export const alt = "SideQuest · Tonight, you play this";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const GROUND = "#0d1114";

export default async function Image() {
  const [clash, lockup] = await Promise.all([
    readFile(join(process.cwd(), "assets/ClashDisplay-Semibold.ttf")),
    readFile(join(process.cwd(), "assets/og-lockup.png")),
  ]);

  const lockupSrc = `data:image/png;base64,${lockup.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          background: GROUND,
          position: "relative",
        }}
      >
        {/* The violet wash.

            A linear gradient, not a radial pool: the image renderer draws
            `radial-gradient(closest-side, …)` with a dark hole punched through
            the middle of it, whether the stops end on `transparent` or on a
            transparent violet. A diagonal wash reads the same at this size and
            cannot go wrong. */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(115deg, rgba(124,92,255,0) 42%, rgba(124,92,255,0.14) 74%, rgba(124,92,255,0.26) 100%)",
          }}
        />

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "0 0 0 88px",
            width: 700,
          }}
        >
          <div
            style={{
              display: "flex",
              fontFamily: "Clash",
              fontSize: 84,
              lineHeight: 1.04,
              letterSpacing: "0.01em",
              color: "#e8ecf4",
            }}
          >
            TONIGHT, YOU PLAY THIS.
          </div>

          <div
            style={{
              display: "flex",
              fontSize: 28,
              color: "#99a3b3",
              marginTop: 28,
            }}
          >
            Your Steam library, the hour you have and the mood you are in — one
            game, and the reasons it scored.
          </div>
        </div>

        {/* The lockup keeps its own tile rather than being knocked out onto
            the card. The master is painted on pure black with a halo around
            it: floated on the card's #0d1114 that ground reads as a dark
            smudge with a square edge. Given a plate of its own black, the
            same pixels read as deliberate. */}
        <div
          style={{
            display: "flex",
            marginLeft: "auto",
            marginRight: 56,
            padding: 8,
            borderRadius: 28,
            background: "#000",
            border: "1px solid rgba(124,92,255,0.22)",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lockupSrc} alt="" width={404} height={404} style={{ objectFit: "contain" }} />
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [{ name: "Clash", data: clash, style: "normal", weight: 600 }],
    }
  );
}
