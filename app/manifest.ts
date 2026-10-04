import type { MetadataRoute } from "next";

/** The installable agent app: opens on the mobile dashboard, standalone, in the Nakhla navy. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Nakhla for agents",
    short_name: "Nakhla",
    description: "Leads, listings, deals and commissions on the phone, with offline access and notifications.",
    start_url: "/m/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#FAFAF9",
    theme_color: "#0A1F44",
    categories: ["business", "productivity"],
    icons: [
      { src: "/pwa/icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa/icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa/icon/512?maskable=1", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Leads", url: "/m/leads" },
      { name: "Deals", url: "/m/deals" },
    ],
  };
}
