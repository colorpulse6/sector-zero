export interface GameMode {
  id: string;
  name: string;
  tagline: string;
  description: string;
  slug: string;
  image: string;
}

export const GAME_MODES: GameMode[] = [
  {
    id: "shooter",
    name: "Vertical Shooter",
    tagline: "MODE 01",
    description: "8 worlds, 40 levels, multi-phase bosses. The original campaign.",
    slug: "vertical-shooter",
    image: "/images/modes/shooter.png",
  },
  {
    id: "ground",
    name: "Ground Run & Gun",
    tagline: "MODE 02",
    description: "Contra-style side-scrolling with gravity, jumping, and 4+ enemy types.",
    slug: "ground-run-and-gun",
    image: "/images/modes/ground.png",
  },
  {
    id: "boarding",
    name: "Ship Boarding",
    tagline: "MODE 03",
    description: "Top-down dungeon crawler with corridors and line-of-sight AI.",
    slug: "ship-boarding",
    image: "/images/modes/boarding.png",
  },
  {
    id: "raycaster",
    name: "First-Person Raycaster",
    tagline: "MODE 04",
    description: "Wolfenstein-style 3D with textured walls, billboard enemies, and hitscan combat.",
    slug: "first-person-raycaster",
    image: "/images/modes/raycaster.png",
  },
  {
    id: "turret",
    name: "Ship Turret",
    tagline: "MODE 05",
    description: "Star Wars gunner mode with mouse-aim crosshair and 5 waves of enemies.",
    slug: "ship-turret",
    image: "/images/modes/turret.png",
  },
  {
    id: "multiphase",
    name: "Multi-Phase Levels",
    tagline: "MODE 06",
    description: "Cinematic transitions chain different modes into epic multi-part missions.",
    slug: "multi-phase-levels",
    image: "/images/modes/multiphase.png",
  },
];
