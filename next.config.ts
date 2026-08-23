import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Screenshots are downscaled client-side (~200-500KB), but allow headroom.
    serverActions: { bodySizeLimit: "2mb" },
  },
  images: {
    // Steam's public art CDN — cover art is the only remote image in the app.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.cloudflare.steamstatic.com",
        pathname: "/steam/apps/**",
      },
    ],
  },
};

export default nextConfig;
