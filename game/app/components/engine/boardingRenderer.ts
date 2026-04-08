import {
  CANVAS_WIDTH,
  GAME_AREA_HEIGHT,
  type GameState,
  type BoardingState,
  type BoardingMap,
  type BoardingEntity,
  type FacingDirection,
} from "./types";
import { drawDashboard } from "./dashboard";
import { drawFloatingLabels } from "./floatingLabels";
import { drawSpriteExplosions } from "./particles";
import { getSprite, SPRITES } from "./sprites";

const T = 32;

// ─── Tile Colors ────────────────────────────────────────────────────

const TILE_COLORS: Record<string, string> = {
  floor: "#1a1a2a",
  wall: "#2a2a3a",
  door: "#1a2a1a",
  goal: "#003322",
  spawn: "#1a1a2a",
};

// ─── Tile Map ───────────────────────────────────────────────────────

function drawTileMap(
  ctx: CanvasRenderingContext2D,
  map: BoardingMap,
  camX: number,
  camY: number,
  frameCount: number
): void {
  const tileSheet = getSprite(SPRITES.BOARDING_TILES);
  // Tile sheet: 1536×1024, 3 tiles: floor(0), wall(1), door(2)
  const sheetFrameW = tileSheet ? tileSheet.width / 3 : 0;
  const sheetFrameH = tileSheet ? tileSheet.height : 0;

  const firstCol = Math.max(0, Math.floor(camX / T));
  const lastCol = Math.min(map.width - 1, Math.ceil((camX + CANVAS_WIDTH) / T));
  const firstRow = Math.max(0, Math.floor(camY / T));
  const lastRow = Math.min(map.height - 1, Math.ceil((camY + GAME_AREA_HEIGHT) / T));

  for (let row = firstRow; row <= lastRow; row++) {
    for (let col = firstCol; col <= lastCol; col++) {
      const tile = map.tiles[row][col];
      if (tile === "empty") continue;

      const sx = col * T - camX;
      const sy = row * T - camY;

      if (tile === "wall") {
        // Wall: use sprite tile (frame 1) — darker, solid
        if (tileSheet) {
          ctx.drawImage(tileSheet, sheetFrameW, 0, sheetFrameW, sheetFrameH, sx, sy, T, T);
        } else {
          ctx.fillStyle = "#1a1a2a";
          ctx.fillRect(sx, sy, T, T);
        }
      } else if (tile === "floor" || tile === "spawn") {
        // Floor: use sprite tile (frame 0) with brightened overlay for contrast
        if (tileSheet) {
          ctx.drawImage(tileSheet, 0, 0, sheetFrameW, sheetFrameH, sx, sy, T, T);
          // Brighten floor slightly so it contrasts with walls
          ctx.fillStyle = "rgba(60, 80, 100, 0.15)";
          ctx.fillRect(sx, sy, T, T);
        } else {
          ctx.fillStyle = "#181828";
          ctx.fillRect(sx, sy, T, T);
        }
        // Subtle grid lines for floor
        ctx.strokeStyle = "rgba(100, 140, 180, 0.08)";
        ctx.lineWidth = 0.5;
        ctx.strokeRect(sx + 0.5, sy + 0.5, T - 1, T - 1);
      } else if (tile === "door") {
        // Door: use sprite tile (frame 2) + glowing border
        if (tileSheet) {
          ctx.drawImage(tileSheet, sheetFrameW * 2, 0, sheetFrameW, sheetFrameH, sx, sy, T, T);
        } else {
          ctx.fillStyle = "#181828";
          ctx.fillRect(sx, sy, T, T);
        }
        // Green glow on doors to make them visible
        ctx.fillStyle = "rgba(68, 204, 102, 0.12)";
        ctx.fillRect(sx, sy, T, T);
        ctx.strokeStyle = "rgba(68, 204, 102, 0.4)";
        ctx.lineWidth = 1;
        ctx.strokeRect(sx + 1, sy + 1, T - 2, T - 2);
      } else if (tile === "goal") {
        const pulse = 0.5 + 0.3 * Math.sin(frameCount * 0.06);
        ctx.fillStyle = "#12121e";
        ctx.fillRect(sx, sy, T, T);
        ctx.fillStyle = `rgba(0, 255, 136, ${0.15 + pulse * 0.15})`;
        ctx.fillRect(sx, sy, T, T);
        ctx.strokeStyle = `rgba(0, 255, 136, ${pulse})`;
        ctx.lineWidth = 2;
        ctx.strokeRect(sx + 2, sy + 2, T - 4, T - 4);

        ctx.fillStyle = `rgba(0, 255, 150, ${pulse})`;
        ctx.font = "bold 8px monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.fillText("DATA", sx + T / 2, sy - 2);
        ctx.fillText("CORE", sx + T / 2, sy + T + 10);
      }
    }
  }
}

// ─── Enemies ────────────────────────────────────────────────────────

function drawEnemies(
  ctx: CanvasRenderingContext2D,
  enemies: BoardingEntity[],
  camX: number,
  camY: number,
  frameCount: number
): void {
  const gruntIdle = getSprite(SPRITES.BOARDING_ENEMY_GRUNT_IDLE);
  const gruntAttack = getSprite(SPRITES.BOARDING_ENEMY_GRUNT_ATTACK);

  for (const e of enemies) {
    const sx = e.x - camX;
    const sy = e.y - camY;
    if (sx + e.width < -20 || sx > CANVAS_WIDTH + 20) continue;
    if (sy + e.height < -20 || sy > GAME_AREA_HEIGHT + 20) continue;

    const drawSize = e.width + 16;
    const drawX = sx + e.width / 2 - drawSize / 2;
    const drawY = sy + e.height / 2 - drawSize / 2;

    // Pick sprite based on type and aggro state
    const sprite = e.isAggro ? gruntAttack : gruntIdle;

    if (sprite) {
      ctx.drawImage(sprite, drawX, drawY, drawSize, drawSize);
    } else {
      // Fallback colored circle
      const color = e.type === "sentry" ? "#cc4444"
        : e.type === "charger" ? "#4488ff"
        : "#44aa44";
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(sx + e.width / 2, sy + e.height / 2, e.width / 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Aggro indicator ring
    if (e.isAggro) {
      ctx.strokeStyle = "#ff000044";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(sx + e.width / 2, sy + e.height / 2, drawSize / 2 + 2, 0, Math.PI * 2);
      ctx.stroke();
    }

    // HP bar
    if (e.hp < e.maxHp) {
      const barW = e.width;
      const barH = 3;
      ctx.fillStyle = "#330000";
      ctx.fillRect(sx, sy - 6, barW, barH);
      const ratio = e.hp / e.maxHp;
      ctx.fillStyle = ratio > 0.5 ? "#44ff44" : "#ff4444";
      ctx.fillRect(sx, sy - 6, barW * ratio, barH);
    }
  }
}

function facingVec(f: FacingDirection): { x: number; y: number } {
  switch (f) {
    case "up": return { x: 0, y: -1 };
    case "down": return { x: 0, y: 1 };
    case "left": return { x: -1, y: 0 };
    case "right": return { x: 1, y: 0 };
  }
}

// ─── Player ─────────────────────────────────────────────────────────

function drawPlayer(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  bs: BoardingState
): void {
  const { player } = state;

  if (player.invincibleTimer > 0 && Math.floor(player.invincibleTimer / 4) % 2 === 0) return;

  const sx = player.x - bs.cameraX;
  const sy = player.y - bs.cameraY;

  // Pick directional sprite
  const spriteMap: Record<string, string> = {
    up: SPRITES.BOARDING_PLAYER_UP,
    down: SPRITES.BOARDING_PLAYER_DOWN,
    left: SPRITES.BOARDING_PLAYER_LEFT,
    right: SPRITES.BOARDING_PLAYER_RIGHT,
  };
  const sprite = getSprite(spriteMap[bs.playerFacing]);

  const drawSize = 36;
  const drawX = sx + 12 - drawSize / 2;
  const drawY = sy + 12 - drawSize / 2;

  // Dash trail
  if (bs.dashTimer > 0) {
    const dir = facingVec(bs.playerFacing);
    ctx.globalAlpha = 0.3;
    if (sprite) {
      ctx.drawImage(sprite, drawX - dir.x * 18, drawY - dir.y * 18, drawSize, drawSize);
    }
    ctx.globalAlpha = 1;
  }

  if (sprite) {
    ctx.drawImage(sprite, drawX, drawY, drawSize, drawSize);
  } else {
    // Fallback circle
    ctx.fillStyle = "#44aaff";
    ctx.beginPath();
    ctx.arc(sx + 12, sy + 12, 12, 0, Math.PI * 2);
    ctx.fill();
    const dir = facingVec(bs.playerFacing);
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(sx + 12 + dir.x * 8, sy + 12 + dir.y * 8, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ─── Bullets ────────────────────────────────────────────────────────

function drawBullets(
  ctx: CanvasRenderingContext2D,
  bs: BoardingState
): void {
  for (const b of bs.bullets) {
    const sx = b.x - bs.cameraX;
    const sy = b.y - bs.cameraY;
    if (sx < -10 || sx > CANVAS_WIDTH + 10 || sy < -10 || sy > GAME_AREA_HEIGHT + 10) continue;

    ctx.save();
    ctx.shadowBlur = 6;
    ctx.shadowColor = b.isPlayer ? "#44ccff" : "#ff4444";
    ctx.fillStyle = b.isPlayer ? "#44ccff" : "#ff4444";
    ctx.beginPath();
    ctx.arc(sx + b.width / 2, sy + b.height / 2, b.width / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// ─── Level Complete Banner ──────────────────────────────────────────

function drawCompleteBanner(ctx: CanvasRenderingContext2D, timer: number): void {
  const alpha = Math.min(1, timer / 30);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
  ctx.fillRect(0, GAME_AREA_HEIGHT / 2 - 44, CANVAS_WIDTH, 88);
  ctx.shadowColor = "#44ccff";
  ctx.shadowBlur = 20;
  ctx.fillStyle = "#44ccff";
  ctx.font = "bold 32px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("DATA SECURED", CANVAS_WIDTH / 2, GAME_AREA_HEIGHT / 2 - 10);
  ctx.font = "14px monospace";
  ctx.fillStyle = "#aaddff";
  ctx.shadowBlur = 8;
  ctx.fillText("OBJECTIVE COMPLETE", CANVAS_WIDTH / 2, GAME_AREA_HEIGHT / 2 + 20);
  ctx.restore();
}

// ─── Mini Map ───────────────────────────────────────────────────────

function drawMiniMap(
  ctx: CanvasRenderingContext2D,
  bs: BoardingState,
  playerX: number,
  playerY: number
): void {
  const scale = 3; // pixels per tile
  const mw = bs.map.width * scale;
  const mh = bs.map.height * scale;
  const mx = CANVAS_WIDTH - mw - 8;
  const my = 8;

  // Background
  ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
  ctx.fillRect(mx - 2, my - 2, mw + 4, mh + 4);

  // Tiles
  for (let r = 0; r < bs.map.height; r++) {
    for (let c = 0; c < bs.map.width; c++) {
      const tile = bs.map.tiles[r][c];
      if (tile === "wall") {
        ctx.fillStyle = "#334";
        ctx.fillRect(mx + c * scale, my + r * scale, scale, scale);
      } else if (tile === "goal") {
        ctx.fillStyle = "#0f8";
        ctx.fillRect(mx + c * scale, my + r * scale, scale, scale);
      }
    }
  }

  // Player dot
  const px = mx + (playerX / bs.map.tileSize) * scale;
  const py = my + (playerY / bs.map.tileSize) * scale;
  ctx.fillStyle = "#44ccff";
  ctx.fillRect(px - 1, py - 1, 3, 3);

  // Enemy dots
  for (const e of bs.enemies) {
    const ex = mx + (e.x / bs.map.tileSize) * scale;
    const ey = my + (e.y / bs.map.tileSize) * scale;
    ctx.fillStyle = e.isAggro ? "#ff4444" : "#ff444466";
    ctx.fillRect(ex, ey, 2, 2);
  }
}

// ─── Main Entry Point ───────────────────────────────────────────────

export function drawBoardingGame(
  ctx: CanvasRenderingContext2D,
  state: GameState
): void {
  const bs = state.boardingState;
  if (!bs) return;

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, CANVAS_WIDTH, GAME_AREA_HEIGHT);
  ctx.clip();

  // Dark background (space visible through hull gaps)
  ctx.fillStyle = "#08080f";
  ctx.fillRect(0, 0, CANVAS_WIDTH, GAME_AREA_HEIGHT);

  // Tile map
  drawTileMap(ctx, bs.map, bs.cameraX, bs.cameraY, state.frameCount);

  // Enemies
  drawEnemies(ctx, bs.enemies, bs.cameraX, bs.cameraY, state.frameCount);

  // Bullets
  drawBullets(ctx, bs);

  // Explosions + labels (offset by camera)
  ctx.save();
  ctx.translate(-bs.cameraX, -bs.cameraY);
  drawSpriteExplosions(ctx, state.explosions);
  drawFloatingLabels(ctx, state.floatingLabels);
  ctx.restore();

  // Player ambient light (illuminates nearby area)
  const plx = state.player.x + 12 - bs.cameraX;
  const ply = state.player.y + 12 - bs.cameraY;
  const lightGrad = ctx.createRadialGradient(plx, ply, 20, plx, ply, 120);
  lightGrad.addColorStop(0, "rgba(100, 160, 220, 0.12)");
  lightGrad.addColorStop(0.5, "rgba(60, 100, 160, 0.06)");
  lightGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = lightGrad;
  ctx.fillRect(plx - 120, ply - 120, 240, 240);

  // Player
  drawPlayer(ctx, state, bs);

  // Mini-map
  drawMiniMap(ctx, bs, state.player.x, state.player.y);

  // Level complete
  if (state.levelCompleteTimer > 0) {
    drawCompleteBanner(ctx, state.levelCompleteTimer);
  }

  ctx.restore();

  // Dashboard
  drawDashboard(ctx, state);
}
