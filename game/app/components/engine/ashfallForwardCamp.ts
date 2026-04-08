import { SPRITES } from "./sprites";
import type {
  BoardingMap,
  BoardingTileType,
  FPNPC,
  FPProp,
  FirstPersonState,
} from "./types";

const TILE_SIZE = 32;

function parseMap(lines: string[]): BoardingMap {
  const tiles = lines.map((line) =>
    line.split("").map((ch): BoardingTileType => {
      switch (ch) {
        case "#":
          return "wall";
        case ".":
          return "floor";
        case "D":
          return "door";
        case "S":
          return "spawn";
        case "G":
          return "goal";
        default:
          return "empty";
      }
    })
  );

  return {
    width: tiles[0]?.length ?? 0,
    height: tiles.length,
    tileSize: TILE_SIZE,
    tiles,
  };
}

const ASHFALL_CAMP_MAP = parseMap([
  "###########################",
  "#.........................#",
  "#..S.............#........#",
  "#................#........#",
  "#....######......#........#",
  "#....#....#......#........#",
  "#....#....D......#........#",
  "#....#....#......#........#",
  "#....######......#........#",
  "#................D........#",
  "#................#........#",
  "#................#........#",
  "#....#######..............#",
  "#....#.....#..............#",
  "#....D.....D..............#",
  "#....#.....#..............#",
  "#....#######......####....#",
  "#.................#..#....#",
  "#.................D..D....#",
  "#.................#..#....#",
  "#.................####....#",
  "#.........................#",
  "#....................G....#",
  "#.........................#",
  "###########################",
]);

const ASHFALL_CAMP_NPCS: FPNPC[] = [
  {
    id: 1,
    x: 6.5,
    y: 6.5,
    name: "Commander Voss",
    type: "quest",
    color: "#44ccff",
    interacted: false,
    dialog: [
      { speaker: "VOSS", text: "We put this camp together fast. Treat it like a field line, not a home base." },
      { speaker: "VOSS", text: "Ashfall keeps eating hardware, so we need those remote sensors back before the sand buries them for good." },
      { speaker: "VOSS", text: "Talk to Reyes if you need supplies. Kael has the last clean scan of the perimeter." },
    ],
  },
  {
    id: 2,
    x: 6.5,
    y: 14.5,
    name: "Lt. Reyes",
    type: "merchant",
    color: "#ffaa44",
    interacted: false,
    dialog: [
      { speaker: "REYES", text: "Forward camp inventory is thin, but it's enough to keep you moving." },
      { speaker: "REYES", text: "If you're heading out past the gate, top off here first." },
    ],
    shopItems: [
      { id: "hull-repair", name: "Hull Repair Kit", description: "Restore 1 HP", cost: 100, type: "consumable", itemId: "hull-repair-kit" },
      { id: "scanner", name: "Scanner Pulse", description: "Reveal enemy affinities", cost: 150, type: "consumable", itemId: "scanner-pulse" },
      { id: "desert-glass", name: "Desert Glass", description: "Ashfall crafting material", cost: 250, type: "material", itemId: "desert-glass" },
    ],
  },
  {
    id: 3,
    x: 20.5,
    y: 18.5,
    name: "Doc Kael",
    type: "lore",
    color: "#44ff88",
    interacted: false,
    dialog: [
      { speaker: "KAEL", text: "The camp rig is reading a dead patch in the dunes. That usually means something important is still transmitting." },
      { speaker: "KAEL", text: "One of our field sensors dropped near the wreck pocket south-east of the camp." },
      { speaker: "KAEL", text: "Bring it back intact and we can map the subsurface wrecks without walking blind into them." },
    ],
  },
];

const ASHFALL_CAMP_PROPS: FPProp[] = [
  { id: 1, x: 12.5, y: 8.4, sprite: SPRITES.EXPLORE_OUTPOST_LANDMARK_RIG, scale: 1.45, label: "CAMP RIG" },
  { id: 2, x: 10.5, y: 11.2, sprite: SPRITES.EXPLORE_OUTPOST_PROP_CRATES, scale: 0.95 },
  { id: 3, x: 14.2, y: 11.4, sprite: SPRITES.EXPLORE_OUTPOST_PROP_ANTENNA, scale: 1.05 },
  { id: 4, x: 8.2, y: 16.7, sprite: SPRITES.EXPLORE_OUTPOST_PROP_TERMINAL, scale: 0.9 },
  { id: 5, x: 16.8, y: 15.4, sprite: SPRITES.EXPLORE_OUTPOST_PROP_LAMP, scale: 0.9 },
  { id: 6, x: 18.6, y: 20.5, sprite: SPRITES.EXPLORE_OUTPOST_PROP_SIGNPOST, scale: 0.85 },
  { id: 7, x: 22.2, y: 21.5, sprite: SPRITES.EXPLORE_OUTPOST_PROP_CABLE_SPOOL, scale: 0.95 },
  { id: 8, x: 21.4, y: 22.1, sprite: SPRITES.EXPLORE_OUTPOST_PROP_BARREL, scale: 0.9 },
];

function getSpawn(map: BoardingMap): { x: number; y: number } {
  for (let row = 0; row < map.height; row++) {
    for (let col = 0; col < map.width; col++) {
      if (map.tiles[row][col] === "spawn") {
        return { x: col + 0.5, y: row + 0.5 };
      }
    }
  }

  return { x: 2.5, y: 2.5 };
}

export function createAshfallForwardCampState(): FirstPersonState {
  const spawn = getSpawn(ASHFALL_CAMP_MAP);

  return {
    map: ASHFALL_CAMP_MAP,
    posX: spawn.x,
    posY: spawn.y,
    dirX: 1,
    dirY: 0,
    planeX: 0,
    planeY: 0.66,
    moveSpeed: 0.06,
    rotSpeed: 0.04,
    goalReached: false,
    objectivePickup: {
      x: 22.5,
      y: 22.5,
      label: "FIELD SENSOR",
    },
    objectiveCollected: false,
    enemies: [],
    gunFireTimer: 0,
    gunCooldown: 0,
    npcs: ASHFALL_CAMP_NPCS.map((npc) => ({
      ...npc,
      dialog: npc.dialog.map((line) => ({ ...line })),
      shopItems: npc.shopItems?.map((item) => ({ ...item })),
    })),
    dialogState: null,
    environmentArt: {
      skySprite: SPRITES.EXPLORE_OUTPOST_SKY,
      wallSprite: SPRITES.EXPLORE_OUTPOST_WALL_EXTERIOR,
      floorSprite: SPRITES.EXPLORE_OUTPOST_GROUND,
    },
    props: ASHFALL_CAMP_PROPS.map((prop) => ({ ...prop })),
    missionLabel: "ASHFALL FORWARD CAMP",
  };
}

if (process.env.NODE_ENV !== "production") {
  const state = createAshfallForwardCampState();
  console.assert(state.npcs.length >= 3, "Ashfall camp should have at least 3 NPCs");
  console.assert(Boolean(state.objectivePickup), "Ashfall camp should define an objective pickup");
  console.assert((state.props?.length ?? 0) >= 1, "Ashfall camp should define at least one prop");
}
