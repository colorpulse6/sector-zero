import { test } from "node:test";
import assert from "node:assert/strict";
import { applyGravity, JUMP_VELOCITY } from "../../app/components/engine/groundPhysics";
import type { TileMap } from "../../app/components/engine/types";

// Task 6 fixup: ground gravity is now delta-time scaled (semi-implicit Euler).
// This pins the arc-shape frame-rate invariance — a jump's horizontal span in
// world units must be ~equal whether simulated at dtF=1 over M frames or at
// dtF=2 over ~M/2 frames. (Bullet/hitbox tunneling is a separate, documented
// trade-off; this test is purely about the gravity arc.)

const TILE = 32;
const PLAYER_W = 32;
const PLAYER_H = 40;
const H_SPEED = 3; // mirrors groundEngine PLAYER_MOVE_SPEED (px per 16.67ms)
const FLOOR_ROW = 15;

// Wide field, everything empty except one continuous solid floor row so the
// player lands again wherever it drifts to.
function makeField(): TileMap {
  const height = 20;
  const width = 60;
  const tiles = Array.from({ length: height }, (_, row) =>
    Array.from({ length: width }, () => (row === FLOOR_ROW ? "solid" : "empty"))
  );
  return { width, height, tileSize: TILE, tiles } as TileMap;
}

// Jump from the floor with a constant horizontal drift; return the world-space
// horizontal distance covered from launch until the player lands again.
function jumpSpan(dtF: number): number {
  const map = makeField();
  const startX = 100;
  let x = startX;
  let y = FLOOR_ROW * TILE - PLAYER_H; // standing on the floor
  let vy = JUMP_VELOCITY;              // instantaneous jump impulse (not scaled)

  for (let i = 0; i < 100000; i++) {
    const g = applyGravity(map, x, y, vy, PLAYER_W, PLAYER_H, dtF);
    y = g.y;
    vy = g.vy;
    x += H_SPEED * dtF;
    if (g.onGround) break; // landed back on the floor
  }
  return x - startX;
}

test("ground: jump-arc horizontal span is frame-rate invariant (semi-implicit Euler)", () => {
  const span60 = jumpSpan(1); // 60fps
  const span30 = jumpSpan(2); // 30fps, twice the step

  assert.ok(span60 > 0, "jump should cover horizontal ground");
  const relErr = Math.abs(span60 - span30) / span60;
  assert.ok(relErr < 0.1,
    `arc span must match across frame rates within Euler tolerance: 60fps=${span60}, 30fps=${span30}, relErr=${relErr}`);
});
