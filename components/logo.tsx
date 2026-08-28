/**
 * The mark: a rounded diamond with an S cut through it.
 *
 * The diamond is a die face seen straight on, which is the honest shape for
 * this product — the whole thing is a weighted draw, and the one gesture the
 * app asks for is a roll.
 *
 * The S is stroked in the ground colour rather than punched with an SVG
 * `<mask>`. That is not a shortcut: a masked shape gets rasterised before it is
 * scaled, and at 30px the diamond's four points came back flattened into an
 * octagon with a smeared letter inside it. Drawn straight, both stay vector all
 * the way down to 18px. Pass `ground` when the mark sits on anything that is
 * not the app background.
 *
 * Server-safe: no hooks, no client boundary. The hover rotation is CSS on the
 * parent, so a page can use the mark without paying for a client component.
 */
export function Mark({
  size = 32,
  ground = "var(--background)",
  className = "",
}: {
  size?: number;
  ground?: string;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden
      className={className}
    >
      <rect
        x="5.5"
        y="5.5"
        width="21"
        height="21"
        rx="3"
        transform="rotate(45 16 16)"
        fill="var(--accent)"
      />
      {/* The S sits inside the diamond's inscribed square, so neither terminal
          runs out into a narrow corner. */}
      <path
        d="M19.8 12.9C19.8 11 18.1 10.2 16 10.2C13.9 10.2 12.2 11.1 12.2 12.9C12.2 16.4 19.8 15.3 19.8 19.1C19.8 21 18 21.9 16 21.9C13.9 21.9 12.2 21 12.2 19.3"
        stroke={ground}
        strokeWidth="2.6"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
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
 * Mark + wordmark, with the die-roll on hover: a quarter turn on a spring,
 * because a die that rotated linearly would be a loading spinner.
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
        className="transition-transform duration-500 [transition-timing-function:var(--spring)] group-hover:rotate-90"
      />
      {showWord && <Wordmark />}
    </>
  );
}

/** The classes that make a LogoContent wrapper behave: put them on the link. */
export const LOGO_WRAPPER =
  "group inline-flex items-center gap-2.5 rounded-btn outline-offset-4";
