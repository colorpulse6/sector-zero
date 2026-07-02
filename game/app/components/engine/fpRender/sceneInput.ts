import type { FirstPersonState, BoardingMap } from "../types";
import { SPRITES } from "../sprites";
import { TextureRegistry } from "./textures";
import { hslShiftToRgbMul, IDENTITY_TINT, type RgbMul } from "./lighting";

export interface BillboardInput {
  x: number; y: number;
  texId: number;
  scale: number;        // world-height scale (classic ×0.6 applied in core)
  alpha256: number;     // 256 = opaque; dying enemies fade
  widthFactor: number;  // width = height × this. NPCs are portraits: 0.4 (classic
                        //   firstPersonRenderer.ts:493). Enemies/props: 1.
  vAnchor: "center" | "npc" | "prop";
                        // vertical anchor, ported from classic draw math:
                        //   center → sy0 = half − size/2 (enemies)
                        //   npc    → sy0 = half − size/3 (feet on ground, :496)
                        //   prop   → sy0 = half − 0.55·size (:343-346)
  minSizeFrac?: number; // props: 20/714 of fb height (classic 20px floor, :344)
}

export interface RenderScene {
  camX: number; camY: number;
  dirX: number; dirY: number; planeX: number; planeY: number;
  map: {
    width: number; height: number;
    solid: Uint8Array;          // 1 = wall|empty (classic isWall semantics)
    wallTexture: Int16Array;    // texture id per tile, -1 = art.wallTexId
    floorTexture: Int16Array;   // Task 2; -1 = art.floorTexId
  };
  art: { skyTexId: number; wallTexId: number; floorTexId: number; ceilingTexId: number };
  billboards: BillboardInput[];
  noDepthBillboards: BillboardInput[];
  baseLight: Uint8Array | null;             // Task 3
  pointLights: { x: number; y: number; r: number; g: number; b: number; power: number }[];
  tint: RgbMul;
  doorTiles: Uint8Array | null;             // 1 = door tile (column glow metadata)
}

// Moved verbatim from firstPersonRenderer.ts (deleted there).
export const NPC_SPRITE_MAP: Record<string, string> = {
  "Commander Voss": SPRITES.NPC_VOSS,
  "Doc Kael": SPRITES.NPC_KAEL,
  "Lt. Reyes": SPRITES.NPC_REYES,
  "Survivor": SPRITES.NPC_SURVIVOR,
  "Scavenger": SPRITES.NPC_SCAVENGER,
};

export class SceneBuilder {
  private scene: RenderScene | null = null;
  private lastMap: BoardingMap | null = null;

  /** Last built scene — overlays (HP bars, tags, labels) project through it. */
  get lastBuilt(): RenderScene | null { return this.scene; }

  build(fp: FirstPersonState, reg: TextureRegistry): RenderScene {
    if (!this.scene) this.scene = emptyScene();
    const s = this.scene;

    if (fp.map !== this.lastMap) {           // map identity = invalidation key
      this.lastMap = fp.map;
      rebuildMapArrays(s, fp.map, reg);
    }

    s.camX = fp.posX; s.camY = fp.posY;
    s.dirX = fp.dirX; s.dirY = fp.dirY; s.planeX = fp.planeX; s.planeY = fp.planeY;

    const art = fp.environmentArt;
    s.art.skyTexId = reg.idFor(art?.skySprite, "sky");
    s.art.wallTexId = reg.idFor(art?.wallSprite ?? SPRITES.BOARDING_TILES, "tile");
    s.art.floorTexId = reg.idFor(art?.floorSprite, "tile");
    s.art.ceilingTexId = reg.idFor(art?.ceilingSprite, "tile");
    s.tint = art?.environmentTint ? hslShiftToRgbMul(art.environmentTint) : IDENTITY_TINT;

    s.billboards.length = 0;
    s.noDepthBillboards.length = 0;
    for (const p of fp.props ?? []) {
      s.billboards.push({ x: p.x, y: p.y, texId: reg.idFor(p.sprite, "billboard"), scale: p.scale ?? 1, alpha256: 256, widthFactor: 1, vAnchor: "prop", minSizeFrac: 20 / 714 });
    }
    for (const e of fp.enemies) {
      if (e.deathTimer === -1) continue;
      // PORTED VERBATIM: frame selection + fade from the classic
      // drawEnemyBillboards (firstPersonRenderer.ts:239-267): death frame while
      // deathTimer > 0 with alpha = deathTimer/30; flinch frame while damaged
      // (hp < maxHp); front frame otherwise.
      const sprite = e.deathTimer > 0 ? SPRITES.FP_ENEMY_DEATH
        : e.hp < e.maxHp ? SPRITES.FP_ENEMY_FLINCH
        : SPRITES.FP_ENEMY_FRONT;
      const alpha = e.deathTimer > 0 ? Math.round((e.deathTimer / 30) * 256) : 256;
      s.billboards.push({ x: e.x, y: e.y, texId: reg.idFor(sprite, "billboard"), scale: 1, alpha256: alpha, widthFactor: 1, vAnchor: "center" });
    }
    for (const n of fp.npcs) {
      s.billboards.push({ x: n.x, y: n.y, texId: reg.idFor(NPC_SPRITE_MAP[n.name] ?? SPRITES.NPC_SURVIVOR, "billboard"), scale: 1, alpha256: 256, widthFactor: 0.4, vAnchor: "npc" });
    }
    // Objective marker: NOT pushed here. It stays the classic overlay
    // (drawObjectiveBillboard — glow + label are vector draws that already
    // render over everything, satisfying the spec's through-wall exception).
    // noDepthBillboards stays as the generic no-z-test mechanism (golden 8b
    // exercises it via fixtures); nothing populates it yet.
    // Task 3 fills these; identity until then:
    s.baseLight = null; s.pointLights.length = 0;
    return s;
  }
}

function rebuildMapArrays(s: RenderScene, map: BoardingMap, reg: TextureRegistry): void {
  const { width, height } = map;
  s.map.width = width; s.map.height = height;
  s.map.solid = new Uint8Array(width * height);
  s.map.wallTexture = new Int16Array(width * height).fill(-1);
  s.map.floorTexture = new Int16Array(width * height).fill(-1);
  s.doorTiles = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const t = map.tiles[y][x];
      const i = y * width + x;
      if (t === "wall" || t === "empty") s.map.solid[i] = 1;
      if (t === "door") s.doorTiles[i] = 1;
      const override = map.wallTextureMap?.[y]?.[x];
      if (override) s.map.wallTexture[i] = reg.idFor(override, "tile");
    }
  }
}

function emptyScene(): RenderScene {
  return {
    camX: 0, camY: 0, dirX: 1, dirY: 0, planeX: 0, planeY: 0.66,
    map: {
      width: 0, height: 0,
      solid: new Uint8Array(0),
      wallTexture: new Int16Array(0),
      floorTexture: new Int16Array(0),
    },
    art: { skyTexId: -1, wallTexId: -1, floorTexId: -1, ceilingTexId: -1 },
    billboards: [], noDepthBillboards: [],
    baseLight: null, pointLights: [],
    tint: IDENTITY_TINT,
    doorTiles: null,
  };
}
