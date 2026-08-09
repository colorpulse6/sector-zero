// Structured data for the Sector Zero hub.
//
// The author node deliberately uses the same @id as every other site this
// person builds. In schema.org the @id *is* the identity, so a per-domain
// identifier would declare a different person on each site and leave search
// engines with several near-duplicate entities instead of one.

export const SITE_URL = "https://colorpulse6.github.io/knicks-knacks/sector-zero";
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
    "Pilot a strike fighter through 8 sectors of hostile space. 6 gameplay modes, RPG progression, and the Hollow awaits.",
  genre: ["Space shooter", "Roguelite"],
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
