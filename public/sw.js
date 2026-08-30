/**
 * SideQuest service worker — hand-written, no workbox / next-pwa.
 *
 * Strategy:
 *   - precache the shell ("/", "/offline", icons) on install
 *   - navigations   -> network-first, fall back to cache, then /offline
 *   - static assets  -> cache-first (/_next/static/* is content-hashed, public/ icons)
 *   - everything else (RSC payloads, Server Actions, Steam / Supabase / AI calls)
 *     is left alone: no interception at all.
 *
 * Bump CACHE to invalidate; activate() drops every other cache we own.
 */

// v6: Studio Nuit held to its own rules, the real logo, both languages. "/" used to be a redirect to /play and the
// icons were the old drawn mark — both are precached here, so anyone who visited
// before would keep serving the previous ones until this string changes.
const CACHE = "sidequest-v6";

const PRECACHE = [
  "/",
  "/offline",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-maskable-512.png",
  "/apple-touch-icon.png",
  "/brand/mark-128.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      // one failed URL must not fail the whole install
      .then((cache) =>
        Promise.all(
          PRECACHE.map((url) =>
            cache.add(new Request(url, { cache: "reload" })).catch(() => {}),
          ),
        ),
      )
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("sidequest-") && key !== CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

/** Immutable, safe to serve from cache first. */
function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    /\.(?:png|jpg|jpeg|svg|webp|avif|gif|ico|woff2?)$/.test(url.pathname)
  );
}

self.addEventListener("fetch", (event) => {
  const request = event.request;

  // Never touch writes, and never touch another origin (Steam, Supabase, AI).
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request));
  }

  // Anything else (RSC payloads, route handlers) goes straight to the network.
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response && response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    return (
      (await cache.match(request)) ??
      (await cache.match("/offline")) ??
      new Response("You're offline.", {
        status: 503,
        headers: { "content-type": "text/plain; charset=utf-8" },
      })
    );
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response && response.ok) cache.put(request, response.clone());
  return response;
}
