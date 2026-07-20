import type { MetadataRoute } from "next";

/**
 * The web app manifest (Module 6 — PWA pass): installable, home-screen
 * ready, no service-worker theater. Colors are the house void from the
 * frens.earth main theme; icons are the existing sprout-planet mark
 * (src/app/icon.svg) rasterized — reused, never reinvented.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "frens.earth",
    short_name: "frens.earth",
    description:
      "Free sovereign bitcoin handles. Your name, your keys — verifiable on nostr today, permanent on Bitcoin at the next batch.",
    start_url: "/",
    display: "standalone",
    background_color: "#0d1210",
    theme_color: "#0d1210",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}
