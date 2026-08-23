import { redirect } from "next/navigation";

/**
 * The Spin is the home screen. There is no landing page: the app's whole
 * proposition is answered by opening it, and the demo runs on the sample
 * library without any connection step.
 */
export default function Home() {
  redirect("/play");
}
