import Image from "next/image";

/**
 * The mark: the compass rose and S from brand/logo-master.png.
 *
 * Two things about how it is rendered, both learned rather than chosen:
 *
 * It keeps its OWN dark tile instead of being knocked out onto whatever is
 * behind it. The artwork carries its own glow and its own near-black ground,
 * and floating that on a surface shows the ground as a smudge around the
 * emblem. The tile is the fix, and it is why `Mark` takes no colour prop.
 *
 * It is the mark alone, never the full lockup. At 32px the 8px line of
 * capitals under the emblem is a grey smear — so every square use is the
 * emblem, and the lockup appears in exactly one place, the social card.
 *
 * Server-safe: no hooks, no client boundary. The hover movement is CSS on the
 * parent, so a page can use the mark without paying for a client component.
 */
export function Mark({
  size = 32,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={`relative block shrink-0 overflow-hidden rounded-[6px] ${className}`}
      style={{ width: size, height: size }}
    >
      <Image
        src="/brand/mark-512.png"
        alt=""
        fill
        sizes={`${size}px`}
        priority
        className="object-cover"
      />
    </span>
  );
}

/**
 * SIDEQUEST, with QUEST carrying the accent. Two words in one, which is the
 * joke the name is already making.
 */
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span
      className={`poster text-[17px] leading-none tracking-[0.02em] ${className}`}
      style={{ fontWeight: 600 }}
    >
      SIDE<span className="text-accent-soft">QUEST</span>
    </span>
  );
}

/**
 * Mark + wordmark. On hover the emblem twitches like a needle finding north —
 * a few degrees on a spring, not a full turn: the S is a letterform, and
 * spinning it would read as a loading state rather than a compass.
 *
 * Deliberately renders no link and no button — the caller decides whether this
 * is navigation or a control, and nesting one inside the other is how a logo
 * ends up unreachable by keyboard.
 */
export function LogoContent({
  size = 30,
  showWord = true,
}: {
  size?: number;
  showWord?: boolean;
}) {
  return (
    <>
      <Mark
        size={size}
        className="transition-transform duration-500 [transition-timing-function:var(--spring)] group-hover:-rotate-[7deg] group-hover:scale-105"
      />
      {showWord && <Wordmark />}
    </>
  );
}

/** The classes that make a LogoContent wrapper behave: put them on the link. */
export const LOGO_WRAPPER =
  "group inline-flex items-center gap-2.5 rounded-btn outline-offset-4";
