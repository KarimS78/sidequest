"use client";

import Image from "next/image";
import { useState } from "react";
import { headerFor, portraitFor } from "@/lib/library";

/**
 * Portrait cover art, with two fallbacks.
 *
 * Not every appid has a `library_600x900`, and older or delisted titles have
 * neither that nor a header — so a miss steps down to the wide header, and a
 * second miss to the game's name set as type. The shelf is the one screen made
 * almost entirely of these, so a broken one is very visible.
 *
 * Fills its parent: the parent must be positioned and set the aspect ratio.
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
  const [step, setStep] = useState(0);

  if (step > 1) {
    return (
      <span className="absolute inset-0 flex items-end bg-surface2 p-3">
        <span className="poster text-[15px] leading-tight text-muted">{name}</span>
      </span>
    );
  }

  return (
    <Image
      src={step === 0 ? portraitFor(appid) : headerFor(appid)}
      alt={name}
      fill
      sizes={sizes}
      priority={priority}
      onError={() => setStep((s) => s + 1)}
      className={`object-cover ${className}`}
    />
  );
}
