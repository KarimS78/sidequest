import { Landing } from "@/components/landing";
import { aiStatus } from "@/lib/ai";

/**
 * The landing, rendered on the server so the pricing grid can report what THIS
 * deployment is actually able to do.
 *
 * The three plans used to be static copy, and the live site had neither key:
 * the free column promised a Steam import that returned a demo shelf, and the
 * paid column listed three AI features that could not run at all. Nothing on
 * the page admitted it. Capability is read here instead, so the grid corrects
 * itself the moment a key is added rather than waiting for someone to notice.
 */
export default function LandingPage() {
  return (
    <Landing
      caps={{
        steam: Boolean(process.env.STEAM_API_KEY?.trim()),
        // The same check the app itself runs, so the grid and the profile's
        // gauge can never disagree about whether the model is reachable.
        ai: aiStatus().on,
        // No packaged build exists yet. When there is something to download,
        // this becomes the check for it.
        overlay: false,
      }}
    />
  );
}
