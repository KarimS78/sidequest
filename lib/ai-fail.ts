/**
 * Why an AI call gave nothing back, as a code the UI can translate.
 *
 * `reason` strings in lib/ai.ts are for logs and for the person reading them:
 * "provider 503", "incomplete: max_output_tokens". They are English data, and
 * they were reaching the screen — a French player read « Pas de lecture —
 * daily token budget spent ». The code is the part a screen is allowed to
 * show; the string stays behind it.
 *
 * Client-safe: a type and nothing else.
 */
export type AiFailCode =
  /** No key, or AI_ENABLED=false. */
  | "off"
  /** A daily budget — tokens, calls, or this device's share — is spent. */
  | "quota"
  /** The provider errored, timed out, or the network dropped. */
  | "unreachable"
  /** The provider answered, but not with anything the app could use. */
  | "unusable"
  /** The player gave too little to work on. */
  | "tooShort"
  /** Nothing to read: no tags, no notes, no candidates. */
  | "empty";
