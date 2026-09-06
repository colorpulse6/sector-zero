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
    id: "boarding",
    name: "Boarding actions",
    tagline: "02",
    description:
      "Breach enemy ships. Fight through narrow corridors, break line of sight, and hunt for salvage.",
    slug: "ship-boarding",
    image: "/images/modes/boarding.png",
    imageDescription: "a top-down view of an enemy ship interior",
  },
  {
    id: "raycaster",
    name: "First-person exploration",
    tagline: "03",
    description:
      "Step out of the cockpit. Explore abandoned stations and face the threats waiting around the next corner.",
    slug: "first-person-raycaster",
    image: "/images/modes/raycaster.png",
    imageDescription: "a first-person view down a station corridor",
  },
  {
    id: "ground",
    name: "Ground assault",
    tagline: "04",
    description:
      "Take the fight planetside. Jump between platforms and push through hostile terrain on foot.",
    slug: "ground-run-and-gun",
    image: "/images/modes/ground.png",
    imageDescription: "a pilot crosses a side-scrolling alien landscape",
  },
  {
    id: "turret",
    name: "Turret defense",
    tagline: "05",
    description:
      "Take the Vanguard’s gunner seat. Track incoming fighters and hold the line through waves of attackers.",
    slug: "ship-turret",
    image: "/images/modes/turret.png",
    imageDescription: "the gunner’s view from the Vanguard turret",
  },
  {
    id: "multiphase",
    name: "Multi-phase missions",
    tagline: "06",
    description:
      "Go from space combat to boarding and beyond in connected missions that test every part of your loadout.",
    slug: "multi-phase-levels",
    image: "/images/modes/multiphase.png",
    imageDescription:
      "the Revenant boss encounter during a multi-phase mission",
  },
];
