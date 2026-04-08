import {
  CANVAS_WIDTH,
  GAME_AREA_HEIGHT,
  type GameState,
  type GroundState,
  type TileMap,
  type GroundEntity,
  type Bullet,
} from "./types";
import { drawDashboard } from "./dashboard";
import { drawFloatingLabels } from "./floatingLabels";
import { drawSpriteExplosions } from "./particles";
import { getSprite, SPRITES } from "./sprites";
import { GROUND_TILE_SIZE } from "./groundPhysics";

const T = GROUND_TILE_SIZE;

// ─── Background ──────────────────────────────────────────────────────────

function drawBackground(
  ctx: CanvasRenderingContext2D,
  cameraX: number,
  frameCount: number
): void {
  const bgFar = getSprite(SPRITES.GROUND_BG_FAR);
  const bgMid = getSprite(SPRITES.GROUND_BG_MID);

  if (bgFar) {
    // Far layer: slow parallax, tile horizontally
    const scale = GAME_AREA_HEIGHT / bgFar.height;
    const drawW = bgFar.width * scale;
    const parallax = (cameraX * 0.1) % drawW;
    ctx.drawImage(bgFar, -parallax, 0, drawW, GAME_AREA_HEIGHT);
    ctx.drawImage(bgFar, -parallax + drawW, 0, drawW, GAME_AREA_HEIGHT);
  } else {
    // Fallback gradient sky
    const grad = ctx.createLinearGradient(0, 0, 0, GAME_AREA_HEIGHT);
    grad.addColorStop(0, "#050510");
    grad.addColorStop(0.5, "#0a0a25");
    grad.addColorStop(1, "#101030");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CANVAS_WIDTH, GAME_AREA_HEIGHT);
  }

  if (bgMid) {
    // Mid layer: medium parallax
    const scale = GAME_AREA_HEIGHT / bgMid.height;
    const drawW = bgMid.width * scale;
    const parallax = (cameraX * 0.3) % drawW;
    ctx.globalAlpha = 0.6;
    ctx.drawImage(bgMid, -parallax, 0, drawW, GAME_AREA_HEIGHT);
    ctx.drawImage(bgMid, -parallax + drawW, 0, drawW, GAME_AREA_HEIGHT);
    ctx.globalAlpha = 1;
  }
}

// ─── Tile Map ─────────────────────────────────────────────────────────────

function drawTileMap(
  ctx: CanvasRenderingContext2D,
  map: TileMap,
  cameraX: number,
  frameCount: number
): void {
  const tileSheet = getSprite(SPRITES.GROUND_TILES);
  // Tile sheet: 1536x1024, 3 tiles side-by-side: floor(0), platform(1), wall(2)
  const sheetFrameW = tileSheet ? tileSheet.width / 3 : 0;
  const sheetFrameH = tileSheet ? tileSheet.height : 0;
  // Crop to content center (sprites have padding)
  const cropInset = sheetFrameW * 0.15;
  const cropW = sheetFrameW - cropInset * 2;
  const cropH = sheetFrameH - cropInset * 2;

  const firstCol = Math.max(0, Math.floor(cameraX / T));
  const lastCol = Math.min(map.width - 1, Math.ceil((cameraX + CANVAS_WIDTH) / T));

  for (let row = 0; row < map.height; row++) {
    for (let col = firstCol; col <= lastCol; col++) {
      const tile = map.tiles[row][col];
      if (tile === "empty" || tile === "spawn") continue;

      const screenX = col * T - cameraX;
      const screenY = row * T;

      if (tile === "solid" && tileSheet) {
        // Floor tile (frame 0)
        ctx.drawImage(tileSheet, cropInset, cropInset, cropW, cropH, screenX, screenY, T, T);
      } else if (tile === "platform" && tileSheet) {
        // Platform tile (frame 1) — draw full sprite but at reduced height for floating look
        const sx = sheetFrameW + cropInset;
        ctx.drawImage(tileSheet, sx, cropInset, cropW, cropH, screenX, screenY - 4, T + 8, T + 4);
      } else if (tile === "solid") {
        // Fallback solid
        ctx.fillStyle = "#2a2a3a";
        ctx.fillRect(screenX, screenY, T, T);
        ctx.fillStyle = "#4a4a5e";
        ctx.fillRect(screenX, screenY, T, 2);
      } else if (tile === "platform") {
        // Fallback platform
        ctx.fillStyle = "#3a5a3a";
        ctx.fillRect(screenX, screenY, T, 6);
        ctx.fillStyle = "#5aaa5a";
        ctx.fillRect(screenX, screenY, T, 2);
      } else if (tile === "goal") {
        // Pulsing green glow
        const pulse = 0.6 + 0.4 * Math.sin(frameCount * 0.08);
        ctx.save();
        ctx.shadowColor = "#00ff88";
        ctx.shadowBlur = 18 * pulse;
        ctx.fillStyle = `rgba(0, 220, 120, ${0.8 * pulse})`;
        ctx.fillRect(screenX + 2, screenY + 2, T - 4, T - 4);
        ctx.restore();

        ctx.save();
        ctx.font = "bold 9px monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.fillStyle = `rgba(0, 255, 150, ${pulse})`;
        ctx.shadowColor = "#00ff88";
        ctx.shadowBlur = 8;
        ctx.fillText("GOAL", screenX + T / 2, screenY - 4);
        ctx.restore();
      }
    }
  }
}

// ─── Ground Enemies ───────────────────────────────────────────────────────

function drawGroundEnemies(
  ctx: CanvasRenderingContext2D,
  enemies: GroundEntity[],
  cameraX: number,
  frameCount: number
): void {
  const turretSheet = getSprite(SPRITES.GROUND_ENEMY_TURRET);
  const patrolSheet = getSprite(SPRITES.GROUND_ENEMY_PATROL);
  const jumperSheet = getSprite(SPRITES.GROUND_ENEMY_JUMPER);
  const flyerSheet = getSprite(SPRITES.GROUND_ENEMY_FLYER);

  for (const e of enemies) {
    const sx = e.x - cameraX;
    const sy = e.y;
    if (sx + e.width < -20 || sx > CANVAS_WIDTH + 20) continue;

    const drawW = e.width + 16;
    const drawH = e.height + 16;
    const drawX = sx - 8;
    const drawY = sy - 12;

    let sheet: HTMLImageElement | null = null;
    let totalFrames = 1;
    let frameIdx = 0;

    if (e.type === "turret" && turretSheet) {
      sheet = turretSheet;
      totalFrames = 2;
      frameIdx = e.fireTimer < 10 ? 1 : 0; // Show firing frame briefly after shot
    } else if (e.type === "patrol" && patrolSheet) {
      sheet = patrolSheet;
      totalFrames = 4;
      frameIdx = Math.floor(frameCount / 10) % 4; // Walk cycle
    } else if (e.type === "jumper" && jumperSheet) {
      sheet = jumperSheet;
      totalFrames = 3;
      frameIdx = e.onGround ? 0 : 1; // Crouch on ground, leap in air
    } else if (e.type === "flyer" && flyerSheet) {
      sheet = flyerSheet;
      totalFrames = 2;
      frameIdx = Math.floor(frameCount / 8) % 2; // Wing flap
    }

    if (sheet) {
      const frameW = sheet.width / totalFrames;
      const frameH = sheet.height;
      // Crop to content center
      const cropX = frameW * 0.15;
      const cropY = frameH * 0.15;
      const cropW = frameW * 0.7;
      const cropH = frameH * 0.7;

      ctx.save();
      // Flip if facing left
      if (!e.facingRight) {
        ctx.translate(sx + e.width / 2, 0);
        ctx.scale(-1, 1);
        ctx.translate(-(sx + e.width / 2), 0);
      }
      ctx.drawImage(
        sheet,
        frameIdx * frameW + cropX, cropY, cropW, cropH,
        drawX, drawY, drawW, drawH
      );
      ctx.restore();
    } else {
      // Fallback colored rectangles
      const colors: Record<string, string> = { turret: "#cc2222", patrol: "#22aa44", jumper: "#2244cc" };
      ctx.fillStyle = colors[e.type] ?? "#aa44ff";
      ctx.fillRect(sx, sy, e.width, e.height);
    }

    // HP bar
    if (e.hp < e.maxHp) {
      const barW = e.width;
      const barH = 3;
      const barY = sy - 6;
      const hpRatio = e.hp / e.maxHp;
      ctx.fillStyle = "#330000";
      ctx.fillRect(sx, barY, barW, barH);
      ctx.fillStyle = hpRatio > 0.5 ? "#44ff44" : hpRatio > 0.25 ? "#ffaa00" : "#ff3333";
      ctx.fillRect(sx, barY, Math.round(barW * hpRatio), barH);
    }
  }
}

// ─── Bullets ─────────────────────────────────────────────────────────────

function drawGroundBullets(
  ctx: CanvasRenderingContext2D,
  bullets: Bullet[],
  cameraX: number
): void {
  for (const b of bullets) {
    const sx = b.x - cameraX;
    if (sx + b.width < 0 || sx > CANVAS_WIDTH) continue;

    const color = b.isPlayer ? "#00ffff" : "#ff4444";
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    ctx.fillStyle = color;
    ctx.fillRect(sx, b.y, b.width, b.height);
    ctx.restore();
  }
}

// ─── Player ───────────────────────────────────────────────────────────────

function drawGroundPlayer(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  gs: GroundState
): void {
  const { player } = state;

  // Invincibility blink
  if (player.invincibleTimer > 0 && Math.floor(player.invincibleTimer / 4) % 2 === 0) return;

  const sx = player.x - gs.cameraX;
  const sy = player.y;

  // Pick the right sprite based on animation state
  const runFrames = [
    SPRITES.GROUND_PLAYER_RUN_1,
    SPRITES.GROUND_PLAYER_RUN_2,
    SPRITES.GROUND_PLAYER_RUN_3,
    SPRITES.GROUND_PLAYER_RUN_4,
  ];

  let spritePath: string;
  const isMoving = player.bankDir !== 0;

  if (player.invincibleTimer > 0 && player.hp <= 0) {
    spritePath = SPRITES.GROUND_PLAYER_HURT;
  } else if (!gs.playerOnGround) {
    spritePath = SPRITES.GROUND_PLAYER_JUMP;
  } else if (player.fireTimer > 8) {
    spritePath = SPRITES.GROUND_PLAYER_SHOOT;
  } else if (isMoving) {
    spritePath = runFrames[Math.floor(state.frameCount / 10) % 4];
  } else {
    spritePath = SPRITES.GROUND_PLAYER_IDLE;
  }

  const sprite = getSprite(spritePath);

  // Draw size — anchor feet to ground
  const drawW = 56;
  const drawH = 64;
  const drawX = sx + (player.width - drawW) / 2;
  const drawY = sy + player.height - drawH;

  if (sprite) {
    ctx.save();
    if (!gs.playerFacingRight) {
      ctx.translate(sx + player.width / 2, 0);
      ctx.scale(-1, 1);
      ctx.translate(-(sx + player.width / 2), 0);
    }
    ctx.drawImage(sprite, drawX, drawY, drawW, drawH);
    ctx.restore();
  } else {
    // Fallback rectangle
    ctx.fillStyle = "#3366ff";
    ctx.fillRect(sx, sy, player.width, player.height);
  }
}

// ─── Level Complete Banner ────────────────────────────────────────────────

function drawLevelCompleteBanner(ctx: CanvasRenderingContext2D, timer: number): void {
  const alpha = Math.min(1, timer / 30);
  ctx.save();
  ctx.globalAlpha = alpha;

  ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
  ctx.fillRect(0, GAME_AREA_HEIGHT / 2 - 44, CANVAS_WIDTH, 88);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = "#00ff88";
  ctx.shadowBlur = 20;
  ctx.fillStyle = "#00ff88";
  ctx.font = "bold 36px monospace";
  ctx.fillText("SECTOR CLEAR", CANVAS_WIDTH / 2, GAME_AREA_HEIGHT / 2 - 10);

  ctx.font = "14px monospace";
  ctx.fillStyle = "#aaffcc";
  ctx.shadowBlur = 8;
  ctx.fillText("OBJECTIVE COMPLETE", CANVAS_WIDTH / 2, GAME_AREA_HEIGHT / 2 + 20);

  ctx.restore();
}

// ─── Main Entry Point ─────────────────────────────────────────────────────

export function drawGroundGame(
  ctx: CanvasRenderingContext2D,
  state: GameState
): void {
  const gs = state.groundState;
  if (!gs) return;

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, CANVAS_WIDTH, GAME_AREA_HEIGHT);
  ctx.clip();

  // Background parallax
  drawBackground(ctx, gs.cameraX, state.frameCount);

  // Tile map
  drawTileMap(ctx, gs.tileMap, gs.cameraX, state.frameCount);

  // Enemies
  drawGroundEnemies(ctx, gs.groundEnemies, gs.cameraX, state.frameCount);

  // Bullets
  drawGroundBullets(ctx, gs.groundBullets, gs.cameraX);

  // Explosions + labels (offset by camera)
  ctx.save();
  ctx.translate(-gs.cameraX, 0);
  drawSpriteExplosions(ctx, state.explosions);
  drawFloatingLabels(ctx, state.floatingLabels);
  ctx.restore();

  // Player (drawn last so they're on top)
  drawGroundPlayer(ctx, state, gs);

  // Level complete banner
  if (state.levelCompleteTimer > 0) {
    drawLevelCompleteBanner(ctx, state.levelCompleteTimer);
  }

  ctx.restore();

  // Dashboard always on top
  drawDashboard(ctx, state);
}
