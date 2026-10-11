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

// The landing's tokens (handoff of 2026-10-11).
const GROUND = "#0A0B0D";
const FG = "#F2F3EE";
const FG2 = "#C9CBC2";
const ACID = "#C6FF3D";

export default async function Image() {
  const [unbounded, geist, lockup] = await Promise.all([
    readFile(join(process.cwd(), "assets/Unbounded-SemiBold.ttf")),
    readFile(join(process.cwd(), "assets/Geist-Regular.ttf")),
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
          fontFamily: "Geist",
        }}
      >
        {/* A thin acid rule along the bottom: the one green of the card is
            the second line of the title, this only signs it. */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: 10,
            background: ACID,
          }}
        />

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "0 0 0 80px",
            width: 720,
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              fontFamily: "Unbounded",
              fontSize: 76,
              lineHeight: 1.05,
              letterSpacing: "-0.03em",
              color: FG,
            }}
          >
            <span>Tonight,</span>
            <span style={{ color: ACID }}>you play this.</span>
          </div>

          <div
            style={{
              display: "flex",
              fontSize: 28,
              lineHeight: 1.4,
              color: FG2,
              marginTop: 30,
            }}
          >
            Your Steam library, the hour you have and the mood you are in. One
            game, and the reasons it scored.
          </div>
        </div>

        {/* The lockup keeps its own black plate: the master is painted on pure
            black with a halo, and floated on the card it would read as a
            square smudge. */}
        <div
          style={{
            display: "flex",
            marginLeft: "auto",
            marginRight: 56,
            padding: 8,
            borderRadius: 28,
            background: "#000",
            border: "1px solid rgba(242,243,238,0.12)",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lockupSrc} alt="" width={380} height={380} style={{ objectFit: "contain" }} />
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Unbounded", data: unbounded, style: "normal", weight: 600 },
        { name: "Geist", data: geist, style: "normal", weight: 400 },
      ],
    }
  );
}
