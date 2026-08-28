// A one-line bus between the panels that spend and the gauge that reports it.
//
// Crossing pages already works without this: the supply gauge fetches on mount,
// so arriving at /profile always shows fresh numbers. The gap is same-page —
// the portrait and the roast sit directly above the gauge, and running one left
// it reading the count from before the call. A gauge that doesn't move when you
// spend is worse than no gauge, so the panels say when they've spent.
//
// Deliberately an event and not shared state: nothing needs to know how many
// calls happened, only that the number on screen is now stale.

const EVENT = "sidequest:ai-spent";

/** Call after any Server Action that may have billed — success or failure. */
export function announceAiCall() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(EVENT));
}

/** Subscribe. Returns the unsubscribe, shaped for a useEffect cleanup. */
export function onAiCall(handler: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
}
