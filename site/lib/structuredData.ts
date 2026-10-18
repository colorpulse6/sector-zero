// Structured data for the Sector Zero hub.
//
// The author node deliberately uses the same @id as every other site this
// person builds. In schema.org the @id *is* the identity, so a per-domain
// identifier would declare a different person on each site and leave search
// engines with several near-duplicate entities instead of one.

export const SITE_URL = "https://colorpulse6.github.io/sector-zero";
export const CREATOR_ID = "https://nichalasbarnes.com/#person";

export const CREATOR = {
  "@type": "Person",
  "@id": CREATOR_ID,
  name: "Nichalas Barnes",
  alternateName: "Nic Barnes",
  url: "https://nichalasbarnes.com/",
  sameAs: [
    "https://github.com/colorpulse6",
    "https://www.linkedin.com/in/nic-barnes-a3297217/",
  ],
} as const;

export const VIDEO_GAME_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "VideoGame",
  "@id": `${SITE_URL}/#game`,
  name: "Sector Zero",
  url: `${SITE_URL}/`,
  description:
    "Explore a persistent frontier in your browser. Travel between worlds, develop colonies, and take on space combat, turret defense and first-person missions.",
  genre: ["Space adventure", "Space shooter"],
  gamePlatform: "Web browser",
  applicationCategory: "Game",
  operatingSystem: "Web",
  isAccessibleForFree: true,
  author: CREATOR,
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
} as const;

export function serializeJsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
