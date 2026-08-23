"use client";

import Image from "next/image";
import { useState } from "react";
import { portraitFor } from "@/lib/library";

/**
 * Portrait cover art with the label fallback.
 *
 * Not every appid has a `library_600x900`, and older or delisted titles have
 * none at all — so a miss falls back to the game's name set as label type,
 * which is what a cartridge sticker would say anyway.
 *
 * Fills its parent: the parent must be positioned and give the aspect ratio.
 */
export function CoverArt({
  appid,
  name,
  sizes,
  priority = false,
  className = "",
}: {
  appid: number;
  name: string;
  /** Required so Next picks a sane source width for the grid it sits in. */
  sizes: string;
  priority?: boolean;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <span className="absolute inset-0 flex items-end bg-paper p-3 font-display text-[19px] font-bold uppercase leading-none text-ink">
        {name}
      </span>
    );
  }

  return (
    <Image
      src={portraitFor(appid)}
      alt={name}
      fill
      sizes={sizes}
      priority={priority}
      onError={() => setFailed(true)}
      className={`object-cover ${className}`}
    />
  );
}
