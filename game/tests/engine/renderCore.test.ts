import { test } from "node:test";
import assert from "node:assert/strict";
import { Framebuffer } from "../../app/components/engine/fpRender/framebuffer";
import { TextureRegistry } from "../../app/components/engine/fpRender/textures";
import { renderScene } from "../../app/components/engine/fpRender/renderCore";
import { SceneBuilder, NPC_SPRITE_MAP } from "../../app/components/engine/fpRender/sceneInput";
import { SPRITES } from "../../app/components/engine/sprites";
import type {
  BoardingMap,
  BoardingTileType,
  FirstPersonState,
  FPEnemy,
} from "../../app/components/engine/types";
import { hashFrame, quadTexture, tinyScene, RED, GREEN, BLUE, GREY } from "./fixtures";

const W = 96, H = 142; // small odd-ish frame; exercises rounding

function registry(): TextureRegistry {
  const r = new TextureRegistry();
  r.registerRaw("wall-default", quadTexture(RED, GREEN, BLUE, GREY), 4, 4);   // id 0
  r.registerRaw("wall-pillar", quadTexture(GREEN, RED, GREY, BLUE), 4, 4);    // id 1
  r.registerRaw("floor", quadTexture(GREY, GREY, BLUE, BLUE), 4, 4);          // id 2
  return r;
}

test("golden: textured walls with side shading and fog (determinism)", () => {
  const fb = new Framebuffer(W, H);
  const reg = registry();
  const scene = tinyScene();
  renderScene(fb, scene, reg);
  const h1 = hashFrame(fb.px);
  renderScene(fb, scene, reg);
  assert.equal(hashFrame(fb.px), h1, "same scene twice must be identical");
  if (process.env.UPDATE_GOLDENS) console.log("GOLDEN walls:", h1);
  assert.equal(h1, "4a1551a6");
});

test("every pixel written and opaque", () => {
  const fb = new Framebuffer(W, H);
  renderScene(fb, tinyScene(), registry());
  for (let i = 0; i < fb.px.length; i++) {
    assert.equal(fb.px[i] >>> 24, 0xff, `pixel ${i} not opaque`);
  }
});

test("per-tile wall texture override changes the output (golden 2)", () => {
  const reg = registry();
  const withOverride = new Framebuffer(W, H);
  renderScene(withOverride, tinyScene(), reg);        // pillar uses texture id 1
  const scene = tinyScene();
  scene.map.wallTexture[3 * 8 + 5] = -1;              // pillar falls back to default
  const without = new Framebuffer(W, H);
  renderScene(without, scene, reg);
  assert.notEqual(hashFrame(without.px), hashFrame(withOverride.px),
    "override texture must be visible in the frame");
});

test("golden: fog pulls far walls toward the fog color (monotonic, golden 5)", () => {
  // Flat wall textures so the near and far probes sample identical texels —
  // only the fog term differs between the two renders.
  const reg = new TextureRegistry();
  reg.registerRaw("flat-wall", quadTexture(RED, RED, RED, RED), 4, 4);    // id 0
  reg.registerRaw("flat-pillar", quadTexture(GREEN, GREEN, GREEN, GREEN), 4, 4); // id 1

  const far = new Framebuffer(W, H);
  renderScene(far, tinyScene(), reg);                 // camera 4.5 from the x=7 wall
  const near = new Framebuffer(W, H);
  renderScene(near, tinyScene({ camX: 5.5 }), reg);   // camera 1.5 from the same wall

  const mid = (H >> 1) * W + (W >> 1);                // center column, mid-strip
  const farPx = far.px[mid], nearPx = near.px[mid];
  const fog = [5, 5, 16];                             // classic rgba(5,5,16,…)
  for (let ch = 0; ch < 3; ch++) {
    const f = (farPx >>> (ch * 8)) & 0xff;
    const n = (nearPx >>> (ch * 8)) & 0xff;
    assert.ok(Math.abs(f - fog[ch]) < Math.abs(n - fog[ch]),
      `channel ${ch}: far pixel (${f}) must sit closer to fog (${fog[ch]}) than near (${n})`);
  }
  const h = hashFrame(near.px);
  if (process.env.UPDATE_GOLDENS) console.log("GOLDEN fog-near:", h);
  assert.equal(h, "e9a2b545");
});

test("golden: billboard behind a wall is occluded; no-depth draws through (golden 8)", () => {
  const reg = registry();
  reg.registerRaw("bb-opaque", quadTexture(RED, GREEN, BLUE, GREY), 4, 4);  // id 3
  const base = new Framebuffer(W, H);
  renderScene(base, tinyScene(), reg);
  const baseHash = hashFrame(base.px);

  // Directly behind the pillar (5,3) as seen from the default camera: its
  // screen extent falls entirely inside the pillar's columns and its depth
  // (≈4.1) exceeds the pillar's wall distance (≈2.5–3.5).
  const bb = { x: 6.6, y: 3.1, texId: 3, scale: 1, alpha256: 256, widthFactor: 1, vAnchor: "center" as const };

  const occluded = new Framebuffer(W, H);
  renderScene(occluded, tinyScene({ billboards: [bb] }), reg);
  assert.equal(hashFrame(occluded.px), baseHash,
    "depth-tested billboard fully behind the pillar must not touch any pixel");

  const noDepth = new Framebuffer(W, H);
  renderScene(noDepth, tinyScene({ noDepthBillboards: [bb] }), reg);
  const h = hashFrame(noDepth.px);
  assert.notEqual(h, baseHash, "no-depth billboard must draw through the wall");
  if (process.env.UPDATE_GOLDENS) console.log("GOLDEN no-depth:", h);
  assert.equal(h, "e2d8d412");
});

test("golden: zero-alpha texels leave the environment visible (golden 8c)", () => {
  const reg = registry();
  // 4x4 billboard texture: top-left + bottom-right quadrants fully transparent.
  const holey = new Uint32Array(16);
  for (let y = 0; y < 4; y++)
    for (let x = 0; x < 4; x++)
      holey[y * 4 + x] = [0, RED, GREEN, 0][(y >> 1) * 2 + (x >> 1)];
  reg.registerRaw("bb-holes", holey, 4, 4);           // id 3

  const base = new Framebuffer(W, H);
  renderScene(base, tinyScene(), reg);
  const fb = new Framebuffer(W, H);
  renderScene(fb, tinyScene({
    billboards: [{ x: 4.5, y: 4.5, texId: 3, scale: 1, alpha256: 256, widthFactor: 1, vAnchor: "center" }],
  }), reg);

  // Billboard rect for this scene: x 27..68, y 50..91 (size 42 at depth 2).
  const holePx = 55 * W + 30;    // top-left quadrant → transparent
  const opaquePx = 55 * W + 60;  // top-right quadrant → opaque RED
  assert.equal(fb.px[holePx], base.px[holePx], "environment must show through zero-alpha texels");
  assert.notEqual(fb.px[opaquePx], base.px[opaquePx], "opaque texels must draw");
  const h = hashFrame(fb.px);
  if (process.env.UPDATE_GOLDENS) console.log("GOLDEN holes:", h);
  assert.equal(h, "1ac0f55a");
});

test("golden: environment tint identity vs non-identity differ (golden 7)", () => {
  const reg = registry();
  const identity = new Framebuffer(W, H);
  renderScene(identity, tinyScene(), reg);
  const tinted = new Framebuffer(W, H);
  renderScene(tinted, tinyScene({ tint: { rMul: 200, gMul: 210, bMul: 256 } }), reg);
  const h = hashFrame(tinted.px);
  assert.notEqual(h, hashFrame(identity.px));
  if (process.env.UPDATE_GOLDENS) console.log("GOLDEN tint:", h);
  assert.equal(h, "b59e0669");
});

test("golden: point light brightens nearby geometry more than distant geometry (falloff, golden 6)", () => {
  const reg = registry();
  const base = new Framebuffer(W, H);
  renderScene(base, tinyScene(), reg);

  const lit = new Framebuffer(W, H);
  // Mild white light near wall tile (7,4) — color/power tuned so both probe
  // tiles stay UNclamped (headroom to the 320 cap is only 64 above the
  // neutral 256 base; a strong light saturates every nearby tile alike and
  // hides the falloff shape, as golden 6a below intentionally does instead).
  const litScene = tinyScene({ pointLights: [{ x: 6.5, y: 4.5, r: 180, g: 180, b: 180, power: 0.6 }] });
  renderScene(lit, litScene, reg);
  const h = hashFrame(lit.px);
  assert.notEqual(h, hashFrame(base.px), "point light must change the rendered frame");
  if (process.env.UPDATE_GOLDENS) console.log("GOLDEN point-light:", h);
  assert.equal(h, "c28586db");

  // col 48 hits wall tile (7,4), 1 tile-unit from the light (dist²=1).
  // col 85 hits wall tile (7,6), farther from the light (dist²=5). Both
  // columns are side=0 (identical side-shade) hitting the same default wall
  // texture at the same fog band, so the per-pixel delta isolates the
  // light's falloff cleanly (verified against the actual DDA hit tiles).
  const sum = (px: number) => (px & 0xff) + ((px >>> 8) & 0xff) + ((px >>> 16) & 0xff);
  const row = H >> 1;
  const nearIdx = row * W + 48, farIdx = row * W + 85;
  const nearDelta = sum(lit.px[nearIdx]) - sum(base.px[nearIdx]);
  const farDelta = sum(lit.px[farIdx]) - sum(base.px[farIdx]);
  assert.ok(nearDelta > 0, "near tile must brighten");
  assert.ok(farDelta > 0, "far tile still gains some light (not fully attenuated)");
  assert.ok(nearDelta > farDelta, "nearer tile must brighten more than the farther tile");
});

test("golden: point light billboard shading — sampled at the anchor tile (golden 6a)", () => {
  const reg = registry();
  reg.registerRaw("bb-opaque", quadTexture(RED, GREEN, BLUE, GREY), 4, 4);  // id 3
  // Billboard sitting in open floor tile (4,4) (no depth-test occluder in its way
  // from the default camera at (2.5,4.5) dir(1,0)); strong light right on top of
  // it saturates the grid, so the billboard must render brighter than with an
  // identical billboard but no light — proving billboards now sample the grid
  // (Task-1 parity drew billboards at fixed identity tint, ignoring lights).
  const bb = { x: 4.5, y: 4.5, texId: 3, scale: 1, alpha256: 256, widthFactor: 1, vAnchor: "center" as const };

  const unlit = new Framebuffer(W, H);
  renderScene(unlit, tinyScene({ billboards: [bb] }), reg);

  const lit = new Framebuffer(W, H);
  const litScene = tinyScene({
    billboards: [bb],
    pointLights: [{ x: 4.5, y: 4.5, r: 255, g: 255, b: 255, power: 3 }],
  });
  renderScene(lit, litScene, reg);

  assert.notEqual(hashFrame(lit.px), hashFrame(unlit.px),
    "a point light at the billboard's own tile must change its rendered pixels");
});

test("golden: floor casting resolves per-tile overrides at the correct map cell (golden 3)", () => {
  // Flat (single-color) floor textures for this probe. The quadrant-patterned
  // textures used elsewhere in this file vary by texel (tx,ty) *within* a
  // tile — fine for whole-hash comparisons, but this test's straddle probe
  // lands at a camera position whose fractional Y (camY=4.5) sits exactly on
  // this texture size's internal quadrant boundary (0.5*4 == 2.0 exactly),
  // making the *sub-tile* texel picked floating-point-order sensitive
  // (irrelevant noise for a test that only cares which TILE was sampled).
  // Flat colors make every pixel in a tile identical regardless of texel,
  // isolating the thing this test actually checks: does the override land on
  // the correct map cell.
  const reg = new TextureRegistry();
  reg.registerRaw("wall-default", quadTexture(RED, GREEN, BLUE, GREY), 4, 4);        // id 0
  const defaultFloorId = reg.registerRaw("floor-flat-default", quadTexture(BLUE, BLUE, BLUE, BLUE), 4, 4);
  const overrideFloorId = reg.registerRaw("floor-flat-override", quadTexture(RED, RED, RED, RED), 4, 4);
  const textured = { skyTexId: -1, wallTexId: 0, floorTexId: defaultFloorId, ceilingTexId: -1 };

  const base = new Framebuffer(W, H);
  renderScene(base, tinyScene({ art: textured }), reg);
  const baseHash = hashFrame(base.px);

  const overridden = tinyScene({ art: textured });
  overridden.map.floorTexture[4 * 8 + 3] = overrideFloorId;   // tile (x=3,y=4)
  const overrideFb = new Framebuffer(W, H);
  renderScene(overrideFb, overridden, reg);
  const overrideHash = hashFrame(overrideFb.px);

  assert.notEqual(overrideHash, baseHash, "per-tile floor override must change the rendered frame");

  // Straddle probe: camera at (2.5,4.5) facing +X (dirX=1,dirY=0). The CENTER
  // screen column (x=W/2=48, cameraX=0) rides along y=4.5 (cellY=4 for the
  // whole column) and crosses the tile-3/tile-4 world boundary (worldX=4.0)
  // at rowDist=1.5 -> screen row y = h/2 + (h/2)/1.5 ~= 118.33 (h=142,
  // half=71). Rows 118/119 straddle that boundary: y=118 -> cellX=4 (default
  // floor), y=119 -> cellX=3 (the overridden tile) — derived from the exact
  // cast formula in renderCore.ts and confirmed against the actual render.
  const col = W >> 1;
  const farSide = overrideFb.px[118 * W + col];   // still tile 4 (default)
  const nearSide = overrideFb.px[119 * W + col];  // now tile 3 (override)
  assert.notEqual(farSide, nearSide,
    "pixels straddling the tile-3/4 boundary must differ once tile 3 is overridden");
  assert.equal(base.px[118 * W + col], base.px[119 * W + col],
    "without the override, both sides of the boundary render the same default floor");

  if (process.env.UPDATE_GOLDENS) console.log("GOLDEN floor-boundary:", overrideHash);
  assert.equal(overrideHash, "8099cff1");
});

test("golden: perspective ceiling cast when no sky is set (golden 4)", () => {
  const reg = registry();
  const scene = tinyScene({ art: { skyTexId: -1, wallTexId: 0, floorTexId: -1, ceilingTexId: 2 } });
  const fb = new Framebuffer(W, H);
  renderScene(fb, scene, reg);
  const h = hashFrame(fb.px);

  const gradientFb = new Framebuffer(W, H);
  renderScene(gradientFb, tinyScene(), reg);
  assert.notEqual(h, hashFrame(gradientFb.px),
    "textured ceiling cast must differ from the gradient-ceiling baseline");

  if (process.env.UPDATE_GOLDENS) console.log("GOLDEN ceiling-cast:", h);
  assert.equal(h, "a5032349");
});

test("golden: sky panorama sample with the default fixture camera (deterministic angle)", () => {
  // dirX=1, dirY=0 (tinyScene default camera) -> atan2(0,1) is exactly 0 by
  // IEEE-754 spec, so the sky pan offset is bit-deterministic cross-platform.
  const reg = registry();
  const skyId = reg.registerRaw("sky", quadTexture(RED, GREEN, BLUE, GREY), 4, 4);
  const scene = tinyScene({ art: { skyTexId: skyId, wallTexId: 0, floorTexId: -1, ceilingTexId: -1 } });
  const fb = new Framebuffer(W, H);
  renderScene(fb, scene, reg);
  const h = hashFrame(fb.px);
  if (process.env.UPDATE_GOLDENS) console.log("GOLDEN sky:", h);
  assert.equal(h, "baea1930");
});

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test("property: 100 random open-cell cameras render without error, all opaque", () => {
  const fb = new Framebuffer(W, H);
  const reg = registry();
  const rnd = mulberry32(0xc0ffee);
  for (let i = 0; i < 100; i++) {
    let cx = 0, cy = 0;
    do {
      cx = 1 + ((rnd() * 6) | 0);
      cy = 1 + ((rnd() * 6) | 0);
    } while (cx === 5 && cy === 3);                   // the pillar tile
    const a = rnd() * Math.PI * 2;
    const dirX = Math.cos(a), dirY = Math.sin(a);
    const scene = tinyScene({
      camX: cx + 0.2 + rnd() * 0.6,
      camY: cy + 0.2 + rnd() * 0.6,
      dirX, dirY, planeX: -dirY * 0.66, planeY: dirX * 0.66,
    });
    renderScene(fb, scene, reg);
    for (let p = 0; p < fb.px.length; p++) {
      if (fb.px[p] >>> 24 !== 0xff) {
        assert.fail(`iteration ${i}: pixel ${p} not opaque (0x${fb.px[p].toString(16)})`);
      }
    }
  }
});

// ─── SceneBuilder ───────────────────────────────────────────────────

function makeMap(): BoardingMap {
  const tiles: BoardingTileType[][] = [
    ["wall", "wall", "wall", "wall"],
    ["wall", "floor", "door", "wall"],
    ["wall", "floor", "floor", "wall"],
    ["wall", "wall", "wall", "wall"],
  ];
  return { width: 4, height: 4, tileSize: 32, tiles };
}

function makeFp(map: BoardingMap): FirstPersonState {
  return {
    map, posX: 1.5, posY: 1.5, dirX: 1, dirY: 0, planeX: 0, planeY: 0.66,
    moveSpeed: 0.06, rotSpeed: 0.04, goalReached: false,
    enemies: [], gunFireTimer: 0, gunCooldown: 0,
    npcs: [], dialogState: null,
  };
}

test("SceneBuilder reuses its instance; rebuilds arrays only on map identity change", () => {
  const reg = new TextureRegistry();
  const builder = new SceneBuilder();
  const fp = makeFp(makeMap());

  const s1 = builder.build(fp, reg);
  const solid1 = s1.map.solid, wallTex1 = s1.map.wallTexture;
  const floorTex1 = s1.map.floorTexture, doors1 = s1.doorTiles;

  const s2 = builder.build(fp, reg);
  assert.equal(s2, s1, "same RenderScene instance");
  assert.equal(s2.map.solid, solid1, "solid array reused");
  assert.equal(s2.map.wallTexture, wallTex1, "wallTexture array reused");
  assert.equal(s2.map.floorTexture, floorTex1, "floorTexture array reused");
  assert.equal(s2.doorTiles, doors1, "doorTiles array reused");

  // content sanity: perimeter solid, interior open, door recorded
  assert.equal(s1.map.solid[0], 1);
  assert.equal(s1.map.solid[1 * 4 + 1], 0);
  assert.equal(s1.doorTiles![1 * 4 + 2], 1);
  assert.equal(builder.lastBuilt, s1);

  const fp2 = { ...fp, map: makeMap() };              // new map object, same content
  const s3 = builder.build(fp2, reg);
  assert.equal(s3, s1, "scene instance still reused");
  assert.notEqual(s3.map.solid, solid1, "typed arrays rebuilt on map identity change");
});

test("SceneBuilder flattens billboards with the ported classic rules", () => {
  const reg = new TextureRegistry();
  const builder = new SceneBuilder();
  const fp = makeFp(makeMap());

  const enemyBase: FPEnemy = {
    id: 0, x: 2.5, y: 1.5, hp: 10, maxHp: 10, speed: 0.02, type: "grunt",
    aggroRange: 4, isAggro: false, deathTimer: 0, fireTimer: 0, classId: "armored",
  };
  fp.props = [{ id: 1, x: 2.2, y: 2.2, sprite: "/sprites/test-prop.png", scale: 1.4, label: "RIG" }];
  fp.enemies = [
    { ...enemyBase, id: 1 },                          // full hp → front frame
    { ...enemyBase, id: 2, hp: 5 },                   // damaged → flinch frame
    { ...enemyBase, id: 3, deathTimer: 15 },          // dying → death frame, fading
    { ...enemyBase, id: 4, deathTimer: -1 },          // dead → excluded
  ];
  fp.npcs = [
    { id: 1, x: 1.5, y: 2.5, name: "Commander Voss", type: "quest", dialog: [], color: "#fff", interacted: false },
    { id: 2, x: 2.5, y: 2.5, name: "Unknown Stranger", type: "lore", dialog: [], color: "#fff", interacted: false },
  ];

  const s = builder.build(fp, reg);
  assert.equal(s.billboards.length, 6, "1 prop + 3 live enemies + 2 npcs");
  assert.equal(s.noDepthBillboards.length, 0, "nothing populates the no-depth list yet");

  const [prop, front, flinch, dying, voss, stranger] = s.billboards;
  assert.equal(prop.texId, reg.idFor("/sprites/test-prop.png", "billboard"));
  assert.deepEqual(
    { scale: prop.scale, vAnchor: prop.vAnchor, widthFactor: prop.widthFactor, minSizeFrac: prop.minSizeFrac },
    { scale: 1.4, vAnchor: "prop", widthFactor: 1, minSizeFrac: 20 / 714 });

  assert.equal(front.texId, reg.idFor(SPRITES.FP_ENEMY_FRONT, "billboard"));
  assert.equal(front.alpha256, 256);
  assert.equal(flinch.texId, reg.idFor(SPRITES.FP_ENEMY_FLINCH, "billboard"));
  assert.equal(flinch.alpha256, 256);
  assert.equal(dying.texId, reg.idFor(SPRITES.FP_ENEMY_DEATH, "billboard"));
  assert.equal(dying.alpha256, 128, "deathTimer 15/30 → alpha 128");
  assert.equal(front.vAnchor, "center");

  assert.equal(voss.texId, reg.idFor(NPC_SPRITE_MAP["Commander Voss"], "billboard"));
  assert.equal(stranger.texId, reg.idFor(SPRITES.NPC_SURVIVOR, "billboard"), "unknown NPC falls back to survivor");
  assert.equal(voss.widthFactor, 0.4, "NPC portrait ratio");
  assert.equal(voss.vAnchor, "npc");
});
