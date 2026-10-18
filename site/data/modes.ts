export interface GameMode {
  id: string;
  name: string;
  tagline: string;
  description: string;
  slug: string;
  image: string;
  imageDescription: string;
}

export const GAME_MODES: GameMode[] = [
  {
    id: "shooter",
    name: "Space combat",
    tagline: "01",
    description:
      "Pilot your fighter through enemy formations and take on the bosses guarding eight hostile sectors.",
    slug: "vertical-shooter",
    image: "/images/modes/shooter.png",
    imageDescription: "a fighter battles through the Hollow Core",
  },
  {
    id: "raycaster",
    name: "First-person exploration",
    tagline: "02",
    description:
      "Step out of the cockpit. Explore abandoned stations and face the threats waiting around the next corner.",
    slug: "first-person-raycaster",
    image: "/images/modes/raycaster.png",
    imageDescription: "a first-person view down a station corridor",
  },
  {
    id: "turret",
    name: "Turret defense",
    tagline: "03",
    description:
      "Take the Vanguard’s gunner seat. Track incoming fighters and hold the line through waves of attackers.",
    slug: "ship-turret",
    image: "/images/modes/turret.png",
    imageDescription: "the gunner’s view from the Vanguard turret",
  },
  {
    id: "multiphase",
    name: "Multi-phase missions",
    tagline: "04",
    description:
      "Move between space combat, turret defense and first-person encounters as an operation unfolds.",
    slug: "multi-phase-levels",
    image: "/images/modes/multiphase.png",
    imageDescription:
      "the Revenant boss encounter during a multi-phase mission",
  },
];
